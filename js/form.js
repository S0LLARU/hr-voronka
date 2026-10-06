/* Заявка на подбор (п. 4 ТЗ).
   Новая заявка и черновик — своё окно по шагам: «Должность», «Кого ищем», «Условия», «Дополнительно».
   Человек заполняет по очереди, «Далее» проверяет только текущий шаг.
   Доработка после возврата — те же поля прямо в окне заявки, у полей видно, что просили исправить.
   Цифры вводятся только цифрами, даты — календарём, списки — выбором. Закрыть с несохранённым молча нельзя. */
'use strict';

const PROBATION = ['Без испытательного срока', '1 месяц', '2 месяца', '3 месяца'];
const EMPTY = {title:'', dept:'', project:'', manager:'', seats:'1', reason:'', reasonOther:'', duties:'', reqs:'', experience:'', skills:'', personal:'',
  education:'', extra:'', format:'Офис', location:'Алматы', schedule:'5/2, 9:00–18:00', employment:'Полная занятость', salMode:'exact', salA:'', salB:'', bonus:'',
  probation:'3 месяца', start:'', priority:'normal', comment:'', files:[]};

const STEPS = [
  {k:'job', t:'Должность', req:['title', 'project', 'dept', 'manager', 'reason']},
  {k:'who', t:'Кого ищем', req:['duties', 'reqs', 'experience']},
  {k:'cond', t:'Условия', req:['location', 'schedule', 'salary', 'start']},
  {k:'more', t:'Дополнительно', req:[]}
];
const REQUIRED = {
  title:'Укажите должность', dept:'Выберите отдел', project:'Укажите проект', manager:'Выберите руководителя', reason:'Выберите причину',
  duties:'Опишите обязанности', reqs:'Опишите требования', experience:'Укажите нужный опыт', location:'Укажите локацию', schedule:'Укажите график',
  salary:'Укажите зарплату', start:'Выберите желаемую дату выхода'
};

/* зарплата хранится строкой «500 000 ₸» или вилкой «400 000 – 500 000 ₸» */
function parseSalary(s){
  const parts = String(s || '').split(/[–—-]/);
  return parts.length > 1 ? {salMode:'range', salA:digits(parts[0]), salB:digits(parts[1])} : {salMode:'exact', salA:digits(s), salB:''};
}
const composeSalary = f => !f.salA ? '' : f.salMode === 'range' ? groupDigits(f.salA) + ' – ' + groupDigits(f.salB) + ' ₸' : groupDigits(f.salA) + ' ₸';

