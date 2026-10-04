/* Доска заявок: пять колонок — крупные фазы найма. На карточке — шаг внутри фазы
   и чей сейчас ход. Карточки не перетаскивают: их двигают решения людей, поэтому
   никто не перепрыгнет через согласование. Когда шаг сделан, карточка сама переезжает
   в следующую колонку — это видно по её движению. */
'use strict';

/* какой шаг показать на карточке: свой ход — первым, иначе первый, кто ждёт решения */
function pickTurn(r, v){
  const t = Model.turns(r);
  return t.find(x => Model.mineTurn(x, v)) || t.find(x => !x.ongoing) || t[0] || null;
}
const isMine = (r, v) => Model.turns(r).some(x => Model.mineTurn(x, v));

function TurnLine({t, v, now}){
  if(!t) return null;
  const mine = Model.mineTurn(t, v), late = Model.late(t, now);
  let time = null;
  if(t.due) time = t.dueKind + ' ' + Model.fmtDate(t.due);
  else if(t.since && !t.ongoing) time = Model.ago(t.since, now);
  else if(t.count) time = t.count[0] + ' из ' + t.count[1];
  return html`<div className=${'c-turn' + (mine ? ' is-mine' : '') + (late ? ' is-late' : '')}>
    <span className="t">${mine ? t.mine : t.text}</span>
    ${time && html`<span className="c-time">${late && html`<${Icon} n="late" s=${14} label="Срок прошёл"/>`}${time}</span>`}
  </div>`;
}

function Card({r, v, now, current, onOpen}){
  const ph = Model.phase(r), pr = Model.progress(r), t = pickTurn(r, v), mine = t && Model.mineTurn(t, v);
  const hires = Model.activeHires(r), open = Model.openHires(r);
  if(ph === 'closed'){
    const res = r.status === 'rejected' ? 'Отклонена' : r.status === 'cancelled' ? 'Отменена' : 'Закрыта за ' + Model.days(r.created, r.closedAt) + ' ' + Model.plural(Model.days(r.created, r.closedAt), 'день','дня','дней');
    return html`<button className="card is-closed" data-card=${r.id} aria-current=${current ? 'true' : undefined} onClick=${() => onOpen(r.id)}>
      <div className="c-top"><span className="c-title">${r.title}</span></div>
      <div className="c-sub">${r.dept} / ${r.project}</div>
      <div className="c-meta"><span>${res}</span><span className="num muted">${Model.fmtDate(r.closedAt)}</span></div>
    </button>`;
  }
  let meta = null;
  if(ph === 'search' && r.recruiter){
    const n = r.candidates.length;
    meta = html`<div className="c-meta"><span>Рекрутер: ${shortName(r.recruiter)}</span>
      <span className="num">${hires.length ? 'выбран ' + hires.length + ' из ' + r.seats : n ? n + ' ' + Model.plural(n, 'кандидат','кандидата','кандидатов') : ''}</span></div>`;
  }
  if((ph === 'start' || ph === 'hire') && open.length){
    meta = html`<div className="c-meta"><span>${open.map(h => h.name).join(', ')}</span></div>`;
  }
  return html`<button className=${'card' + (mine ? ' is-mine' : '')} data-card=${r.id} aria-current=${current ? 'true' : undefined} onClick=${() => onOpen(r.id)}>
    <div className="c-top">
      <span className="c-title">${r.title}</span>
      ${r.seats > 1 && html`<span className="c-seats num">× ${r.seats}</span>`}
      ${r.priority === 'high' && html`<span className="c-urgent">Срочно</span>`}
    </div>
    <div className="c-sub">${r.dept} / ${r.project}</div>
    ${meta}
    ${pr && html`<div className="c-steps" aria-hidden="true">${Array.from({length:pr.n}, (_, i) => html`<i key=${i} className=${i <= pr.at ? 'on' : ''}/>`)}</div>`}
    <${TurnLine} t=${t} v=${v} now=${now}/>
  </button>`;
}

function sortCards(list, v, now){
  const key = r => {
    const t = pickTurn(r, v);
    const mine = t && Model.mineTurn(t, v) ? 0 : 1, late = t && Model.late(t, now) ? 0 : 1;
    return [mine, late, t && (t.due || t.since) || r.updated];
  };
  return list.slice().sort((a, b) => { const x = key(a), y = key(b); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; });
}

function Board({list, v, now, current, onOpen, version}){
  const ref = useRef(null), rects = useRef(new Map()), lastVer = useRef(version);
  const cols = Model.COLUMNS.map(c => {
    let items = list.filter(r => Model.phase(r) === c.id);
    if(c.id === 'closed') items = items.filter(r => now - r.closedAt < 30 * Model.D).sort((a, b) => b.closedAt - a.closedAt);
    else items = sortCards(items, v, now);
    return {c, items};
  });

  /* карточка, сменившая место после решения, едет на новое место, а не перескакивает */
  useLayoutEffect(() => {
    const els = ref.current ? ref.current.querySelectorAll('[data-card]') : [];
    const moved = lastVer.current !== version && Store.kind() === 'act'; lastVer.current = version;
    const next = new Map();
    els.forEach(el => {
      const r = el.getBoundingClientRect(), id = el.dataset.card, was = rects.current.get(id);
      next.set(id, r);
      if(!moved || !Anim.on()) return;
      if(!was){ Motion.animate(el, {opacity:[0,1], transform:['scale(.97)','scale(1)']}, {type:'spring', visualDuration:.3, bounce:0}); return; }
      const dx = was.left - r.left, dy = was.top - r.top;
      if(Math.abs(dx) > 1 || Math.abs(dy) > 1){
        el.style.position = 'relative'; el.style.zIndex = Math.abs(dx) > 1 ? '5' : '';
        Motion.animate(el, {transform:['translate(' + dx + 'px,' + dy + 'px)', 'translate(0,0)']}, {type:'spring', visualDuration:Math.abs(dx) > 1 ? .55 : .34, bounce:0})
          .then(() => { el.style.transform = ''; el.style.position = ''; el.style.zIndex = ''; }, () => {});
      }
    });
    rects.current = next;
  });
  /* при прокрутке колонки и смене ширины окна места пересчитываются без анимации */
  useEffect(() => {
    const re = () => { const m = new Map(); ref.current && ref.current.querySelectorAll('[data-card]').forEach(el => m.set(el.dataset.card, el.getBoundingClientRect())); rects.current = m; };
    addEventListener('resize', re); const s = ref.current; s && s.addEventListener('scroll', re, true);
    return () => { removeEventListener('resize', re); s && s.removeEventListener('scroll', re, true); };
  }, []);

  return html`<div className="board" ref=${ref}>
    ${cols.map(({c, items}) => html`<section className="col" key=${c.id} aria-labelledby=${'col-' + c.id}>
      <div className="col-h"><span className="col-n" id=${'col-' + c.id}>${c.name}</span>
        <span className="col-c num">${c.id === 'closed' ? '30 дней' : items.length || ''}</span></div>
      <div className="col-list">
        ${items.map(r => html`<${Card} key=${r.id} r=${r} v=${v} now=${now} current=${current === r.id} onOpen=${onOpen}/>`)}
      </div>
    </section>`)}
  </div>`;
}
