/* Общие детали интерфейса: разметка через htm, иконки, кнопки, поля, меню, движение. */
'use strict';

const html = htm.bind(React.createElement);
const {useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback, useSyncExternalStore, Fragment} = React;

const useStore = () => { useSyncExternalStore(Store.subscribe, Store.version); return Store.get(); };
const useViewer = () => { useSyncExternalStore(Store.subscribe, Store.version); return Store.viewer(); };

/* часы: «ждёт 2 дня» пересчитывается раз в минуту */
function useNow(){
  const [now, set] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => set(Date.now()), 60e3); return () => clearInterval(t); }, []);
  return now;
}

const ICONS = {
  x:'M5 5l10 10M15 5L5 15',
  back:'M12.5 4.5 7 10l5.5 5.5',
  down:'M5 7.5l5 5 5-5',
  search:'M9 15.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM13.8 13.8 17.5 17.5',
  late:'M10 17.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15zM10 6v4.5M10 13.6v.1',
  check:'M5 10.5l3.2 3L15 6.5',
  plus:'M10 4v12M4 10h12',
  more:'M5 10h.01M10 10h.01M15 10h.01',
  side:'M3.5 5.5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2zM8 3.5v13',
  chev:'M8 5l5 5-5 5',
  updown:'M6.5 8 10 4.5 13.5 8M6.5 12l3.5 3.5 3.5-3.5',
  user:'M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4.5 16.5c.8-2.6 2.9-4 5.5-4s4.7 1.4 5.5 4',
  funnel:'M3.5 4.5h13l-5 6v4.5l-3 1.5v-6z',
  board:'M3.5 4h3.5v12H3.5zM8.25 4h3.5v8h-3.5zM13 4h3.5v10H13z',
  doc:'M11.5 2.5H6A1.5 1.5 0 0 0 4.5 4v12A1.5 1.5 0 0 0 6 17.5h8a1.5 1.5 0 0 0 1.5-1.5V6.5zM11.5 2.5v4h4M7.5 10.5h5M7.5 13.5h5',
  ok:'M10 17.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15zM6.8 10.2l2.2 2.2 4.2-4.6',
  no:'M10 17.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15zM7.6 7.6l4.8 4.8M12.4 7.6l-4.8 4.8',
  ret:'M10 17.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15zM10.5 7 7.5 10l3 3M7.8 10h5',
  ev:'M10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  phone:'M6.2 3.5h2.1l1.1 3-1.5 1a8 8 0 0 0 4.5 4.5l1-1.5 3 1.1v2.1a1.5 1.5 0 0 1-1.6 1.5A12.5 12.5 0 0 1 4.7 5.1a1.5 1.5 0 0 1 1.5-1.6z',
  send:'M16.5 3.5 8.8 11.2M16.5 3.5l-4.8 13-2.9-5.6-5.6-2.9z',
  mail:'M3.5 5.5h13v9h-13zM3.8 6l6.2 4.8L16.2 6',
  link:'M8.6 11.4a3 3 0 0 0 4.2 0l2.6-2.6a3 3 0 0 0-4.2-4.2l-.9.9M11.4 8.6a3 3 0 0 0-4.2 0l-2.6 2.6a3 3 0 0 0 4.2 4.2l.9-.9',
  cal:'M4 6.5a1.5 1.5 0 0 1 1.5-1.5h9A1.5 1.5 0 0 1 16 6.5v8a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 14.5zM4 8.5h12M7.5 3.5v3M12.5 3.5v3',
  minus:'M5 10h10',
  dl:'M10 4v8.5M6.5 9 10 12.5 13.5 9M5 15.5h10',
  ext:'M11 4.5h4.5V9M15.5 4.5 9 11M13.5 11.5v3a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3',
  clip:'M14.5 9.5 9.6 14.4a3 3 0 0 1-4.2-4.2l5.6-5.6a2 2 0 0 1 2.8 2.8l-5.4 5.4a1 1 0 0 1-1.4-1.4l4.8-4.8'
};
function Icon({n, s = 16, w = 1.6, label}){
  return html`<svg width=${s} height=${s} viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width=${n === 'more' ? 3 : w}
    stroke-linecap="round" stroke-linejoin="round" aria-hidden=${label ? undefined : 'true'} role=${label ? 'img' : undefined} aria-label=${label}>
    <path d=${ICONS[n]}/></svg>`;
}

