/* Приложение: верхняя полоса, доска заявок и панель справа. Адрес отражает, что открыто:
   #/r/<заявка>, #/r/<заявка>/c/<кандидат>, #/new — ссылку можно отправить, назад работает. */
'use strict';

function parse(h){
  const p = h.replace(/^#\/?/, '').split('/').filter(Boolean);
  if(p[0] === 'new') return {form:'new'};
  if(p[0] === 'r' && p[1]){
    if(p[2] === 'edit') return {id:p[1], form:'edit'};
    if(p[2] === 'c' && p[3]) return {id:p[1], view:'cand', cid:p[3]};
    if(p[2] === 'add') return {id:p[1], view:'add'};
    return {id:p[1], view:'main'};
  }
  return {};
}
function useHash(){
  const [h, set] = useState(location.hash);
  useEffect(() => { const f = () => set(location.hash); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  return h;
}

const GROUPS = [['Руководители', 'manager'], ['HR', 'hrd recruiter'], ['Согласование', 'finance ceo'], ['IT', 'it']];
function RolePicker(){
  const v = useViewer(), m = useMenu(), [sure, setSure] = useState(false);
  useEffect(() => { if(!m.open) setSure(false); }, [m.open]);
  const me = Model.PEOPLE[v];
  return html`<div style=${{position:'relative'}}>
    <button className="who" ref=${m.btn} aria-haspopup="menu" aria-expanded=${m.open} onClick=${() => m.setOpen(!m.open)}>
      <span><span className="who-n">${me.name}</span><span className="who-r">${Model.ROLE[me.role]}${me.dept ? ', ' + me.dept : ''}</span></span>
      <${Icon} n="down" s=${14}/>
    </button>
    ${m.open && html`<div className="menu" role="menu" aria-label="Смотреть как" ref=${m.box} onKeyDown=${m.onMenuKey} style=${{right:0, top:44}}>
      ${GROUPS.map(([t, roles]) => html`<${Fragment} key=${t}>
        <div className="menu-sec">${t}</div>
        ${Object.entries(Model.PEOPLE).filter(([, p]) => roles.split(' ').includes(p.role)).map(([id, p]) => html`
          <button key=${id} className="menu-item" role="menuitemradio" aria-checked=${id === v} onClick=${() => { Store.setViewer(id); m.setOpen(false); m.btn.current.focus(); }}>
            <span>${p.name}</span><small>${p.dept || Model.ROLE[p.role]}</small></button>`)}
      <//>`)}
      <hr/>
      <button className="menu-item" role="menuitem" onClick=${() => { if(!sure){ setSure(true); return; } Store.reset(); m.setOpen(false); go('#/'); }}>
        <span>${sure ? 'Точно? Ваши изменения пропадут' : 'Вернуть демонстрационные данные'}</span></button>
    </div>`}
  </div>`;
}

function App(){
  const S = useStore(), v = useViewer(), now = useNow(), hash = useHash(), route = parse(hash);
  const [q, setQ] = useState(''), [onlyMine, setOnlyMine] = useState(false);
  const me = Model.PEOPLE[v];

  const visible = S.requests.filter(r => Model.visible(r, v));
  const ql = q.trim().toLowerCase();
  const match = r => !ql || [r.title, r.dept, r.project, name(r.manager), name(r.recruiter), ...r.candidates.map(c => c.name)].some(s => s && s.toLowerCase().includes(ql));
  const mineCount = visible.filter(r => isMine(r, v)).length;
  const list = visible.filter(r => match(r) && (!onlyMine || isMine(r, v)));
  useEffect(() => { if(onlyMine && !mineCount) setOnlyMine(false); }, [v]);

  /* ---------- панель ---------- */
  const open = !!(route.id || route.form);
  const req = route.id ? S.requests.find(r => r.id === route.id && Model.visible(r, v)) : null;
  const [shown, setShown] = useState(open ? route : null);
  const lastId = useRef(null), panel = useRef(null), scrim = useRef(null), main = useRef(null), wasShown = useRef(false);
  useEffect(() => {
    if(open && (route.form || req)){ setShown(route); if(route.id) lastId.current = route.id; return; }
    if(route.id && !req){ go('#/'); return; }
    if(shown){
      Anim.panelOut(panel.current, scrim.current).then(() => {
        setShown(null);
        const c = lastId.current && document.querySelector('[data-card="' + lastId.current + '"]');
        if(c) c.focus({preventScroll:false});
      });
    }
  }, [hash, !!req]);
  useLayoutEffect(() => {
    if(shown && !wasShown.current) Anim.panelIn(panel.current, scrim.current);
    wasShown.current = !!shown;
    if(main.current){ if(shown) main.current.setAttribute('inert', ''); else main.current.removeAttribute('inert'); }
  }, [!!shown]);
  const close = () => Panel.leave(() => go('#/'));
  useEffect(() => {
    if(!shown) return;
    const key = e => { if(e.key === 'Escape' && !e.defaultPrevented){ e.preventDefault(); close(); } };
    addEventListener('keydown', key); return () => removeEventListener('keydown', key);
  }, [!!shown]);

  const sr = shown && shown.id ? S.requests.find(r => r.id === shown.id) : null;
  let content = null;
  if(shown && shown.form) content = html`<${RequestForm} key=${shown.form + (shown.id || '')} r=${shown.form === 'edit' ? sr : null}
    onClose=${(id, saved) => { Panel.leave = f => f(); go(id ? '#/r/' + id : '#/'); }}/>`;
  else if(sr) content = html`<${RequestPanel} key=${sr.id} r=${sr} view=${shown.view} cid=${shown.cid} onClose=${close}/>`;

  return html`<div className="app">
    <div ref=${main} className="main-wrap" style=${{display:'contents'}}>
      <header className="top">
        <span className="brand">Найм</span>
        <${RolePicker}/>
        ${(me.role === 'manager' || me.role === 'hrd') && html`<${Btn} kind="primary" aria-label="Создать заявку" onClick=${() => go('#/new')}><${Icon} n="plus"/><span className="hide-s">Создать заявку</span><//>`}
      </header>
      <div className="head">
        <h1 className="h1">Заявки на подбор</h1>
        <label className="search"><span className="sr">Поиск заявок</span><${Icon} n="search"/>
          <input type="search" value=${q} onInput=${e => setQ(e.target.value)} placeholder="Должность, проект, человек"/></label>
        ${mineCount > 0 && html`<button className="toggle" aria-pressed=${onlyMine} onClick=${() => setOnlyMine(!onlyMine)}>Мой ход <span className="n">${mineCount}</span></button>`}
      </div>
      ${ql && !list.length ? html`<p className="empty-line">По запросу «${q.trim()}» заявок нет</p>` : null}
      <${Board} list=${list} v=${v} now=${now} current=${shown && shown.id} onOpen=${id => go('#/r/' + id)} version=${Store.version()}/>
    </div>
    ${shown && html`<${Fragment}>
      <div className="scrim" ref=${scrim} onClick=${close}/>
      <aside className=${'panel' + (shown.form ? ' is-wide' : '')} ref=${panel} role="dialog" aria-modal="true" aria-label=${shown.form ? 'Заявка на подбор' : sr ? sr.title : ''}>${content}</aside>
    <//>`}
  </div>`;
}

ReactDOM.createRoot(document.getElementById('root')).render(html`<${App}/>`);