function RequestForm({r, onClose, inline, guard, notes}){
  const v = useViewer();
  const init = () => {
    if(r){ const f = {}; Object.keys(EMPTY).forEach(k => { f[k] = r[k] ?? EMPTY[k]; }); f.seats = String(r.seats); f.start = toInput(r.start); return Object.assign(f, parseSalary(r.salary)); }
    const me = Model.PEOPLE[v];
    return Object.assign({}, EMPTY, {manager:me.role === 'manager' ? v : '', dept:me.dept || ''});
  };
  const [f, setF] = useState(init), [err, setErr] = useState({}), [dirty, setDirty] = useState(false), [ask, setAsk] = useState(false), [step, setStep] = useState(0);
  /* шаг вперёд — поля приезжают справа, назад — слева */
  const wb = useRef(null), stepWas = useRef(step);
  useLayoutEffect(() => { if(stepWas.current === step) return; const dir = step < stepWas.current ? 'back' : 'fwd'; stepWas.current = step; Anim.push(wb.current, dir); }, [step]);
  const file = useRef(null), box = useRef(null);
  const set = k => e => { const val = e && e.target ? e.target.value : e; setF(Object.assign({}, f, {[k]:val})); setDirty(true); if(err[k] || (k.startsWith('sal') && err.salary)) setErr(Object.assign({}, err, {[k]:'', salary:''})); };
  const managers = Object.entries(Model.PEOPLE).filter(([, p]) => p.role === 'manager' || p.role === 'hrd');
  notes = notes || {};

  const check = keys => {
    const e = {};
    keys.forEach(k => {
      if(k === 'salary'){
        if(!f.salA || (f.salMode === 'range' && !f.salB)) e.salary = f.salMode === 'range' ? 'Укажите вилку: от и до' : REQUIRED.salary;
        else if(f.salMode === 'range' && +f.salB <= +f.salA) e.salary = 'Верхняя граница должна быть больше нижней';
      } else if(!String(f[k]).trim()) e[k] = REQUIRED[k];
    });
    if(keys.includes('reason') && f.reason === 'other' && !f.reasonOther.trim()) e.reasonOther = 'Напишите причину';
    return e;
  };
  const allKeys = STEPS.flatMap(s => s.req);
  const focusFirst = e => { requestAnimationFrame(() => { const k = Object.keys(e)[0]; const el = box.current && box.current.querySelector('[data-k="' + k + '"]'); if(el){ el.scrollIntoView({block:'center', behavior:Anim.on() ? 'smooth' : 'auto'}); el.focus({preventScroll:true}); } }); };
  const save = send => {
    if(send){
      const e = check(allKeys); setErr(e);
      if(Object.keys(e).length){ if(!inline){ const at = STEPS.findIndex(s => s.req.some(k => e[k]) || (s.k === 'job' && e.reasonOther)); setStep(at < 0 ? 0 : at); } focusFirst(e); return; }
    } else if(!f.title.trim()){ const e = {title:'Укажите должность, чтобы сохранить черновик'}; setErr(e); setStep(0); focusFirst(e); return; }
    const fields = Object.assign({}, f, {start:fromInput(f.start), seats:Math.min(50, Math.max(1, +f.seats || 1)), title:f.title.trim(), project:f.project.trim(), salary:composeSalary(f)});
    ['salMode', 'salA', 'salB'].forEach(k => delete fields[k]);
    let id = r && r.id;
    if(r) Store.dispatch('update', {id, fields, send});
    else id = Store.dispatch('create', {fields, send});
    setDirty(false); if(guard) guard.current = false;
    onClose && onClose(id, true);
  };
  const next = () => { const e = check(STEPS[step].req); setErr(e); if(Object.keys(e).length){ focusFirst(e); return; } setStep(step + 1); };

  /* защита несохранённого: своё окно — через Panel.leave, внутри окна заявки — через guard окна */
  useEffect(() => { if(guard){ guard.current = dirty; return; } Panel.leave = then => { if(dirty){ setAsk(() => then); return; } then(); }; });
  useEffect(() => () => { if(!guard) Panel.leave = f => f(); }, []);
  useEffect(() => { if(inline) return; const t = box.current && box.current.querySelector('input,textarea,button.sel'); t && t.focus({preventScroll:true}); }, [step]);

  /* замечание проверяющего — над полем */
  const note = k => notes[k] && html`<div className="fnote"><${Icon} n="ret" s=${15}/><span>${notes[k]}</span></div>`;
  const fld = (k, label, ctl, opt) => html`<div data-f=${k} className=${notes[k] ? 'has-note' : null}>${note(k)}<${Field} label=${label} optional=${opt} error=${err[k]}>${ctl}<//></div>`;
  const inp = (k, props) => html`<input className="inp" data-k=${k} value=${f[k]} onInput=${set(k)} ...${props || {}}/>`;
  const area = (k, rows) => html`<textarea className="inp" data-k=${k} rows=${rows || 3} value=${f[k]} onInput=${set(k)}/>`;

  const parts = {
    job:html`<${Fragment}>
      <div className="grid-dc">
        ${fld('title', 'Должность', inp('title', {autoComplete:'off'}))}
        ${fld('project', 'Проект', inp('project'))}
      </div>
      <div className="grid-dc">
        ${fld('dept', 'Отдел', html`<${Select} data-k="dept" value=${f.dept} onChange=${set('dept')} options=${Model.DEPTS}/>`)}
        ${fld('manager', 'Руководитель', html`<${Select} data-k="manager" value=${f.manager} onChange=${set('manager')} options=${managers.map(([id, p]) => [id, p.name, p.dept || Model.ROLE[p.role]])}/>`)}
      </div>
      <div data-f="seats" className=${notes.seats ? 'has-note' : null}>${note('seats')}<div className="field"><span className="l">Сколько человек</span><${Counter} label="Сколько человек" value=${f.seats} onChange=${set('seats')}/></div></div>
      <div data-f="reason" className=${notes.reason ? 'has-note' : null}>${note('reason')}<div className="field">
        <span className="l" id="reason-l">Причина открытия позиции</span>
        <div className="choice" role="radiogroup" aria-labelledby="reason-l">
          ${Object.entries(Model.REASONS).map(([k, t], i) => html`<label key=${k} className=${f.reason === k ? 'is-on' : null}><input type="radio" name="reason" data-k=${i === 0 ? 'reason' : undefined} checked=${f.reason === k} onChange=${() => set('reason')(k)}/>${t}</label>`)}
        </div>
        ${err.reason && html`<span className="err">${err.reason}</span>`}
      </div></div>
      ${f.reason === 'other' && html`<${Field} label="Какая причина" error=${err.reasonOther}>${inp('reasonOther')}<//>`}
    <//>`,
    who:html`<${Fragment}>
      ${fld('duties', 'Основные обязанности', area('duties', 3))}
      ${fld('reqs', 'Требования', area('reqs', 3))}
      <div className="grid2">
        ${fld('experience', 'Необходимый опыт', inp('experience', {placeholder:'Например, от 2 лет'}))}
        ${fld('skills', 'Навыки', inp('skills'), true)}
        ${fld('personal', 'Личные качества', inp('personal'), true)}
        ${fld('education', 'Образование', inp('education'), true)}
      </div>
      ${fld('extra', 'Дополнительные требования', inp('extra'), true)}
    <//>`,
    cond:html`<${Fragment}>
      <div data-f="format" className=${notes.format ? 'has-note' : null}>${note('format')}<div className="field"><span className="l">Формат работы</span><${Seg} label="Формат работы" value=${f.format} onChange=${set('format')} options=${Model.FORMATS.map(x => [x, x])}/></div></div>
      <div className="grid2">
        ${fld('location', 'Локация', inp('location'))}
        ${fld('schedule', 'График', inp('schedule'))}
        ${fld('employment', 'Тип занятости', html`<${Select} value=${f.employment} onChange=${set('employment')} options=${Model.EMPLOYMENT}/>`)}
        ${fld('probation', 'Испытательный срок', html`<${Select} value=${f.probation} onChange=${set('probation')} options=${PROBATION.includes(f.probation) ? PROBATION : PROBATION.concat(f.probation ? [f.probation] : [])}/>`)}
      </div>
      <div data-f="salary" className=${notes.salary ? 'has-note' : null}>${note('salary')}<div className="field">
        <div className="l-row"><span className="l">Зарплата на руки</span><${Seg} label="Зарплата" value=${f.salMode} onChange=${set('salMode')} options=${[['exact', 'Точная'], ['range', 'Вилка']]}/></div>
        <div className=${f.salMode === 'range' ? 'grid2' : 'sal-one'}>
          <${NumInput} data-k="salary" aria-label=${f.salMode === 'range' ? 'От' : 'Зарплата'} placeholder=${f.salMode === 'range' ? 'от' : '0'} suffix="₸" value=${f.salA} onChange=${set('salA')} aria-invalid=${err.salary ? 'true' : undefined}/>
          ${f.salMode === 'range' && html`<${NumInput} aria-label="До" placeholder="до" suffix="₸" value=${f.salB} onChange=${set('salB')} aria-invalid=${err.salary ? 'true' : undefined}/>`}
        </div>
        ${err.salary && html`<span className="err">${err.salary}</span>`}
      </div></div>
      <div className="grid2">
        ${fld('bonus', 'Бонусы / KPI', inp('bonus'), true)}
        ${fld('start', 'Желаемая дата выхода', html`<${DatePicker} data-k="start" value=${f.start} min=${ymd(new Date())} onChange=${set('start')}/>`)}
      </div>
    <//>`,
    more:html`<${Fragment}>
      <div className="field"><span className="l">Приоритет</span><${Seg} label="Приоритет" value=${f.priority} onChange=${set('priority')} options=${[['normal', 'Обычный'], ['high', 'Срочно']]}/></div>
      ${fld('comment', 'Комментарий для HR', area('comment', 3), true)}
      <div className="field">
        <span className="l">Файлы <small>необязательно</small></span>
        ${f.files.length > 0 && html`<ul className="files">${f.files.map((x, i) => html`<li key=${i}><${Icon} n="clip" s=${15}/>${x.name}
          <button className="btn btn-ghost" style=${{height:28}} aria-label=${'Убрать ' + x.name} onClick=${() => set('files')(f.files.filter((_, j) => j !== i))}><${Icon} n="x" s=${14}/></button></li>`)}</ul>`}
        <${Btn} onClick=${() => file.current.click()}><${Icon} n="clip" s=${15}/>Прикрепить ТЗ или материалы<//>
        <input ref=${file} type="file" multiple hidden onChange=${e => { const fs = Array.from(e.target.files).map(x => ({name:x.name, size:x.size})); if(fs.length) set('files')(f.files.concat(fs)); e.target.value = ''; }}/>
      </div>
    <//>`
  };
  const returned = r && r.status === 'returned';

  /* доработка: все поля в окне заявки, блоками */
  if(inline) return html`<div className="form-inline" ref=${box}>
    ${STEPS.map(s => html`<${Box} key=${s.k} title=${s.t}>${parts[s.k]}<//>`)}
    <${ModalFoot}><div className="row is-end">
      <${Btn} onClick=${() => save(false)}>Сохранить<//>
      <${Btn} kind="primary" onClick=${() => save(true)}>Отправить снова<//>
    </div><//>
  </div>`;

  /* новая заявка и черновик: своё окно, шаги по очереди */
  const last = step === STEPS.length - 1;
  const wiz = html`<ol className="wiz" aria-label="Шаги заявки">${STEPS.map((s, i) => html`<li key=${s.k} className=${i < step ? 'is-done' : i === step ? 'is-now' : ''}>
    <button type="button" disabled=${i > step} aria-current=${i === step ? 'step' : undefined} onClick=${() => setStep(i)}>
      <span className="wiz-n num">${i < step ? html`<${Icon} n="check" s=${12} w=${3}/>` : i + 1}</span><span className="wiz-t">${s.t}</span>
    </button></li>`)}</ol>`;
  return html`<div className="mpage wiz-page" ref=${box}>
    <${ModalHead} title=${r ? 'Черновик заявки' : 'Новая заявка'} sub=${r && html`<${BackLink} href=${'#/r/' + r.id}>${r.title}<//>`} strip=${wiz}/>
    ${returned && html`<${Note} title="Что просят исправить" by=${r.returned.by} at=${r.returned.at} quote=${r.returned.comment}/>`}
    <div className="wiz-body" key=${step} ref=${wb}>${parts[STEPS[step].k]}</div>
    <${ModalFoot}>${ask ? html`<div className="row is-end guard-row" role="alert"><span>Есть несохранённые изменения.</span>
        <${Btn} kind="ghost" onClick=${() => setAsk(false)}>Остаться<//>
        <${Btn} kind="danger" onClick=${() => { const then = ask; setAsk(false); setDirty(false); Panel.leave = f => f(); then(); }}>Не сохранять<//>
        <${Btn} kind="primary" onClick=${() => { setAsk(false); save(false); }}>Сохранить черновик<//></div>`
      : html`<div className="row acts">
        <${Btn} kind="ghost" onClick=${() => save(false)}>Сохранить черновик<//>
        <div className="acts-r">
          ${step > 0 && html`<${Btn} onClick=${() => setStep(step - 1)}>Назад<//>`}
          ${last ? html`<${Btn} kind="primary" onClick=${() => save(true)}>Отправить в HR<//>` : html`<${Btn} kind="primary" onClick=${next}>Далее<//>`}
        </div>
      </div>`}<//>
  </div>`;
}