function Btn({kind = 'secondary', lg, className = '', ...p}){
  return html`<button type="button" className=${'btn btn-' + kind + (lg ? ' btn-lg' : '') + (className ? ' ' + className : '')} ...${p}/>`;
}

let fid = 0;
const useId = (p) => { const r = useRef(null); if(!r.current) r.current = (p || 'f') + (++fid); return r.current; };

/* поле с постоянной подписью; ошибка связана с полем и стоит под ним */
function Field({label, optional, error, hint, children, id}){
  const auto = useId('f'), fid = id || auto, eid = fid + '-e';
  const child = React.Children.only(children);
  const ctl = React.cloneElement(child, {id:fid, 'aria-invalid':error ? 'true' : undefined, 'aria-describedby':error ? eid : hint ? eid : undefined});
  return html`<div className="field">
    <label className="l" htmlFor=${fid}>${label}${optional && html`<small>необязательно</small>`}</label>
    ${ctl}
    ${error ? html`<span className="err" id=${eid}>${error}</span>` : hint ? html`<span className="hint" id=${eid}>${hint}</span>` : null}
  </div>`;
}

function Seg({value, options, onChange, label}){
  return html`<div className="seg" role="group" aria-label=${label}>
    ${options.map(([v, t]) => html`<button type="button" key=${v} aria-pressed=${value === v ? 'true' : 'false'} onClick=${() => onChange(v)}>${t}</button>`)}
  </div>`;
}

/* всплывающее меню: закрывается щелчком мимо и Esc, фокус возвращается на кнопку */
function useMenu(){
  const [open, setOpen] = useState(false);
  const btn = useRef(null), box = useRef(null);
  useEffect(() => {
    if(!open) return;
    const down = e => { if(box.current && !box.current.contains(e.target) && !btn.current.contains(e.target)) setOpen(false); };
    const key = e => { if(e.key === 'Escape'){ e.stopPropagation(); setOpen(false); btn.current && btn.current.focus(); } };
    document.addEventListener('pointerdown', down); document.addEventListener('keydown', key, true);
    requestAnimationFrame(() => { const f = box.current && box.current.querySelector('[role^=menuitem]'); if(f) f.focus(); });
    if(box.current && Motion.animate && !Anim.reduced()) Motion.animate(box.current, {opacity:[0,1], transform:['translateY(-4px) scale(.98)','translateY(0px) scale(1)']}, {type:'spring', visualDuration:.22, bounce:0});
    return () => { document.removeEventListener('pointerdown', down); document.removeEventListener('keydown', key, true); };
  }, [open]);
  const onMenuKey = e => {
    if(e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = Array.from(box.current.querySelectorAll('[role^=menuitem]')), i = items.indexOf(document.activeElement);
    const n = items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]; if(n) n.focus();
  };
  return {open, setOpen, btn, box, onMenuKey};
}

