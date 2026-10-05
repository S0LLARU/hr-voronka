/* Заявка на подбор (п. 4 ТЗ): создать, сохранить черновик, отправить в HR, доработать после возврата.
   Обязательны поля, без которых HR и Finance не смогут принять решение; остальные помечены
   «необязательно». Закрыть форму с несохранёнными изменениями молча нельзя. */
'use strict';

const EMPTY = {title:'', dept:'', project:'', manager:'', seats:'1', reason:'', reasonOther:'', duties:'', reqs:'', experience:'', skills:'', personal:'',
  education:'', extra:'', format:'Офис', location:'Алматы', schedule:'5/2, 9:00–18:00', employment:'Полная занятость', salary:'', bonus:'', probation:'3 месяца',
  start:'', priority:'normal', comment:'', files:[]};

const REQUIRED = {
  title:'Укажите должность', dept:'Выберите отдел', project:'Укажите проект', manager:'Выберите руководителя', seats:'Сколько человек нужно',
  reason:'Выберите причину', duties:'Опишите обязанности', reqs:'Опишите требования', experience:'Укажите нужный опыт', location:'Укажите локацию',
  schedule:'Укажите график', salary:'Укажите зарплату', start:'Укажите желаемую дату выхода'
};

function RequestForm({r, onClose}){
  const v = useViewer();
  const init = () => {
    if(r){ const f = {}; Object.keys(EMPTY).forEach(k => { f[k] = r[k] ?? EMPTY[k]; }); f.seats = String(r.seats); f.start = toInput(r.start); return f; }
    const me = Model.PEOPLE[v];
    return Object.assign({}, EMPTY, {manager:me.role === 'manager' ? v : '', dept:me.dept || ''});
  };
  const [f, setF] = useState(init), [err, setErr] = useState({}), [dirty, setDirty] = useState(false), [ask, setAsk] = useState(false);
  const file = useRef(null), box = useRef(null);
  const set = k => e => { const val = e && e.target ? e.target.value : e; setF(Object.assign({}, f, {[k]:val})); setDirty(true); if(err[k]) setErr(Object.assign({}, err, {[k]:''})); };
  const managers = Object.entries(Model.PEOPLE).filter(([, p]) => p.role === 'manager' || p.role === 'hrd');

  const check = () => {
    const e = {};
    Object.entries(REQUIRED).forEach(([k, m]) => { if(!String(f[k]).trim()) e[k] = m; });
    if(f.seats && (!(+f.seats >= 1) || +f.seats > 50)) e.seats = 'От 1 до 50';
    if(f.reason === 'other' && !f.reasonOther.trim()) e.reasonOther = 'Напишите причину';
    return e;
  };
  const focusFirst = e => { const k = Object.keys(e)[0]; const el = box.current.querySelector('[data-k="' + k + '"]'); if(el){ el.scrollIntoView({block:'center', behavior:Anim.on() ? 'smooth' : 'auto'}); el.focus({preventScroll:true}); } };
  const save = send => {
    if(send){ const e = check(); setErr(e); if(Object.keys(e).length){ focusFirst(e); return; } }
    else if(!f.title.trim()){ const e = {title:'Укажите должность, чтобы сохранить черновик'}; setErr(e); focusFirst(e); return; }
    const fields = Object.assign({}, f, {start:fromInput(f.start), seats:+f.seats || 1, title:f.title.trim(), project:f.project.trim()});
    let id = r && r.id;
    if(r) Store.dispatch('update', {id, fields, send});
    else id = Store.dispatch('create', {fields, send});
    setDirty(false);
    onClose(id, true);
  };
  useEffect(() => { Panel.leave = then => { if(dirty){ setAsk(() => then); return; } then(); }; });
  useEffect(() => () => { Panel.leave = f => f(); }, []);
  useEffect(() => { const t = box.current && box.current.querySelector('[data-autofocus]'); t && t.focus({preventScroll:true}); }, []);

  const inp = (k, props) => html`<input className="inp" data-k=${k} value=${f[k]} onInput=${set(k)} ...${props || {}}/>`;
  const area = (k, rows) => html`<textarea className="inp" data-k=${k} rows=${rows || 3} value=${f[k]} onInput=${set(k)}/>`;
  const returned = r && r.status === 'returned';

  return html`<${Fragment}>
    <div className="page is-narrow" ref=${box}>
      <section className="box">
        <div className="box-h"><h1 className="p-title grow" tabIndex="-1" data-autofocus="true">${r ? (r.status === 'draft' ? 'Черновик заявки' : 'Доработка заявки') : 'Новая заявка на подбор'}</h1><${CloseBtn}/></div>
        ${returned && html`<div className="now is-mine"><div className="now-t">Что просят исправить</div><blockquote className="now-q">${r.returned.comment}</blockquote>
          <div className="now-m">${name(r.returned.by)}, ${Model.fmtDateTime(r.returned.at)}</div></div>`}
        <div className="form-body">
        <section className="form-sec"><h3>Общая информация</h3>
          <${Field} label="Должность" error=${err.title}>${inp('title', {autoComplete:'off'})}<//>
          <div className="grid2">
            <${Field} label="Отдел" error=${err.dept}><select className="inp" data-k="dept" value=${f.dept} onChange=${set('dept')}><option value="">Выберите</option>${Model.DEPTS.map(d => html`<option key=${d}>${d}</option>`)}</select><//>
            <${Field} label="Проект" error=${err.project}>${inp('project')}<//>
            <${Field} label="Непосредственный руководитель" error=${err.manager}><select className="inp" data-k="manager" value=${f.manager} onChange=${set('manager')}><option value="">Выберите</option>${managers.map(([id, p]) => html`<option key=${id} value=${id}>${p.name}</option>`)}</select><//>
            <${Field} label="Сколько человек" error=${err.seats}>${inp('seats', {type:'number', min:1, max:50, inputMode:'numeric'})}<//>
          </div>
          <div className="field">
            <span className="l" id="reason-l">Причина открытия позиции</span>
            <div className="radios" role="radiogroup" aria-labelledby="reason-l">
              ${Object.entries(Model.REASONS).map(([k, t], i) => html`<label key=${k}><input type="radio" name="reason" data-k=${i === 0 ? 'reason' : undefined} checked=${f.reason === k} onChange=${() => set('reason')(k)}/>${t}</label>`)}
            </div>
            ${err.reason && html`<span className="err">${err.reason}</span>`}
          </div>
          ${f.reason === 'other' && html`<${Field} label="Какая причина" error=${err.reasonOther}>${inp('reasonOther')}<//>`}
        </section>

        <section className="form-sec"><h3>Информация о должности</h3>
          <${Field} label="Основные обязанности" error=${err.duties}>${area('duties', 4)}<//>
          <${Field} label="Требования" error=${err.reqs}>${area('reqs')}<//>
          <div className="grid2">
            <${Field} label="Необходимый опыт" error=${err.experience}>${inp('experience', {placeholder:'От 2 лет'})}<//>
            <${Field} label="Образование" optional=${true}>${inp('education')}<//>
          </div>
          <${Field} label="Профессиональные навыки" optional=${true}>${inp('skills')}<//>
          <${Field} label="Личные качества" optional=${true}>${inp('personal')}<//>
          <${Field} label="Дополнительные требования" optional=${true}>${area('extra', 2)}<//>
        </section>

        <section className="form-sec"><h3>Условия</h3>
          <div className="field"><span className="l">Формат работы</span><${Seg} label="Формат работы" value=${f.format} onChange=${set('format')} options=${Model.FORMATS.map(x => [x, x])}/></div>
          <div className="grid2">
            <${Field} label="Локация" error=${err.location}>${inp('location')}<//>
            <${Field} label="График" error=${err.schedule}>${inp('schedule')}<//>
            <${Field} label="Тип занятости"><select className="inp" value=${f.employment} onChange=${set('employment')}>${Model.EMPLOYMENT.map(x => html`<option key=${x}>${x}</option>`)}</select><//>
            <${Field} label="Зарплата" error=${err.salary} hint="Оклад на руки или вилка">${inp('salary', {placeholder:'400 000 ₸'})}<//>
            <${Field} label="Бонусы / KPI" optional=${true}>${inp('bonus')}<//>
            <${Field} label="Испытательный срок" optional=${true}>${inp('probation')}<//>
            <${Field} label="Желаемая дата выхода" error=${err.start}>${inp('start', {type:'date'})}<//>
          </div>
        </section>

        <section className="form-sec"><h3>Дополнительно</h3>
          <div className="field"><span className="l">Приоритет</span><${Seg} label="Приоритет" value=${f.priority} onChange=${set('priority')} options=${[['normal','Обычный'],['high','Срочно']]}/></div>
          <${Field} label="Комментарий для HR" optional=${true}>${area('comment')}<//>
          <div className="field">
            <span className="l">Файлы <small>необязательно</small></span>
            ${f.files.length > 0 && html`<ul className="files">${f.files.map((x, i) => html`<li key=${i}><${Icon} n="clip" s=${15}/>${x.name}
              <button className="btn btn-ghost" style=${{height:28}} aria-label=${'Убрать ' + x.name} onClick=${() => set('files')(f.files.filter((_, j) => j !== i))}><${Icon} n="x" s=${14}/></button></li>`)}</ul>`}
            <${Btn} onClick=${() => file.current.click()}><${Icon} n="clip" s=${15}/>Прикрепить ТЗ или материалы<//>
            <input ref=${file} type="file" multiple hidden onChange=${e => { const fs = Array.from(e.target.files).map(x => ({name:x.name, size:x.size})); if(fs.length) set('files')(f.files.concat(fs)); e.target.value = ''; }}/>
          </div>
        </section>
        </div>
      </section>
    ${ask ? html`<div className="guard foot-bar" role="alert"><span>Есть несохранённые изменения.</span>
        <${Btn} kind="primary" onClick=${() => { setAsk(false); save(false); }}>Сохранить черновик<//>
        <${Btn} kind="danger" onClick=${() => { const then = ask; setAsk(false); setDirty(false); Panel.leave = f => f(); then(); }}>Не сохранять<//>
        <${Btn} kind="ghost" onClick=${() => setAsk(false)}>Вернуться к форме<//></div>`
      : html`<div className="foot-bar">
        <${Btn} kind="primary" lg=${true} onClick=${() => save(true)}>${returned ? 'Отправить снова' : 'Отправить в HR'}<//>
        ${!returned && html`<${Btn} lg=${true} onClick=${() => save(false)}>Сохранить черновик<//>`}
        ${returned && html`<${Btn} lg=${true} onClick=${() => save(false)}>Сохранить<//>`}
      </div>`}
    </div>
  <//>`;
}
