/* Доска заявок: пять колонок — крупные фазы найма. Карточка коротко: что за вакансия;
   если ход того, кто смотрит, она выделена цветом и стоит первой. Карточки не перетаскивают: их двигают решения людей, поэтому
   никто не перепрыгнет через согласование. Когда шаг сделан, карточка сама переезжает
   в следующую колонку — это видно по её движению. */
'use strict';

/* свой ход — карточка выделена цветом и стоит в колонке первой */
const isMine = (r, v) => Model.turns(r).some(x => Model.mineTurn(x, v));
function pickTurn(r, v){
  const t = Model.turns(r);
  return t.find(x => Model.mineTurn(x, v)) || t.find(x => !x.ongoing) || t[0] || null;
}

function Card({r, v, now, current, onOpen}){
  const ph = Model.phase(r), mine = isMine(r, v), open = Model.openHires(r);
  let meta = null;
  if(ph === 'closed'){
    const res = r.status === 'rejected' ? 'Отклонено' : r.status === 'cancelled' ? 'Отменено' : 'Закрыта за ' + Model.days(r.created, r.closedAt) + ' ' + Model.plural(Model.days(r.created, r.closedAt), 'день','дня','дней');
    meta = html`<div className="c-meta"><span>${res}</span><span className="num">${Model.fmtDate(r.closedAt)}</span></div>`;
  } else if(ph === 'search' && r.status === 'published'){
    const n = r.candidates.filter(c => c.stage !== 'rejected' && c.stage !== 'accepted').length;
    if(n) meta = html`<div className="c-meta"><span className="num">${n} ${Model.plural(n, 'кандидат','кандидата','кандидатов')}</span></div>`;
  } else if((ph === 'start' || ph === 'hire') && open.length){
    meta = html`<div className="c-meta"><span>${open.map(h => h.name).join(', ')}</span></div>`;
  }
  return html`<button className=${'card' + (mine ? ' is-mine' : '') + (ph === 'closed' ? ' is-closed' : '')} data-card=${r.id} aria-current=${current ? 'true' : undefined}
    aria-label=${mine ? r.title + ', ваш ход' : null} onClick=${() => onOpen(r.id)}>
    <div className="c-top">
      <span className="c-title">${r.title}</span>
      ${r.seats > 1 && html`<span className="c-seats num">× ${r.seats}</span>`}
      ${r.priority === 'high' && ph !== 'closed' && html`<span className="c-urgent">Срочно</span>`}
    </div>
    <div className="c-sub">${r.dept} / ${r.project}</div>
    ${meta}
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

/* места карточек помнятся между открытиями доски: вернулись из заявки после решения —
   карточка доезжает до новой колонки у вас на глазах */
const boardMem = {rects:new Map(), ver:null};
function Board({list, v, now, current, onOpen, version}){
  const ref = useRef(null), rects = useRef(boardMem.rects), lastVer = useRef(boardMem.ver);
  /* у рекрутера работа линейная: согласование до него не доходит, в закрытых делать нечего — эти колонки не показываем */
  const role = Model.PEOPLE[v].role;
  const cols = Model.COLUMNS.filter(c => role !== 'recruiter' || !['approve','closed'].includes(c.id)).map(c => {
    let items = list.filter(r => Model.phase(r) === c.id);
    if(c.id === 'closed') items = items.filter(r => now - r.closedAt < 30 * Model.D).sort((a, b) => b.closedAt - a.closedAt);
    else items = sortCards(items, v, now);
    return {c, items};
  });

  /* карточка, сменившая место после решения, едет на новое место, а не перескакивает */
  useLayoutEffect(() => {
    const els = ref.current ? ref.current.querySelectorAll('[data-card]') : [];
    const moved = lastVer.current !== null && lastVer.current !== version && Store.kind() === 'act'; lastVer.current = boardMem.ver = version;
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
    rects.current = boardMem.rects = next;
  });
  /* при прокрутке доски и смене ширины окна места пересчитываются без анимации */
  useEffect(() => {
    const re = () => { const m = new Map(); ref.current && ref.current.querySelectorAll('[data-card]').forEach(el => m.set(el.dataset.card, el.getBoundingClientRect())); rects.current = boardMem.rects = m; };
    addEventListener('resize', re); const s = ref.current && (ref.current.closest('.content') || ref.current); s && s.addEventListener('scroll', re, true);
    return () => { removeEventListener('resize', re); s && s.removeEventListener('scroll', re, true); };
  }, []);

  return html`<div className=${'board' + (cols.length < 5 ? ' is-' + cols.length : '')} ref=${ref}>
    ${cols.map(({c, items}) => html`<section className="col" key=${c.id} aria-labelledby=${'col-' + c.id}>
      <div className="col-h"><span className="col-n" id=${'col-' + c.id}>${c.name}</span>
        <span className="col-c num">${c.id === 'closed' ? '30 дней' : items.length || ''}</span></div>
      <div className="col-list">
        ${items.map(r => html`<${Card} key=${r.id} r=${r} v=${v} now=${now} current=${current === r.id} onOpen=${onOpen}/>`)}
      </div>
    </section>`)}
  </div>`;
}