/* ---------- движение (Motion): пружина без отскока, уход быстрее прихода ---------- */
const Anim = {
  reduced: () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches),
  on: () => !!(window.Motion && Motion.animate) && !Anim.reduced(),
  modalIn(el, scrim){
    if(!Anim.on() || !el) return;
    Motion.animate(el, {transform:['translateY(12px) scale(.985)','translateY(0px) scale(1)'], opacity:[0,1]}, {type:'spring', visualDuration:.32, bounce:0, opacity:{duration:.14}});
    if(scrim) Motion.animate(scrim, {opacity:[0,1]}, {duration:.2, ease:'easeOut'});
  },
  modalOut(el, scrim){
    if(!Anim.on() || !el) return Promise.resolve();
    if(scrim) Motion.animate(scrim, {opacity:[1,0]}, {duration:.16});
    return Motion.animate(el, {transform:['translateY(0px) scale(1)','translateY(8px) scale(.985)'], opacity:[1,0]}, {duration:.14, ease:[.4,0,1,1]}).then(() => {}, () => {});
  },
  page(el){
    if(!Anim.on() || !el) return;
    Motion.animate(el, {opacity:[0,1], transform:['translateY(6px)','translateY(0px)']}, {type:'spring', visualDuration:.28, bounce:0, opacity:{duration:.14}})
      .then(() => { el.style.transform = ''; }, () => {});
  },
  push(el, dir){
    if(!Anim.on() || !el) return;
    Motion.animate(el, {transform:['translateX(' + (dir === 'back' ? -24 : 24) + 'px)','translateX(0px)'], opacity:[0,1]}, {type:'spring', visualDuration:.32, bounce:0, opacity:{duration:.1}});
  },
  reveal(el){
    if(!Anim.on() || !el) return;
    Motion.animate(el, {opacity:[0,1], transform:['translateY(-4px)','translateY(0px)']}, {type:'spring', visualDuration:.26, bounce:0});
  },
  /* блоки появляются по очереди: короткий подъём, шаг 35 мс, не дольше 8 шагов */
  stagger(els, y = 8){
    if(!Anim.on()) return;
    Array.from(els).forEach((el, i) => {
      const delay = Math.min(i, 8) * .035;
      el.style.opacity = '0';
      Motion.animate(el, {opacity:[0,1], transform:['translateY(' + y + 'px)','translateY(0px)']}, {type:'spring', visualDuration:.36, bounce:0, delay, opacity:{duration:.22, delay}})
        .then(() => { el.style.transform = ''; el.style.opacity = ''; }, () => { el.style.opacity = ''; });
    });
  },
  /* раскрытие свёрнутого: высота от нуля до своей, содержимое проявляется */
  expand(el){
    if(!Anim.on() || !el) return;
    const h = el.offsetHeight; el.style.overflow = 'hidden';
    Motion.animate(el, {height:['0px', h + 'px'], opacity:[0,1]}, {type:'spring', visualDuration:.32, bounce:0, opacity:{duration:.2, delay:.04}})
      .then(() => { el.style.height = ''; el.style.overflow = ''; el.style.opacity = ''; }, () => {});
  },
  /* сворачивание: высота уходит в ноль, потом содержимое убирается */
  collapse(el){
    if(!Anim.on() || !el) return Promise.resolve();
    el.style.overflow = 'hidden';
    return Motion.animate(el, {height:[el.offsetHeight + 'px', '0px'], opacity:[1,0]}, {duration:.2, ease:[.4,0,.2,1]}).then(() => {}, () => {});
  },
  /* уход карточки после решения: гаснет и чуть уменьшается, потом остальные подтягиваются */
  leave(el){
    if(!Anim.on() || !el) return Promise.resolve();
    return Motion.animate(el, {opacity:[1,0], transform:['scale(1)','scale(.97)']}, {duration:.18, ease:[.4,0,1,1]}).then(() => {}, () => {});
  },
  /* отметка: короткий отклик точкой или галочкой */
  pop(el, from = .6){
    if(!Anim.on() || !el) return;
    Motion.animate(el, {transform:['scale(' + from + ')','scale(1)']}, {type:'spring', visualDuration:.3, bounce:.35});
  }
};

/* раскрытие с движением: при открытии после первого показа содержимое разворачивается по высоте */
function useExpand(open){
  const ref = useRef(null), first = useRef(true);
  useLayoutEffect(() => { if(first.current){ first.current = false; return; } if(open) Anim.expand(ref.current); }, [open]);
  return ref;
}

