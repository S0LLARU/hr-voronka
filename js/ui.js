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
  panelIn(el, scrim){
    if(!Anim.on() || !el) return;
    Motion.animate(el, {transform:['translateX(56px)','translateX(0px)'], opacity:[0,1]}, {type:'spring', visualDuration:.36, bounce:0, opacity:{duration:.12}});
    if(scrim) Motion.animate(scrim, {opacity:[0,1]}, {duration:.2, ease:'easeOut'});
  },
  panelOut(el, scrim){
    if(!Anim.on() || !el) return Promise.resolve();
    if(scrim) Motion.animate(scrim, {opacity:[1,0]}, {duration:.16});
    return Motion.animate(el, {transform:['translateX(0px)','translateX(56px)'], opacity:[1,0]}, {duration:.16, ease:[.4,0,1,1]}).then(() => {}, () => {});
  },
  push(el, dir){
    if(!Anim.on() || !el) return;
    Motion.animate(el, {transform:['translateX(' + (dir === 'back' ? -24 : 24) + 'px)','translateX(0px)'], opacity:[0,1]}, {type:'spring', visualDuration:.32, bounce:0, opacity:{duration:.1}});
  },
  reveal(el){
    if(!Anim.on() || !el) return;
    Motion.animate(el, {opacity:[0,1], transform:['translateY(-4px)','translateX(0px)']}, {type:'spring', visualDuration:.26, bounce:0});
  }
};

/* выбор с обязательным комментарием: «Вернуть на доработку» сначала открывает поле */
function Decide({actions}){
  const [open, setOpen] = useState(null), [text, setText] = useState(''), [err, setErr] = useState('');
  const box = useRef(null), area = useRef(null);
  useEffect(() => { if(open){ Anim.reveal(box.current); area.current && area.current.focus(); } }, [open]);
  const a = open != null ? actions[open] : null;
  const go = () => {
    if(a.need && !text.trim()){ setErr('Напишите комментарий: без него ' + a.whom + ' не поймёт, что исправить'); area.current.focus(); return; }
    a.run(text.trim()); setOpen(null); setText(''); setErr('');
  };
  if(a) return html`<div ref=${box} className="decide">
    <${Field} label=${a.need ? 'Комментарий' : 'Комментарий'} optional=${!a.need} error=${err}>
      <textarea ref=${area} className="inp" rows="3" value=${text} onInput=${e => { setText(e.target.value); setErr(''); }}
        onKeyDown=${e => { if(e.key === 'Escape'){ e.stopPropagation(); setOpen(null); } }}/>
    <//>
    <div className="row">
      <${Btn} kind=${a.kind === 'danger' ? 'danger' : 'primary'} onClick=${go}>${a.confirm || a.label}<//>
      <${Btn} kind="ghost" onClick=${() => { setOpen(null); setErr(''); }}>Отмена<//>
    </div>
  </div>`;
  return html`<div className="row">
    ${actions.map((x, i) => html`<${Btn} key=${i} kind=${x.kind || 'secondary'} disabled=${x.disabled}
      onClick=${() => x.ask ? setOpen(i) : x.run('')}>${x.label}<//>`)}
  </div>`;
}

/* дата для <input type=date> и обратно */
const toInput = t => { if(!t) return ''; const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); };
const fromInput = s => { if(!s) return null; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 10).getTime(); };
const name = id => id ? Model.PEOPLE[id].name : '';
const shortName = id => id ? Model.short(Model.PEOPLE[id].name) : '';
