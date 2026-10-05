/* Приложение: меню слева, полоса сверху, под ней доска. Заявка, кандидат и форма открываются
   модальным окном поверх доски, поэтому после решения видно, как карточка переезжает.
   Адрес отражает, что открыто: #/r/<заявка>, #/r/<заявка>/c/<кандидат>, #/r/<заявка>/add,
   #/r/<заявка>/edit, #/new — ссылку можно отправить, назад работает. */
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

/* «Смотрю как» вместо входа: внизу меню, как карточка пользователя */
const GROUPS = [['Руководители', 'manager'], ['HR', 'hrd recruiter'], ['Согласование', 'finance ceo'], ['IT', 'it']];
function RolePicker(){
  const v = useViewer(), m = useMenu(), [sure, setSure] = useState(false);
  useEffect(() => { if(!m.open) setSure(false); }, [m.open]);
  const me = Model.PEOPLE[v];
  return html`<div className="side-foot">
    ${m.open && html`<div className="menu" role="menu" aria-label="Смотреть как" ref=${m.box} onKeyDown=${m.onMenuKey} style=${{left:0, right:0, bottom:'calc(100% + 6px)'}}>
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
    <button className="who" ref=${m.btn} aria-haspopup="menu" aria-expanded=${m.open} aria-label=${'Смотрю как: ' + me.name} onClick=${() => m.setOpen(!m.open)}>
      <span className="ava" aria-hidden="true"><${Icon} n="user" s=${17}/></span>
      <span className="who-t"><span className="who-n">${me.name}</span><span className="who-r">${Model.ROLE[me.role]}${me.dept ? ', ' + me.dept : ''}</span></span>
      <span className="who-c" aria-hidden="true"><${Icon} n="updown" s=${16}/></span>
    </button>
  </div>`;
}

function Sidebar({onNav}){
  return html`<nav className="side" aria-label="Разделы">
    <div className="brand">
      <span className="brand-i" aria-hidden="true"><${Icon} n="funnel" s=${19}/></span>
      <span><span className="brand-n">Galamat HR</span><span className="brand-s">Воронка найма</span></span>
    </div>
    <div className="nav">
      <a href="#/" aria-current="page" onClick=${e => { e.preventDefault(); onNav('#/'); }}><${Icon} n="board" s=${17}/>Заявки на подбор</a>
    </div>
    <${RolePicker}/>
  </nav>`;
}

/* крошки: путь до открытого; переход проходит через защиту несохранённого */
function Crumbs({items}){
  return html`<ol className="crumbs" aria-label="Где вы">
    ${items.map(([t, h], i) => html`<li key=${i}>
      ${i > 0 && html`<${Icon} n="chev" s=${14}/>`}
      ${h ? html`<a href=${h} onClick=${e => { e.preventDefault(); Panel.leave(() => go(h)); }}>${t}</a>` : html`<span className="cur" aria-current="page">${t}</span>`}
    </li>`)}
  </ol>`;
}

function BoardPage({S, v, now, focusId}){
  const [q, setQ] = useState(''), [onlyMine, setOnlyMine] = useState(false);
  const visible = S.requests.filter(r => Model.visible(r, v));
  const ql = q.trim().toLowerCase();
  const match = r => !ql || [r.title, r.dept, r.project, name(r.manager), name(r.recruiter), ...r.candidates.map(c => c.name)].some(s => s && s.toLowerCase().includes(ql));
  const mineCount = visible.filter(r => isMine(r, v)).length;
  const list = visible.filter(r => match(r) && (!onlyMine || isMine(r, v)));
  useEffect(() => { if(onlyMine && !mineCount) setOnlyMine(false); }, [v, mineCount]);
  return html`<div className="board-page">
    <h1 className="sr">Заявки на подбор</h1>
    <div className="tools">
      <div className="pills" role="group" aria-label="Какие заявки показать">
        <button aria-pressed=${!onlyMine} onClick=${() => setOnlyMine(false)}>Все <span className="n num">${visible.length}</span></button>
        <button aria-pressed=${onlyMine} disabled=${!mineCount} onClick=${() => setOnlyMine(true)}>Мой ход <span className="n num">${mineCount}</span></button>
      </div>
      <label className="search"><span className="sr">Поиск заявок</span><${Icon} n="search"/>
        <input type="search" value=${q} onInput=${e => setQ(e.target.value)} placeholder="Должность, проект, человек"/></label>
    </div>
    ${ql && !list.length ? html`<p className="empty-line">По запросу «${q.trim()}» заявок нет</p>` : null}
    <${Board} list=${list} v=${v} now=${now} current=${focusId} onOpen=${id => go('#/r/' + id)} version=${Store.version()}/>
  </div>`;
}

function App(){
  const S = useStore(), v = useViewer(), now = useNow(), hash = useHash(), route = parse(hash);
  const me = Model.PEOPLE[v];
  const [side, setSide] = useState(() => { try { return localStorage.getItem('hr-side') !== '0'; } catch(e) { return true; } });
  const [drawer, setDrawer] = useState(false);
  const narrow = () => matchMedia('(max-width:900px)').matches;
  const toggleSide = () => {
    if(narrow()){ setDrawer(!drawer); return; }
    const n = !side; setSide(n); try { localStorage.setItem('hr-side', n ? '1' : '0'); } catch(e) {}
  };
  const nav = h => { setDrawer(false); Panel.leave(() => go(h)); };

  /* ---------- модальное окно поверх доски ---------- */
  const req = route.id ? S.requests.find(r => r.id === route.id && Model.visible(r, v)) : null;
  const open = !!(route.form === 'new' || req);
  const [shown, setShown] = useState(open ? route : null);
  const [slot, setSlot] = useState(null);
  const lastId = useRef(null), modal = useRef(null), scrim = useRef(null), main = useRef(null), body = useRef(null), wasShown = useRef(false);
  useEffect(() => {
    setDrawer(false);
    if(open){ setShown(route); if(route.id) lastId.current = route.id; return; }
    if(route.id && !req){ go('#/'); return; }
    if(shown){
      Anim.modalOut(modal.current, scrim.current).then(() => setShown(null));
    }
  }, [hash, !!req]);
  useLayoutEffect(() => {
    if(shown && !wasShown.current) Anim.modalIn(modal.current, scrim.current);
    wasShown.current = !!shown;
    if(main.current){ if(shown) main.current.setAttribute('inert', ''); else main.current.removeAttribute('inert'); }
    /* окно закрыто — фокус на карточке заявки, которая была открыта */
    if(!shown){ const c = lastId.current && document.querySelector('[data-card="' + lastId.current + '"]'); if(c) c.focus({preventScroll:false}); }
  }, [!!shown]);

  /* Esc — на уровень выше: из кандидата в заявку, из заявки на доску */
  const up = !shown ? null : shown.form ? (shown.id ? '#/r/' + shown.id : '#/') : shown.view === 'cand' || shown.view === 'add' ? '#/r/' + shown.id : '#/';
  useEffect(() => {
    if(!up) return;
    const key = e => { if(e.key === 'Escape' && !e.defaultPrevented && !e.target.closest('.menu')){ e.preventDefault(); Panel.leave(() => go(up)); } };
    addEventListener('keydown', key); return () => removeEventListener('keydown', key);
  }, [up]);
  const close = () => Panel.leave(() => go('#/'));

  /* смена содержимого окна: прокрутка наверх, короткое появление, фокус на заголовке */
  const key = shown ? (shown.form ? 'form' + (shown.id || '') : shown.id + (shown.view || '') + (shown.cid || '')) : '';
  const prevKey = useRef('');
  useLayoutEffect(() => {
    if(!shown || !body.current) return;
    body.current.scrollTop = 0;
    if(prevKey.current && prevKey.current !== key) Anim.page(body.current.firstElementChild);
    prevKey.current = key;
    const f = modal.current && modal.current.querySelector('[data-autofocus]'); if(f) f.focus({preventScroll:true});
  }, [key, slot]);
  useEffect(() => { if(!shown) prevKey.current = ''; }, [!!shown]);

  const sr = shown && shown.id ? S.requests.find(r => r.id === shown.id) : null;
  let content = null, wide = true, label = '';
  if(shown && shown.form){
    const fr = shown.form === 'edit' ? sr : null;
    wide = false; label = fr ? fr.title : 'Новая заявка';
    if(shown.form === 'new' || fr) content = html`<${RequestForm} key=${key} r=${fr} onClose=${id => { Panel.leave = f => f(); go(id ? '#/r/' + id : '#/'); }}/>`;
  } else if(sr){
    const c = shown.cid && sr.candidates.find(x => x.id === shown.cid);
    label = shown.view === 'cand' && c ? c.name : sr.title; wide = shown.view !== 'add';
    content = html`<${RequestPage} key=${sr.id} r=${sr} view=${shown.view} cid=${shown.cid}/>`;
  }
  const canCreate = me.role === 'manager' || me.role === 'hrd';

  return html`<div className=${'app' + (side ? '' : ' is-collapsed') + (drawer ? ' is-drawer' : '')}>
    <div ref=${main} style=${{display:'contents'}}>
      <${Sidebar} onNav=${nav}/>
      ${drawer && html`<div className="scrim" onClick=${() => setDrawer(false)}/>`}
      <div className="main">
        <header className="bar">
          <button className="icon-btn" aria-label=${side && !drawer ? 'Скрыть меню' : 'Показать меню'} onClick=${toggleSide}><${Icon} n="side" s=${18}/></button>
          <${Crumbs} items=${[['Заявки на подбор']]}/>
          ${canCreate && html`<${Btn} kind="primary" aria-label="Создать заявку" onClick=${() => nav('#/new')}><${Icon} n="plus"/><span className="hide-s">Создать заявку</span><//>`}
        </header>
        <main className="content"><${BoardPage} S=${S} v=${v} now=${now} focusId=${shown && shown.id}/></main>
      </div>
    </div>
    ${shown && html`<${Fragment}>
      <div className="scrim is-modal" ref=${scrim} onClick=${close}/>
      <div className="modal-wrap">
      <div className=${'modal' + (wide ? '' : ' is-narrow')} ref=${modal} role="dialog" aria-modal="true" aria-label=${label}>
        <div className="m-head">
          <div className="m-slot" ref=${setSlot}/>
          <button className="icon-btn m-x" aria-label="Закрыть" onClick=${close}><${Icon} n="x" s=${18}/></button>
        </div>
        <div className="m-body" ref=${body}><${ModalSlot.Provider} value=${slot}>${content}<//></div>
      </div>
      </div>
    <//>`}
  </div>`;
}

ReactDOM.createRoot(document.getElementById('root')).render(html`<${App}/>`);