/* перестановка без скачков: элементы с data-flip едут со старого места на новое, новые проявляются.
   Места считаются от контейнера, поэтому прокрутка окна их не сбивает */
function useFlip(ref){
  const rects = useRef(null);
  useLayoutEffect(() => {
    const root = ref.current; if(!root) return;
    const base = root.getBoundingClientRect(), next = new Map(), was = rects.current;
    root.querySelectorAll('[data-flip]').forEach(el => {
      const r = el.getBoundingClientRect(), k = el.dataset.flip, top = r.top - base.top, left = r.left - base.left;
      next.set(k, {top, left});
      if(!was || !Anim.on()) return;
      const o = was.get(k);
      if(!o){ Motion.animate(el, {opacity:[0,1], transform:['translateY(6px)','translateY(0px)']}, {type:'spring', visualDuration:.34, bounce:0, opacity:{duration:.2}}); return; }
      const dx = o.left - left, dy = o.top - top;
      if(Math.abs(dx) > 1 || Math.abs(dy) > 1) Motion.animate(el, {transform:['translate(' + dx + 'px,' + dy + 'px)','translate(0px,0px)']}, {type:'spring', visualDuration:.42, bounce:0})
        .then(() => { el.style.transform = ''; }, () => {});
    });
    rects.current = next;
  });
}

/* выбор с обязательным комментарием: «Вернуть на доработку» сначала открывает поле */
function Decide({actions, extra}){
  const [open, setOpen] = useState(null), [text, setText] = useState(''), [err, setErr] = useState('');
  const box = useRef(null), area = useRef(null);
  useEffect(() => { if(open){ Anim.reveal(box.current); area.current && area.current.focus(); } }, [open]);
  const a = open != null ? actions[open] : null;
  const go = () => {
    if(a.need && !text.trim()){ setErr('Напишите комментарий: без него ' + a.whom + ' не поймёт, что исправить'); area.current.focus(); return; }
    a.run(text.trim()); setOpen(null); setText(''); setErr('');
  };
  if(a) return html`<div ref=${box} className="decide">
    ${a.note && html`<p className="now-m" style=${{margin:'10px 0 10px'}}>${a.note}</p>`}
    <${Field} label=${a.field || 'Комментарий'} optional=${!a.need} error=${err}>
      <textarea ref=${area} className="inp" rows="3" value=${text} onInput=${e => { setText(e.target.value); setErr(''); }}
        onKeyDown=${e => { if(e.key === 'Escape'){ e.stopPropagation(); setOpen(null); } }}/>
    <//>
    <div className="row is-end">
      <${Btn} kind="ghost" onClick=${() => { setOpen(null); setErr(''); }}>Отмена<//>
      <${Btn} kind=${a.kind === 'danger' ? 'danger' : 'primary'} onClick=${go}>${a.confirm || a.label}<//>
    </div>
  </div>`;
  if(!actions.length && !extra) return null;
  /* отмена и отказ — слева, решение — справа, главная кнопка крайняя справа */
  const b = ([x, i]) => html`<${Btn} key=${i} kind=${x.kind || 'secondary'} disabled=${x.disabled} onClick=${() => x.ask ? setOpen(i) : x.run('')}>${x.label}<//>`;
  const all = actions.map((x, i) => [x, i]);
  return html`<div className="row acts">
    ${extra}${all.filter(([x]) => x.kind === 'danger').map(b)}
    <div className="acts-r">${all.filter(([x]) => x.kind !== 'danger').reverse().map(b)}</div>
  </div>`;
}

/* шапка модального окна: страница сама говорит, что показать, а окно держит место и крестик */
const ModalSlot = React.createContext(null);
/* strip — полоса пути под шапкой: она не прокручивается вместе с окном, поэтому видна всегда */
function ModalHead({title, sub, badge, stop, strip, children}){
  const slot = React.useContext(ModalSlot);
  if(!slot || !slot.head) return null;
  return html`<${Fragment}>${strip && slot.strip && ReactDOM.createPortal(strip, slot.strip)}${ReactDOM.createPortal(html`<${Fragment}>
    <div className="m-t">
      <h1 className="m-title" tabIndex="-1" data-autofocus="true">${title}</h1>
      ${sub && html`<div className="m-sub">${sub}</div>`}
    </div>
    ${children}
  <//>`, slot.head)}<//>`;
}
/* кнопки решения внизу окна: не прокручиваются, человек читает сверху вниз и решает в конце */
function ModalFoot({children}){
  const slot = React.useContext(ModalSlot);
  return slot && slot.foot ? ReactDOM.createPortal(children, slot.foot) : null;
}
/* ссылка «назад» под заголовком окна: к заявке из кандидата и из доработки */
function BackLink({href, children}){
  return html`<a className="m-back" href=${href} onClick=${e => { e.preventDefault(); Panel.leave(() => go(href)); }}><${Icon} n="back" s=${14}/>${children}</a>`;
}

/* дата для <input type=date> и обратно */
const toInput = t => { if(!t) return ''; const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); };
const fromInput = s => { if(!s) return null; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 10).getTime(); };
const name = id => id ? Model.PEOPLE[id].name : '';
const shortName = id => id ? Model.short(Model.PEOPLE[id].name) : '';

/* ---------- поля как в shadcn/ui: список, календарь, число ----------
   Всплывающее окно рисуется поверх всего (портал в body) и встаёт под полем или над ним,
   если снизу не хватает места. Закрывается щелчком мимо, Esc и Tab. */
function usePop(open, setOpen, trig){
  const pop = useRef(null), [pos, setPos] = useState(null);
  useLayoutEffect(() => {
    if(!open){ setPos(null); return; }
    const place = () => {
      if(!trig.current) return;
      const r = trig.current.getBoundingClientRect(), h = pop.current ? pop.current.offsetHeight : 0, w = pop.current ? pop.current.offsetWidth : 0;
      const below = innerHeight - r.bottom - 8, up = h > below && r.top > below;
      setPos({left:Math.max(8, Math.min(r.left, innerWidth - w - 8)), top:up ? r.top - h - 6 : r.bottom + 6, width:r.width});
    };
    place();
    const down = e => { if(pop.current && !pop.current.contains(e.target) && trig.current && !trig.current.contains(e.target)) setOpen(false); };
    const sc = e => { if(pop.current && pop.current.contains(e.target)) return; place(); };
    document.addEventListener('pointerdown', down); addEventListener('scroll', sc, true); addEventListener('resize', place);
    if(pop.current && Anim.on()) Motion.animate(pop.current, {opacity:[0,1], transform:['translateY(-4px) scale(.98)','translateY(0px) scale(1)']}, {type:'spring', visualDuration:.2, bounce:0});
    return () => { document.removeEventListener('pointerdown', down); removeEventListener('scroll', sc, true); removeEventListener('resize', place); };
  }, [open]);
  return {pop, style:pos ? {left:pos.left, top:pos.top, minWidth:pos.width} : {left:0, top:0, visibility:'hidden'}};
}
const escKey = (e, close) => { if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); close(); return true; } return false; };

/* список: options — [[значение, подпись, пояснение?]] или просто строки */
function Select({value, options, onChange, placeholder = 'Выберите', id, label, 'aria-invalid':inv, 'aria-describedby':db, 'data-k':dk, className}){
  const [open, setOpen] = useState(false), [act, setAct] = useState(0), trig = useRef(null);
  const {pop, style} = usePop(open, setOpen, trig);
  const opts = options.map(o => Array.isArray(o) ? o : [o, o]);
  const cur = opts.find(o => o[0] === value);
  useEffect(() => { if(open) setAct(Math.max(0, opts.findIndex(o => o[0] === value))); }, [open]);
  useEffect(() => { const el = open && pop.current && pop.current.querySelector('[data-i="' + act + '"]'); if(el) el.scrollIntoView({block:'nearest'}); }, [act, open]);
  const pick = v => { onChange(v); setOpen(false); trig.current && trig.current.focus(); };
  const key = e => {
    if(!open){ if(['ArrowDown','ArrowUp','Enter',' '].includes(e.key)){ e.preventDefault(); setOpen(true); } return; }
    if(escKey(e, () => setOpen(false))) return;
    if(e.key === 'ArrowDown'){ e.preventDefault(); setAct(Math.min(opts.length - 1, act + 1)); }
    else if(e.key === 'ArrowUp'){ e.preventDefault(); setAct(Math.max(0, act - 1)); }
    else if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); if(opts[act]) pick(opts[act][0]); }
    else if(e.key === 'Tab') setOpen(false);
  };
  return html`<${Fragment}>
    <button type="button" ref=${trig} id=${id} data-k=${dk} className=${'inp sel' + (cur ? '' : ' is-empty') + (className ? ' ' + className : '')} aria-haspopup="listbox" aria-expanded=${open}
      aria-invalid=${inv} aria-describedby=${db} aria-label=${label} onClick=${() => setOpen(!open)} onKeyDown=${key}>
      <span className="sel-v">${cur ? cur[1] : placeholder}</span><${Icon} n="updown" s=${15}/>
    </button>
    ${open && ReactDOM.createPortal(html`<div className="pop pop-list" ref=${pop} role="listbox" style=${style}>
      ${opts.map((o, i) => html`<div key=${o[0]} data-i=${i} role="option" aria-selected=${o[0] === value} className=${'opt' + (i === act ? ' is-act' : '')}
        onPointerMove=${() => setAct(i)} onClick=${() => pick(o[0])}>
        <span className="opt-t">${o[1]}${o[2] && html`<small>${o[2]}</small>`}</span>${o[0] === value && html`<${Icon} n="check" s=${15}/>`}
      </div>`)}
    </div>`, document.body)}
  <//>`;
}

/* календарь: значение — строка ГГГГ-ММ-ДД; дни раньше min недоступны */
const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const MONTHS_G = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const fromYmd = s => { if(!s) return null; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const sameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
function DatePicker({value, onChange, min, id, placeholder = 'Выберите дату', 'aria-invalid':inv, 'aria-describedby':db, 'data-k':dk}){
  const [open, setOpen] = useState(false), trig = useRef(null), grid = useRef(null);
  const {pop, style} = usePop(open, setOpen, trig);
  const sel = fromYmd(value), minD = fromYmd(min), today = new Date();
  const [fd, setFd] = useState(sel || today);
  useEffect(() => { if(open) setFd(sel || (minD && minD > today ? minD : today)); }, [open]);
  useEffect(() => { const b = open && grid.current && grid.current.querySelector('[tabindex="0"]'); if(b) b.focus({preventScroll:true}); }, [fd, open]);
  const y = fd.getFullYear(), m = fd.getMonth(), shift = (new Date(y, m, 1).getDay() + 6) % 7, n = new Date(y, m + 1, 0).getDate();
  const cells = Array.from({length:shift}, () => null).concat(Array.from({length:n}, (_, i) => new Date(y, m, i + 1)));
  const off = d => minD && d < minD;
  const move = days => { const d = new Date(fd); d.setDate(d.getDate() + days); setFd(d); };
  const month = k => setFd(new Date(y, m + k, Math.min(fd.getDate(), new Date(y, m + k + 1, 0).getDate())));
  const pick = d => { if(off(d)) return; onChange(ymd(d)); setOpen(false); trig.current && trig.current.focus(); };
  const key = e => {
    if(escKey(e, () => { setOpen(false); trig.current && trig.current.focus(); })) return;
    const k = {ArrowLeft:-1, ArrowRight:1, ArrowUp:-7, ArrowDown:7}[e.key];
    if(k){ e.preventDefault(); move(k); }
    if(e.key === 'PageUp' || e.key === 'PageDown'){ e.preventDefault(); month(e.key === 'PageUp' ? -1 : 1); }
  };
  return html`<${Fragment}>
    <button type="button" ref=${trig} id=${id} data-k=${dk} className=${'inp sel' + (sel ? '' : ' is-empty')} aria-haspopup="dialog" aria-expanded=${open}
      aria-invalid=${inv} aria-describedby=${db} onClick=${() => setOpen(!open)} onKeyDown=${e => { if(open) escKey(e, () => setOpen(false)); }}>
      <span className="sel-v num">${sel ? sel.getDate() + ' ' + MONTHS_G[sel.getMonth()] + ' ' + sel.getFullYear() : placeholder}</span><${Icon} n="cal" s=${16}/>
    </button>
    ${open && ReactDOM.createPortal(html`<div className="pop cal" ref=${pop} role="dialog" aria-label="Выбор даты" style=${style} onKeyDown=${key}>
      <div className="cal-h">
        <button type="button" className="cal-nav" aria-label="Предыдущий месяц" onClick=${() => month(-1)}><${Icon} n="back" s=${16}/></button>
        <span className="cal-t" aria-live="polite">${MONTHS[m]} ${y}</span>
        <button type="button" className="cal-nav" aria-label="Следующий месяц" onClick=${() => month(1)}><${Icon} n="chev" s=${16}/></button>
      </div>
      <div className="cal-g" role="grid" ref=${grid}>
        ${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d => html`<span key=${d} className="cal-w" role="columnheader">${d}</span>`)}
        ${cells.map((d, i) => d ? html`<button type="button" key=${i} role="gridcell" tabIndex=${sameDay(d, fd) ? 0 : -1} disabled=${off(d)}
            className=${'cal-d' + (sameDay(d, sel) ? ' is-sel' : '') + (sameDay(d, today) ? ' is-today' : '')} aria-selected=${sameDay(d, sel)}
            aria-label=${d.getDate() + ' ' + MONTHS_G[d.getMonth()]} onClick=${() => pick(d)}>${d.getDate()}</button>` : html`<span key=${i}/>`)}
      </div>
    </div>`, document.body)}
  <//>`;
}

/* только цифры, разряды через пробел */
const digits = s => String(s || '').replace(/\D/g, '');
const groupDigits = s => digits(s).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
function NumInput({value, onChange, suffix, ...p}){
  return html`<div className="num-inp"><input className="inp num" inputMode="numeric" autoComplete="off" ...${p} value=${groupDigits(value)}
    onInput=${e => onChange(digits(e.target.value))}/>${suffix && html`<span className="num-suf" aria-hidden="true">${suffix}</span>`}</div>`;
}
/* сколько человек: минус, число, плюс */
function Counter({value, onChange, min = 1, max = 50, id, label}){
  const v = +value || min;
  return html`<div className="counter" role="group" aria-label=${label}>
    <button type="button" className="icon-btn" aria-label="Меньше" disabled=${v <= min} onClick=${() => onChange(String(v - 1))}><${Icon} n="minus" s=${16}/></button>
    <input id=${id} className="inp num" inputMode="numeric" value=${value} onInput=${e => { const d = digits(e.target.value).slice(0, 2); onChange(d); }}
      onBlur=${() => onChange(String(Math.min(max, Math.max(min, +value || min))))}/>
    <button type="button" className="icon-btn" aria-label="Больше" disabled=${v >= max} onClick=${() => onChange(String(v + 1))}><${Icon} n="plus" s=${16}/></button>
  </div>`;
}
