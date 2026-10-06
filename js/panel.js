/* Окно заявки и кандидата — как карточка заявки в Galamat Finance:
   - под шапкой полоса шагов того, что происходит внутри окна (не вся воронка — её видно по доске);
   - слева блоки в рамке: дело этого шага, под ним сама заявка (её можно свернуть, по умолчанию открыта);
   - справа блоки «История» и «Информация»;
   - кнопки решения внизу окна: человек читает сверху вниз и решает в конце. */
'use strict';

const go = h => { location.hash = h; };

/* блок в рамке с заголовком, как в Finance */
function Box({title, aside, children, className, id}){
  return html`<section className=${'box' + (className ? ' ' + className : '')} id=${id}>
    ${title && html`<div className="box-h"><h3 className="box-t">${title}</h3>${aside}</div>`}
    ${children}
  </section>`;
}
/* сведения: подпись над значением в две колонки, длинный текст — во всю ширину */
function Fields({rows, cols = 2, review}){
  const list = rows.filter(x => x[1] || (review && x[3]));
  if(!list.length) return null;
  return html`<dl className=${'fields is-' + cols}>${list.map(([k, val, wide, key]) => {
    if(!review || !key) return html`<div key=${k} className=${wide ? 'is-wide' : null}><dt>${k}</dt><dd>${val}</dd></div>`;
    const n = review.notes[key], on = review.open === key;
    return html`<div key=${k} className=${'rev' + (wide || on || n ? ' is-wide' : '') + (n ? ' has-n' : '') + (on ? ' is-on' : '')}
      onClick=${e => { if(!e.target.closest('textarea,button')) review.setOpen(on ? null : key); }}>
      <dt>${k}<button type="button" className="rev-b" aria-expanded=${on} onClick=${() => review.setOpen(on ? null : key)}>${n ? 'Замечание' : '+ Замечание'}</button></dt>
      <dd>${val || html`<span className="muted">Не заполнено</span>`}</dd>
      ${on ? html`<textarea className="inp rev-t" rows="2" placeholder="Что исправить" autoFocus value=${n || ''}
          onInput=${e => review.setNote(key, e.target.value)} onKeyDown=${e => { if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); review.setOpen(null); } }}/>`
        : n && html`<div className="fnote"><${Icon} n="ret" s=${15}/><span>${n}</span></div>`}
    </div>`;
  })}</dl>`;
}
const RETURN_NOTE = 'Заявка вернётся руководителю. После доработки она снова придёт в HR и пройдёт согласование заново.';
const REJECT_NOTE = 'Заявка закроется, руководитель увидит причину. Вернуть её нельзя: понадобится новая.';
const lastLog = (r, s) => r.log.filter(x => x.step === s).pop();
const logTip = l => l ? shortName(l.by) + ', ' + Model.fmtDateTime(l.at) : '';
const initials = n => n.split(' ').slice(0, 2).map(x => x[0]).join('');

/* ---------- полоса шагов под шапкой ----------
   На согласовании: заявка, проверка HR, Finance, CEO. В подборе: рекрутер, публикация, подбор.
   С выбранным кандидатом: подготовка к выходу, стажировка, оформление, учёт в ФОТ. */
const STATE_SR = {done:' — пройдено', now:' — сейчас', next:' — впереди', stop:' — остановлено', skip:' — пропущено'};
function StepRow({steps}){
  const ref = useRef(null), prev = useRef(null);
  useLayoutEffect(() => {
    const ol = ref.current, el = ol && ol.querySelector('.is-now, .is-stop');
    const over = ol && ol.scrollWidth > ol.clientWidth + 1;
    if(ol) ol.classList.toggle('is-over', !!over);
    if(el && over) ol.scrollLeft = Math.max(0, el.offsetLeft - 40);
    /* шаг пройден у человека на глазах: точка отзывается, линия до следующего шага заполняется, следующий шаг загорается */
    const was = prev.current; prev.current = new Map(steps.map(x => [x.k, x.state]));
    if(!was || !ol || !Anim.on()) return;
    let t = 0;
    steps.forEach((x, i) => {
      const li = ol.children[i], old = was.get(x.k);
      if(!li || old === undefined || old === x.state) return;
      if(x.state === 'done'){
        Anim.pop(li.querySelector('.rp-d'));
        const ln = li.querySelector('.rp-ln i');
        if(ln) Motion.animate(ln, {transform:['scaleX(0)','scaleX(1)']}, {duration:.7, ease:[.65,0,.35,1], delay:.12});
        t = .6;
      } else if(x.state === 'now' || x.state === 'stop') Anim.pop(li.querySelector('.rp-d'), .4, t);
    });
  });
  return html`<div className="rp-row">
    <ol className="rp" ref=${ref} aria-label="Шаги">${steps.map((s, i) => html`<li key=${s.k} className=${'is-' + s.state} title=${s.tip || null}>
      <span className="rp-d" aria-hidden="true">${s.state === 'done' ? html`<${Icon} n="check" s=${10} w=${3}/>` : s.state === 'stop' ? html`<${Icon} n="x" s=${10} w=${3}/>` : null}</span>
      <span className="rp-l">${s.label}</span><span className="sr">${STATE_SR[s.state]}${s.tip ? ', ' + s.tip : ''}</span>
      ${i < steps.length - 1 && html`<span className="rp-ln" aria-hidden="true"><i/></span>`}
    </li>`)}</ol>
  </div>`;
}
function Strip({steps}){
  return html`<div className="strip"><${StepRow} steps=${steps}/></div>`;
}

const BLANK = {status:'draft', log:[], publications:[], hires:[], candidates:[], seats:1};
function approveSteps(r){
  const st = r.status, pre = st === 'draft' || st === 'returned';
  const stopAt = st === 'rejected' ? r.log.filter(x => x.step === 'reject').pop() : null;
  const finStop = stopAt && stopAt.by === Model.FIN, ceoStop = stopAt && stopAt.by === Model.CEO;
  const sent = lastLog(r, 'sent'), hr = lastLog(r, 'hr'), fin = lastLog(r, 'finance'), ceo = lastLog(r, 'ceo');
  return [
    {k:'req', label:'Заявка', state:pre ? 'now' : 'done', tip:!pre && logTip(sent)},
    {k:'hr', label:'Проверка HR', state:st === 'hr' ? 'now' : hr && !pre ? 'done' : 'next', tip:!pre && logTip(hr)},
    {k:'fin', label:'Finance', state:finStop ? 'stop' : st === 'finance' ? 'now' : fin && !pre ? 'done' : 'next', tip:finStop ? logTip(stopAt) : !pre && logTip(fin)},
    {k:'ceo', label:'CEO', state:ceoStop ? 'stop' : st === 'ceo' ? 'now' : ceo ? 'done' : 'next', tip:ceoStop ? logTip(stopAt) : logTip(ceo)}
  ];
}
function searchSteps(r){
  const st = r.status, pubs = r.publications || [], n = r.candidates.length;
  return [
    {k:'rec', label:'Рекрутер', state:r.recruiter ? 'done' : st === 'assign' ? 'now' : 'next', tip:r.recruiter ? name(r.recruiter) : ''},
    {k:'pub', label:'Публикация', state:pubs.length ? 'done' : st === 'inwork' || st === 'assigned' ? 'now' : 'next', tip:pubs.map(x => x.platform + ' ' + Model.fmtDate(x.date)).join(', ')},
    {k:'search', label:'Подбор', state:Model.activeHires(r).length >= r.seats ? 'done' : st === 'published' ? 'now' : 'next',
      tip:n ? n + ' ' + Model.plural(n, 'кандидат', 'кандидата', 'кандидатов') : ''}
  ];
}
function hireSteps(h){
  const s = h.stage, idx = ['prep','intern','docs','fin','done'].indexOf(s === 'fot' ? 'fin' : s), dropped = s === 'dropped';
  const st = i => dropped ? (i < 1 ? 'done' : 'stop') : idx > i ? 'done' : idx === i ? 'now' : 'next';
  const steps = [
    {k:'prep', label:'Подготовка к выходу', state:st(0), tip:'выход ' + Model.fmtDate(h.start)},
    {k:'intern', label:dropped ? 'Не продолжаем' : 'Стажировка', state:st(1), tip:h.internStart ? 'с ' + Model.fmtDate(h.internStart) : ''},
    {k:'docs', label:'Оформление', state:st(2), tip:h.hiredAt ? 'оформлен ' + Model.fmtDate(h.hiredAt) : ''},
    {k:'fot', label:'Учёт в ФОТ', state:st(3), tip:h.fotAt ? 'учтено ' + Model.fmtDate(h.fotAt.at) : ''}
  ];
  return dropped ? steps.slice(0, 2) : steps;
}
/* одна строка шагов (решение пользователя: вторая полоса и подписи в рамке лишние).
   Пока ищут — шаги подбора; выбранные на нескольких местах видны своими блоками ниже.
   Все места заняты — шаги выхода по тому, кто отстаёт */
const H_ORDER = ['prep','intern','docs','fin','fot','done'];
function stripSteps(r){
  const st = r.status;
  if(['draft','returned','hr','finance','ceo','rejected'].includes(st)) return approveSteps(r);
  if(st === 'cancelled'){
    const steps = (lastLog(r, 'ceo') ? searchSteps(r) : approveSteps(r)).filter(x => x.state !== 'next' && x.state !== 'now');
    steps.push({k:'stop', label:'Отменено', state:'stop', tip:logTip(lastLog(r, 'cancel'))});
    return steps;
  }
  if(Model.activeHires(r).length < r.seats) return searchSteps(r);
  const hs = st === 'closed' ? r.hires.filter(h => h.stage === 'done') : Model.openHires(r);
  const h = hs.slice().sort((a, b) => H_ORDER.indexOf(a.stage) - H_ORDER.indexOf(b.stage))[0];
  return h ? hireSteps(h) : searchSteps(r);
}

const C_STEPS = [['hr','Интервью HR'], ['mgr','Руководитель'], ['offer','Оффер'], ['accepted','Согласился']];
function candSteps(c){
  const rej = c.stage === 'rejected', from = rej ? c.reject.from : c.stage, at = from === 'approved' ? 'offer' : from === 'test' || from === 'new' ? 'hr' : from;
  let pos = C_STEPS.findIndex(x => x[0] === at);
  if(pos < 0 || (!rej && at === 'accepted')) pos = C_STEPS.length;
  let s = C_STEPS.map(([k, label], j) => ({k, label, state:j < pos ? 'done' : j === pos ? (rej ? 'stop' : 'now') : 'next'}));
  if(rej){ s = s.filter(x => x.state !== 'next'); if(pos === C_STEPS.length) s.push({k:'stop', label:'Отказ', state:'stop'}); }
  return s;
}

/* ---------- заявка: все поля ТЗ, разложенные по смыслу ----------
   Finance и CEO решают про деньги — у них условия первыми. */
function briefParts(r, v){
  const p = Model.perms(r, v), role = Model.PEOPLE[v].role;
  const txt = s => s && html`<span className="text">${s}</span>`;
  const files = r.files && r.files.length > 0 && html`<ul className="files">${r.files.map((f, i) => html`<li key=${i}><${Icon} n="clip" s=${15}/>${f.name}</li>`)}</ul>`;
  const who = ['who', 'Кого ищем', [['Обязанности', txt(r.duties), true, 'duties'], ['Требования', txt(r.reqs), true, 'reqs'], ['Опыт', r.experience, false, 'experience'], ['Навыки', r.skills, false, 'skills'],
    ['Личные качества', r.personal, false, 'personal'], ['Образование', r.education, false, 'education'], ['Дополнительные требования', txt(r.extra), true, 'extra']]];
  const cond = ['cond', 'Условия', [['Зарплата', p.salary && r.salary, false, p.salary && 'salary'], ['Бонусы / KPI', p.salary && r.bonus, false, p.salary && 'bonus'], ['Формат работы', r.format, false, 'format'], ['Локация', r.location, false, 'location'],
    ['График', r.schedule, false, 'schedule'], ['Тип занятости', r.employment, false, 'employment'], ['Испытательный срок', r.probation, false, 'probation'], ['Желаемая дата выхода', Model.fmtDate(r.start, true), false, 'start']]];
  const why = ['why', 'Зачем открываем', [['Причина', Model.REASONS[r.reason] && Model.REASONS[r.reason] + (r.reasonOther ? ': ' + r.reasonOther : ''), false, 'reason'],
    ['Сколько человек', String(r.seats || 1), false, 'seats'], ['Приоритет', r.priority === 'high' ? 'Срочно' : 'Обычный', false, 'priority'], ['Комментарий для HR', txt(r.comment), true, 'comment'], ['Файлы', files, true]]];
  return role === 'finance' || role === 'ceo' ? [cond, why, who] : [who, cond, why];
}
/* на согласовании заявка — само дело: три блока подряд */
function Brief({r, v, review}){
  return briefParts(r, v).map(([k, t, rows]) => html`<${Box} key=${k} title=${t}><${Fields} rows=${rows} review=${review}/><//>`);
}
/* возврат на доработку: замечания к полям и общий комментарий, внизу окна */
function ReturnForm({count, comment, setComment, onCancel, onSend, err}){
  const ref = useRef(null);
  useEffect(() => { Anim.reveal(ref.current); }, []);
  return html`<div className="decide" ref=${ref}>
    <p className="note-m" style=${{margin:'0 0 10px'}}>${count ? 'Замечаний к полям: ' + count + '. ' : 'Нажмите на поле в заявке, чтобы оставить замечание. '}${RETURN_NOTE}</p>
    <${Field} label="Общий комментарий" optional=${count > 0} error=${err}><textarea className="inp" rows="2" value=${comment} onInput=${e => setComment(e.target.value)}/><//>
    <div className="row is-end"><${Btn} kind="ghost" onClick=${onCancel}>Отмена<//><${Btn} kind="primary" onClick=${onSend}>Вернуть на доработку<//></div>
  </div>`;
}
/* после согласования заявка — справка под делом шага. Открыта, пока она нужна для дела: назначить рекрутера,
   написать вакансию, первые кандидаты. Когда кандидатов много или уже идёт выход — свёрнута, место под дело.
   Свернули или открыли вручную — выбор помнится для этой заявки, пока открыта вкладка */
const BRIEF_OPEN = new Map();
function briefDefault(r){
  if(['assign','assigned','inwork'].includes(r.status)) return true;
  if(r.status !== 'published' || r.hires.some(h => h.stage !== 'dropped')) return false;
  return r.candidates.filter(c => c.stage !== 'rejected').length < 2;
}
function RequestBox({r, v}){
  const [open, setOpen] = useState(() => BRIEF_OPEN.has(r.id) ? BRIEF_OPEN.get(r.id) : briefDefault(r)), body = useExpand(open);
  const toggle = () => { const n = !open; BRIEF_OPEN.set(r.id, n); if(n) setOpen(true); else Anim.collapse(body.current).then(() => setOpen(false)); };
  const p = Model.perms(r, v);
  const sum = [p.salary && r.salary, [r.format, r.location].filter(Boolean).join(', '), r.schedule].filter(Boolean).join(' · ');
  return html`<section className=${'box is-fold' + (open ? ' is-open' : '')}>
    <h3 className="box-t"><button className="fold" aria-expanded=${open} onClick=${toggle}>
      <span>Заявка</span>${!open && html`<span className="fold-s">${sum}</span>`}
      <span className="fold-i" aria-hidden="true"><${Icon} n="down" s=${16}/></span>
    </button></h3>
    ${open && html`<div className="fold-b" ref=${body}>${briefParts(r, v).map(([k, t, rows]) => html`<div className="sub" key=${k}><h4 className="sub-t">${t}</h4><${Fields} rows=${rows}/></div>`)}</div>`}
  </section>`;
}

/* заметка сверху: что вернули, что сказал HR, почему остановили */
function Note({title, by, at, quote}){
  return html`<div className="note"><div className="note-t">${title}</div>${quote && html`<blockquote className="note-q">${quote}</blockquote>`}
    ${by && html`<div className="note-m">${name(by)}, ${Model.fmtDateTime(at)}</div>`}</div>`;
}
function Result({r}){
  const hs = r.hires.filter(h => h.stage === 'done'), n = Model.days(r.created, r.closedAt), pub = r.publications[0];
  const first = f => { const x = hs.map(f).filter(Boolean); return x.length ? Model.fmtDate(Math.min(...x), true) : ''; };
  return html`<${Box} title=${'Закрыта ' + Model.fmtDate(r.closedAt, true) + ', за ' + n + ' ' + Model.plural(n, 'день', 'дня', 'дней')}>
    <${Fields} rows=${[['Нанят' + (hs.length > 1 ? 'ы' : ''), hs.map(h => h.name).join(', '), true], ['Открыта', Model.fmtDate(r.created, true)], ['Опубликована', pub && Model.fmtDate(pub.date, true)],
      ['Кандидат найден', first(h => h.chosen)], ['Выход', first(h => h.internStart)], ['Оформление', first(h => h.hiredAt)], ['Учтено в ФОТ', first(h => h.fotAt && h.fotAt.at)]]}/>
  <//>`;
}
function Stopped({r}){
  const l = r.log.filter(x => x.step === 'reject' || x.step === 'cancel').pop();
  if(!l) return null;
  const title = r.status === 'cancelled' ? 'Отменена: ' + r.cancel.reason.toLowerCase() : (l.by === Model.FIN ? 'Finance' : 'CEO') + ' отклонил заявку';
  return html`<${Note} title=${title} by=${l.by} at=${l.at} quote=${r.status === 'cancelled' ? r.cancel.comment : l.comment}/>`;
}

/* ---------- чек-лист: пункты с отметками, разложенные по исполнителям ----------
   Каждый пункт отмечается сам (вернули по просьбе пользователя), но список компактный: две колонки,
   у исполнителя счётчик и «Отметить все». Сделанная часть свёрнута в строку «Сделано, кто, когда».
   Отмечает только сам исполнитель: HRD видит все части и кого ждут, но за другого не отмечает. */
const WHO_ORDER = ['recruiter', 'manager', 'mentor'];
const waitFor = (w, r) => { const id = w === 'recruiter' ? r.recruiter : w === 'manager' ? r.manager : null; return id ? 'Ждём: ' + shortName(id) : ''; };
function CheckGroup({r, h, list, w, its, can}){
  const need = its.filter(x => !x.it.opt), left = need.filter(x => !x.it.done).length, done = left === 0;
  const [open, setOpen] = useState(!done), list_ = useExpand(open), ok = useRef(null), wasDone = useRef(done);
  /* часть стала сделанной у человека на глазах: строка «Сделано» проявляется, пункты сворачиваются */
  useEffect(() => {
    if(done === wasDone.current) return; wasDone.current = done;
    if(done){ Anim.reveal(ok.current); Anim.collapse(list_.current).then(() => setOpen(false)); } else setOpen(true);
  }, [done]);
  const fold = () => open ? Anim.collapse(list_.current).then(() => setOpen(false)) : setOpen(true);
  const last = done && need.length ? need.map(x => x.it.done).sort((a, b) => b.at - a.at)[0] : null;
  const tick = (i, on) => Store.dispatch('check', {id:r.id, hid:h.id, list, i, done:on});
  return html`<div className=${'clg' + (done ? ' is-done' : '')}>
    <div className="clg-h">
      <span className="clg-w">${Model.WHO[w]}</span>
      ${done ? html`<span className="clg-ok" ref=${ok}><${Icon} n="ok" s=${15}/>Сделано${last ? ', ' + shortName(last.by) + ', ' + Model.fmtDate(last.at) : ''}</span>`
        : html`<span className="clg-n num">${need.length - left} из ${need.length}</span>`}
      <span className="clg-r">
        ${!done && can && html`<button type="button" className="link-btn" onClick=${() => Store.dispatch('checkGroup', {id:r.id, hid:h.id, list, who:w, done:true})}>Отметить все</button>`}
        ${!done && !can && html`<span className="muted clg-wait">${waitFor(w, r)}</span>`}
        ${done && html`<button type="button" className="link-btn" aria-expanded=${open} onClick=${fold}>${open ? 'Свернуть' : 'Пункты'}</button>`}
      </span>
    </div>
    ${open && html`<ul className="ck-l" ref=${list_}>${its.map(({it, i}) => html`<li key=${i}>
      <label className=${'ck' + (it.done ? ' is-done' : '') + (can ? '' : ' is-ro')} title=${it.done ? shortName(it.done.by) + ', ' + Model.fmtDateTime(it.done.at) : null}>
        <input type="checkbox" checked=${!!it.done} disabled=${!can} onChange=${e => tick(i, e.target.checked)}/>
        <span>${it.t}${it.opt ? html` <span className="muted">· при надобности</span>` : ''}</span>
      </label>
    </li>`)}</ul>`}
  </div>`;
}
function Checklist({r, h, list, v, who}){
  const items = h.lists[list];
  if(!items) return null;
  const hrd = Model.PEOPLE[v].role === 'hrd';
  const groups = WHO_ORDER.filter(w => items.some(i => i.who === w))
    .map(w => ({w, its:items.map((it, i) => ({it, i})).filter(x => x.it.who === w)}))
    .map(g => Object.assign(g, {can:Model.canCheck(g.its[0].it, r, v)}))
    .filter(g => hrd || g.can);
  if(!groups.length) return null;
  const all = groups.every(g => g.its.every(x => x.it.done || x.it.opt)), [open, setOpen] = useState(!all);
  /* весь список отмечен — сначала сворачивается последняя часть, потом блок становится строкой «Все отметили» */
  useEffect(() => { if(!all) return; const t = setTimeout(() => setOpen(false), Anim.on() ? 800 : 0); return () => clearTimeout(t); }, [all]);
  const title = Model.LISTS[list].name + (who ? ': ' + who : '');
  const fold = o => html`<button className="fold" aria-expanded=${o} onClick=${() => setOpen(!o)}><span>${title}</span><span className="fold-s ok">Все отметили</span><span className="fold-i" aria-hidden="true"><${Icon} n="down" s=${16}/></span></button>`;
  if(all && !open) return html`<section className="box is-fold"><h3 className="box-t">${fold(false)}</h3></section>`;
  return html`<${Box} title=${all ? fold(true) : title}>
    <div className="clg-all">${groups.map(g => html`<${CheckGroup} key=${g.w} r=${r} h=${h} list=${list} w=${g.w} its=${g.its} can=${g.can}/>`)}</div>
  <//>`;
}

/* сотрудник: работа текущего шага. Finance на своём шаге видит уведомление из п. 19 */
function HireWork({r, h, v, showName}){
  const s = h.stage, fin = Model.PEOPLE[v].role === 'finance';
  const lists = {prep:['prep'], intern:['day1'], docs:['docs', 'onboarding'], fot:['onboarding']}[s] || [];
  const who = showName ? Model.short(h.name) : '';
  if(fin && (s === 'fin' || s === 'fot')) return html`<${Box} title="Новый сотрудник: учесть в ФОТ">
    <${Fields} rows=${[['ФИО', h.name], ['Должность', r.title], ['Отдел', r.dept], ['Проект', r.project], ['Руководитель', name(r.manager)],
      ['Дата выхода', Model.fmtDate(h.internStart || h.start, true)], ['Оформлен', Model.fmtDate(h.hiredAt, true)], ['Оклад', h.salary],
      ['Бонус / KPI', r.bonus || 'Нет'], ['Тип занятости', r.employment]]}/><//>`;
  return lists.map(l => html`<${Checklist} key=${h.id + l} r=${r} h=${h} list=${l} v=${v} who=${who}/>`);
}

/* ---------- формы шагов: поля в блоке слева, кнопка внизу окна ---------- */
function AssignForm({r, actions, extra}){
  const load = id => Store.get().requests.filter(x => x.recruiter === id && !['closed','rejected','cancelled'].includes(x.status)).length;
  const [rec, setRec] = useState(''), [prio, setPrio] = useState(r.priority || 'normal'), [dl, setDl] = useState(toInput(r.start)), [err, setErr] = useState({});
  const send = () => {
    const e = {}; if(!rec) e.rec = 'Выберите рекрутера'; if(!dl) e.dl = 'Укажите срок закрытия';
    setErr(e); if(Object.keys(e).length) return;
    Store.dispatch('assign', {id:r.id, recruiter:rec, priority:prio, deadline:fromInput(dl)});
  };
  return html`<${Fragment}>
    <${Box} title="Назначить рекрутера">
      <div className="grid3">
        <${Field} label="Рекрутер" error=${err.rec}><${Select} data-k="rec" value=${rec} onChange=${x => { setRec(x); setErr({}); }}
          options=${Model.RECRUITERS.map(id => [id, name(id), 'В работе ' + load(id) + ' ' + Model.plural(load(id), 'заявка', 'заявки', 'заявок')])}/><//>
        <div className="field"><span className="l">Приоритет</span><${Seg} label="Приоритет" value=${prio} onChange=${setPrio} options=${[['normal','Обычный'],['high','Срочно']]}/></div>
        <${Field} label="Срок закрытия" error=${err.dl}><${DatePicker} value=${dl} min=${ymd(new Date())} onChange=${setDl}/><//>
      </div>
    <//>
    <${ModalFoot}><${Decide} actions=${[{label:'Назначить', kind:'primary', run:send}, ...actions]} extra=${extra}/><//>
  <//>`;
}

function PublishForm({r, actions, extra}){
  const [f, setF] = useState({platform:'HH', date:toInput(Date.now()), link:'', comment:''}), [err, setErr] = useState('');
  const set = k => e => setF(Object.assign({}, f, {[k]:e && e.target ? e.target.value : e}));
  const send = () => {
    if(!f.date){ setErr('Укажите дату публикации'); return; }
    Store.dispatch('publish', {id:r.id, platform:f.platform, date:fromInput(f.date), link:f.link.trim(), comment:f.comment.trim()});
  };
  return html`<${Fragment}>
    <${Box} title="Публикация вакансии">
      <div className="grid2">
        <${Field} label="Площадка"><${Select} value=${f.platform} onChange=${set('platform')} options=${Model.PLATFORMS}/><//>
        <${Field} label="Дата" error=${err}><${DatePicker} value=${f.date} onChange=${set('date')}/><//>
        <${Field} label="Ссылка" optional=${true}><input className="inp" type="url" inputMode="url" value=${f.link} onInput=${set('link')} placeholder="https://"/><//>
        <${Field} label="Комментарий" optional=${true}><input className="inp" value=${f.comment} onInput=${set('comment')}/><//>
      </div>
    <//>
    <${ModalFoot}><${Decide} actions=${[{label:'Опубликовано', kind:'primary', run:send}, ...actions]} extra=${extra}/><//>
  <//>`;
}

const VERDICT_NOTE = {hire:'Начнётся оформление.', drop:'Отказ после стажировки, место снова в подборе.', extend:'Решение перенесётся на новую дату.'};
function DecisionForm({r, h, many, actions, extra}){
  const [verdict, setVerdict] = useState(''), [comment, setComment] = useState(''), [until, setUntil] = useState(toInput(h.decideBy + 7 * Model.D)), [err, setErr] = useState({});
  const send = () => {
    const e = {};
    if(!verdict) e.verdict = 'Выберите решение';
    if(!comment.trim()) e.comment = 'Комментарий обязателен: его увидят HR и рекрутер';
    if(verdict === 'extend' && !until) e.until = 'Укажите новый срок';
    setErr(e); if(Object.keys(e).length) return;
    Store.dispatch('decide', {id:r.id, hid:h.id, verdict, comment:comment.trim(), until:verdict === 'extend' ? fromInput(until) : null});
  };
  return html`<${Fragment}>
    <${Box} title=${'Решение по стажировке' + (many ? ': ' + Model.short(h.name) : '')}>
      <div className="field">
        <${Seg} label="Решение по стажировке" value=${verdict} onChange=${x => { setVerdict(x); setErr(Object.assign({}, err, {verdict:''})); }}
          options=${[['hire','Нанимаем'], ['drop','Не продолжаем'], ['extend','Продлить']]}/>
        ${err.verdict ? html`<span className="err">${err.verdict}</span>` : verdict && html`<span className="hint">${VERDICT_NOTE[verdict]}</span>`}
      </div>
      <div className=${verdict === 'extend' ? 'grid-dc' : ''}>
        ${verdict === 'extend' && html`<${Field} label="До какого числа" error=${err.until}><${DatePicker} value=${until} min=${ymd(new Date())} onChange=${setUntil}/><//>`}
        <${Field} label=${verdict === 'extend' ? 'Причина продления' : 'Комментарий'} error=${err.comment}>
          <textarea className="inp" rows="2" value=${comment} onInput=${e => { setComment(e.target.value); setErr(Object.assign({}, err, {comment:''})); }}/>
        <//>
      </div>
    <//>
    <${ModalFoot}><${Decide} actions=${[{label:'Сохранить решение', kind:'primary', run:send}, ...actions]} extra=${extra}/><//>
  <//>`;
}

function CancelForm({r, onDone}){
  const [reason, setReason] = useState(''), [c, setC] = useState(''), [err, setErr] = useState('');
  const send = () => {
    if(!reason){ setErr('Выберите причину'); return; }
    if(reason === 'Другое' && !c.trim()){ setErr('Напишите причину'); return; }
    Store.dispatch('cancel', {id:r.id, reason, comment:c.trim()}); onDone();
  };
  return html`<div className="decide">
    <p className="note-m" style=${{margin:'0 0 10px'}}>Поиск остановится, кандидаты останутся в истории. Вернуть заявку нельзя: понадобится новая.</p>
    <div className="grid-dc">
      <${Field} label="Причина отмены" error=${!reason ? err : ''}><${Select} value=${reason} onChange=${x => { setReason(x); setErr(''); }} options=${Model.CANCEL}/><//>
      <${Field} label="Комментарий" optional=${reason !== 'Другое'} error=${reason ? err : ''}><input className="inp" value=${c} onInput=${e => { setC(e.target.value); setErr(''); }}/><//>
    </div>
    <div className="row is-end"><${Btn} kind="ghost" onClick=${onDone}>Не отменять<//><${Btn} kind="danger" onClick=${send}>Отменить заявку<//></div>
  </div>`;
}

/* ---------- действия с кандидатом: одни и те же в карточке списка и в окне кандидата ----------
   Следующий этап — главной кнопкой, отказ — с причиной. Поля оффера и даты выхода — над кнопками. */
function CandActions({r, c, v, now, small}){
  const p = Model.perms(r, v), d = (type, x) => Store.dispatch(type, Object.assign({id:r.id, cid:c.id}, x));
  const [rej, setRej] = useState(false), [reason, setReason] = useState(''), [rc, setRc] = useState(''), [err, setErr] = useState('');
  const [start, setStart] = useState(toInput(c.offer ? c.offer.start : r.start)), [pay, setPay] = useState('');
  /* в заявке вилка — точный оклад спрашиваем, когда кандидат согласился: его получит Finance */
  const range = Model.isRange(r.salary);
  useEffect(() => { setRej(false); setErr(''); }, [c.stage]);
  const rejBox = useRef(null);
  useEffect(() => { if(rej) Anim.reveal(rejBox.current); }, [rej]);
  const editor = p.editCandidates, manager = r.manager === v, open = c.stage !== 'rejected' && c.stage !== 'accepted';
  const doReject = () => {
    if(!reason){ setErr('Выберите причину'); return; }
    if(reason === 'Другое' && !rc.trim()){ setErr('Напишите причину'); return; }
    d('reject', {reason, comment:rc.trim()}); setRej(false);
  };
  if(rej) return html`<div className="decide" ref=${rejBox}>
    <p className="note-m" style=${{margin:'0 0 10px'}}>Кандидат уйдёт в отказы, руководитель увидит причину. Вернуть кандидата нельзя.</p>
    <div className="grid-dc">
      <${Field} label="Причина отказа" error=${err && !reason ? err : ''}><${Select} value=${reason} onChange=${x => { setReason(x); setErr(''); }} options=${Model.REJECT}/><//>
      <${Field} label="Комментарий" optional=${reason !== 'Другое'} error=${err && reason ? err : ''}><input className="inp" value=${rc} onInput=${e => { setRc(e.target.value); setErr(''); }}/><//>
    </div>
    <div className="row is-end"><${Btn} kind="ghost" onClick=${() => { setRej(false); setErr(''); }}>Отмена<//><${Btn} kind="danger" onClick=${doReject}>Отказать<//></div>
  </div>`;

  const actions = [];
  let fields = null;
  if(open && editor){
    if(['hr','new','test'].includes(c.stage)) actions.push({label:'Руководителю на решение', kind:'primary', run:() => d('move', {to:'mgr'})});
    /* оклад согласован в заявке, отдельно его не вводят */
    if(c.stage === 'approved') actions.push({label:'Оффер отправлен', kind:'primary', run:() => d('offer', {salary:r.salary, start:r.start})});
    if(c.stage === 'offer'){
      /* дату выхода спрашиваем один раз — когда кандидат согласился: от неё считается подготовка, её получает Finance */
      fields = html`<div className="grid2 c-fields">
        ${range && html`<${Field} label=${'Оклад (в заявке ' + r.salary + ')'} error=${err && !rej ? err : ''}><input className="inp" value=${pay} onInput=${e => { setPay(e.target.value); setErr(''); }}/><//>`}
        <${Field} label="Дата выхода"><${DatePicker} value=${start} onChange=${setStart}/><//></div>`;
      actions.push({label:'Согласился', kind:'primary', run:() => { if(range && !pay.trim()){ setErr('Укажите оклад, о котором договорились'); return; } d('accepted', {start:fromInput(start), salary:range ? pay.trim() : ''}); }},
        {label:'Отказался', kind:'danger', run:() => d('reject', {reason:'Отказался сам', comment:'Отказался от оффера'})});
    }
  }
  if(open && c.stage === 'mgr' && manager) actions.push(
    {label:'Одобрить кандидата', kind:'primary', ask:true, need:false, confirm:'Одобрить', note:'Рекрутер отправит кандидату оффер.', run:x => d('feedback', {verdict:'approve', comment:x})},
    {label:'Отказать', kind:'danger', ask:true, need:true, whom:'рекрутер', confirm:'Отказать кандидату', note:'Кандидат уйдёт в отказы, рекрутер увидит ваш комментарий. Вернуть кандидата нельзя.', run:x => d('feedback', {verdict:'reject', comment:x})});
  const canReject = open && editor && c.stage !== 'mgr' && c.stage !== 'offer';
  const extra = canReject && html`<${Btn} kind="ghost" className="btn-cancel" onClick=${() => setRej(true)}>${small ? 'Отказать' : 'Отказать кандидату'}<//>`;
  if(!actions.length && !extra) return null;
  return html`<div className=${small ? 'c-act' : null}>${fields}<${Decide} actions=${actions} extra=${extra}/></div>`;
}

/* ---------- кандидаты: карточки по этапам, всё видно без перехода ---------- */
const C_GROUPS = [['accepted','Выбраны'], ['mgr','У руководителя'], ['approved','Одобрены, ждут оффер'], ['offer','Оффер отправлен'], ['hr','Интервью HR']];
function CandCard({r, c, v, now}){
  const h = r.hires.find(x => x.cid === c.id);
  const contacts = [
    c.phone && html`<a key="p" href=${'tel:' + c.phone.replace(/\s/g, '')}><${Icon} n="phone" s=${14}/>${c.phone}</a>`,
    c.tg && html`<a key="t" href=${'https://t.me/' + c.tg.replace('@', '')} target="_blank" rel="noopener"><${Icon} n="send" s=${14}/>${c.tg}</a>`,
    c.email && html`<a key="e" href=${'mailto:' + c.email}><${Icon} n="mail" s=${14}/>${c.email}</a>`,
    c.resume && html`<a key="r" href=${c.resume} target="_blank" rel="noopener"><${Icon} n="link" s=${14}/>Резюме</a>`
  ].filter(Boolean);
  const fb = c.feedback[c.feedback.length - 1];
  const when = c.stage === 'accepted' && h ? (h.stage === 'prep' ? 'выход ' + Model.fmtDate(h.start) : '') : 'на этапе с ' + Model.fmtDate(c.stageAt);
  return html`<article className="cc" data-flip=${c.id}>
    <div className="cc-h">
      <span className="cc-a" aria-hidden="true">${initials(c.name)}</span>
      <div className="cc-t">
        <a className="cc-n" href=${'#/r/' + r.id + '/c/' + c.id}>${c.name}</a>
        <div className="cc-s">${[c.source, when].filter(Boolean).join(' · ')}</div>
      </div>
    </div>
    <${Fields} cols=${3} rows=${[['Сейчас', c.position], ['Опыт', c.experience], ['Ожидания', c.expect]]}/>
    ${contacts.length > 0 && html`<div className="cc-c">${contacts}</div>`}
    ${c.comment && html`<p className="cc-x">${c.comment}</p>`}
    ${fb && html`<div className="cc-f"><span className=${fb.verdict === 'approve' ? 'ok' : 'late'}>${fb.verdict === 'approve' ? 'Руководитель одобрил' : 'Руководитель отказал'}</span>${fb.comment && html`: ${fb.comment}`}</div>`}
    <${CandActions} r=${r} c=${c} v=${v} now=${now} small=${true}/>
  </article>`;
}
function Candidates({r, v, now, canAdd, guard}){
  const manager = r.manager === v, [showRej, setShowRej] = useState(false), [adding, setAdding] = useState(false);
  const ref = useRef(null), rejRef = useExpand(showRej); useFlip(ref);
  const live = r.candidates.filter(c => c.stage !== 'rejected'), rej = r.candidates.filter(c => c.stage === 'rejected');
  const groups = C_GROUPS.map(([k, t]) => [k, k === 'mgr' && manager ? 'Ждут вашего ответа' : t, live.filter(c => c.stage === k || (k === 'hr' && (c.stage === 'new' || c.stage === 'test'))).sort((a, b) => b.stageAt - a.stageAt)]).filter(g => g[2].length);
  return html`<section className="cands" ref=${ref}>
    <div className="cands-h"><h3 className="box-t">Кандидаты <span className="muted num">${live.length}</span></h3>
      ${r.seats > 1 && html`<span className="muted cands-left">Нужно ещё ${r.seats - Model.activeHires(r).length} из ${r.seats}</span>`}
      ${canAdd && !adding && html`<${Btn} onClick=${() => setAdding(true)}><${Icon} n="plus" s=${15}/>Добавить кандидата<//>`}</div>
    ${adding && html`<${AddCandidate} r=${r} guard=${guard} onCancel=${() => { guard.current = false; setAdding(false); }} onDone=${() => { guard.current = false; setAdding(false); }}/>`}
    ${!live.length && !adding && html`<p className="muted" style=${{margin:0}}>Кандидатов пока нет</p>`}
    ${groups.map(([k, t, list]) => html`<div className="cg" key=${k}>
      <h4 data-flip=${'g' + k} className=${'cg-t' + (k === 'mgr' && manager ? ' is-mine' : '')}>${t} <span className="num">${list.length}</span></h4>
      ${list.map(c => html`<${CandCard} key=${c.id} r=${r} c=${c} v=${v} now=${now}/>`)}
    </div>`)}
    ${rej.length > 0 && html`<div className="cg">
      <h4 className="cg-t" data-flip="rej"><button className="fold" aria-expanded=${showRej} onClick=${() => setShowRej(!showRej)}>Отказы <span className="num">${rej.length}</span>
        <span className="fold-i" aria-hidden="true"><${Icon} n="down" s=${14}/></span></button></h4>
      ${showRej && html`<div className="crej" ref=${rejRef}>${rej.map(c => html`<a key=${c.id} className="crej-r" href=${'#/r/' + r.id + '/c/' + c.id}>
        <span className="crej-n">${c.name}</span><span className="muted">${c.reject.reason}</span><span className="muted num">${Model.fmtDate(c.reject.at)}</span></a>`)}</div>`}
    </div>`}
  </section>`;
}

/* ---------- справа: история и сведения ---------- */
const TL_ICON = {new:'doc', ok:'ok', stop:'no', ret:'ret', ev:'ev'};
const ROLE_NAME = p => p.role === 'manager' ? 'Руководитель' : p.role === 'recruiter' ? 'Рекрутер' : Model.ROLE[p.role];
const whoLine = id => { const p = Model.PEOPLE[id]; return p ? ROLE_NAME(p) + ' — ' + p.name : ''; };
/* записи в истории написаны от мужского рода; для женщин глагол меняется при показе */
const FEM = /^(Создал|Отправил|Вернул|Принял|Согласовал|Отклонил|Одобрил|Назначил|Взял|Опубликовал|Добавил|Отказал|Отметил|Снял|Продлил|Отменил|Изменил|Доработал)(?=[\s:])/;
const byGender = (text, id) => !(Model.PEOPLE[id] || {}).f ? text : text.replace(FEM, '$1а').replace(/^Учёл/, 'Учла').replace(' и отправил ', ' и отправила ');
function logKind(l){
  if(l.step === 'created') return 'new';
  if(l.step === 'reject' || l.step === 'cancel' || /^Отказал|^Не продолжаем/.test(l.text)) return 'stop';
  if(l.step === 'return') return 'ret';
  if(['hr','finance','ceo','feedback','accepted','registered','finaccept','fot','closed'].includes(l.step) || /нанимаем/.test(l.text)) return 'ok';
  return 'ev';
}
function Timeline({items, limit = 6}){
  const [all, setAll] = useState(false), ol = useRef(null), count = useRef(items.length), shown = useRef(0);
  /* новое событие, пока окно открыто, проявляется внизу истории */
  useLayoutEffect(() => {
    const n = items.length, was = count.current; count.current = n;
    if(n > was && ol.current) Anim.stagger(Array.from(ol.current.children).slice(-(n - was)), 8);
  }, [items.length]);
  /* «Ещё N событий» — ранние события проявляются сверху по очереди */
  useLayoutEffect(() => { if(all && shown.current && ol.current) Anim.stagger(Array.from(ol.current.children).slice(0, shown.current).reverse(), -8); }, [all]);
  items = items.slice().sort((a, b) => a.at - b.at);
  const hidden = !all && items.length > limit ? items.length - limit : 0;
  if(hidden) shown.current = hidden;
  return html`<div>
    ${hidden > 0 && html`<button className="tl-more" onClick=${() => setAll(true)}><${Icon} n="down" s=${14}/>Ещё ${hidden} ${Model.plural(hidden, 'событие', 'события', 'событий')}</button>`}
    <ol className="tl" ref=${ol}>${items.slice(hidden).map((x, i) => html`<li key=${i}>
      <span className=${'tl-i is-' + x.kind}><${Icon} n=${TL_ICON[x.kind]} s=${18}/></span>
      <div className="tl-b">
        <div className="tl-top"><span className="tl-t">${x.title}</span><time className="tl-d num">${Model.fmtDateTime(x.at)}</time></div>
        ${x.who && html`<div className="tl-w">${x.who}</div>`}
        ${x.comment && html`<blockquote className="tl-c">${x.comment}</blockquote>`}
      </div>
    </li>`)}</ol>
  </div>`;
}
function Side({info, history}){
  return html`<aside className="mside">
    ${history && html`<${Box} title="История"><${Timeline} items=${history}/><//>`}
    <${Box} title="Информация"><${Fields} cols=${1} rows=${info}/><//>
  </aside>`;
}

function Redirect({to}){ useEffect(() => { location.replace(to); }, []); return null; }

/* ---------- сейчас: чей ход, если не ваш. Без «сколько ждёт» — только кто и что делает, и срок, если он есть ---------- */
function NowBox({r, turns}){
  if(!turns.length) return null;
  const many = r.seats > 1;
  return html`<div className="nowb">
    <div className="nowb-h">Сейчас</div>
    ${turns.map((t, i) => html`<div className="nowb-r" key=${i}>
      <span className="nowb-t">${t.full || t.text}${many && t.hn ? ': ' + t.hn : ''}</span>
      <span className="nowb-p">${name(t.p)}${t.due ? html`<span className="num">, до ${Model.fmtDate(t.due)}</span>` : ''}</span>
    </div>`)}
  </div>`;
}

/* ---------- окно заявки ---------- */
function RequestPage({r, view, cid, startReview}){
  const v = useViewer(), now = useNow();
  const p = Model.perms(r, v), guard = useRef(false);
  const [cancel, setCancel] = useState(false), [ask, setAsk] = useState(null);
  /* режим замечаний: проверяющий нажимает на поле заявки и пишет, что исправить */
  const [rev, setRev] = useState(null), [revC, setRevC] = useState(''), [revErr, setRevErr] = useState('');
  const startReview_ = () => { setRev({notes:{}, open:null}); setRevC(''); setRevErr(''); };
  useEffect(() => { setCancel(false); setRev(null); }, [r.id, v, r.status]);
  useEffect(() => { if(startReview && (r.status === 'hr' || r.status === 'finance')) startReview_(); }, [startReview]);
  const review = rev && {notes:rev.notes, open:rev.open, setOpen:k => setRev(Object.assign({}, rev, {open:k})),
    setNote:(k, t) => { const n = Object.assign({}, rev.notes); if(t.trim()) n[k] = t; else delete n[k]; setRev(Object.assign({}, rev, {notes:n})); setRevErr(''); }};
  const sendReturn = () => {
    const n = Object.fromEntries(Object.entries(rev.notes).map(([k, t]) => [k, t.trim()]));
    if(!Object.keys(n).length && !revC.trim()){ setRevErr('Отметьте поля или напишите, что исправить: без этого руководитель не поймёт, что менять'); return; }
    Store.dispatch(r.status === 'finance' ? 'finReturn' : 'hrReturn', {id:r.id, comment:revC.trim(), notes:n});
  };

  const leave = then => { if(guard.current){ setAsk(() => then); return; } then(); };
  useEffect(() => { Panel.leave = leave; });
  useEffect(() => () => { Panel.leave = f => f(); }, []);
  /* решение сменило шаг заявки — новое дело появляется блоками, а не возникает разом */
  /* появляются только новые блоки: то, что было и осталось, не мигает */
  const mm = useRef(null), stWas = useRef(r.status), seen = useRef(new WeakSet());
  useLayoutEffect(() => {
    const kids = mm.current ? Array.from(mm.current.children) : [];
    if(stWas.current !== r.status){ stWas.current = r.status; Anim.stagger(kids.filter(el => !seen.current.has(el)), 12, .05); }
    kids.forEach(el => seen.current.add(el));
  });

  if(view === 'cand' || view === 'add'){
    const c = r.candidates.find(x => x.id === cid);
    return html`<div>
      ${view === 'add' ? html`<${Redirect} to=${'#/r/' + r.id}/>`
        : c ? html`<${CandidateView} r=${r} c=${c} v=${v} now=${now}/>` : html`<div className="mpage"><${ModalHead} title="Кандидат не найден" sub=${html`<${BackLink} href=${'#/r/' + r.id}>${r.title}<//>`}/></div>`}
      ${ask && html`<div className="guard" role="alert"><span>Кандидат не добавлен. Выйти без сохранения?</span>
        <${Btn} kind="danger" onClick=${() => { const f = ask; setAsk(null); guard.current = false; f(); }}>Выйти<//><${Btn} kind="ghost" onClick=${() => setAsk(null)}>Остаться<//></div>`}
    </div>`;
  }

  const st = r.status, stopped = st === 'rejected' || st === 'cancelled';
  const d = (type, x) => Store.dispatch(type, Object.assign({id:r.id}, x));
  const mine = Model.turns(r).filter(t => Model.mineTurn(t, v)), reqTurn = mine.find(t => !t.h);
  const open = Model.openHires(r), searching = ['assign','assigned','inwork','published'].includes(st) && Model.activeHires(r).length < r.seats;
  const many = r.seats > 1;
  const approving = ['draft','returned','hr','finance','ceo','rejected'].includes(st) || (st === 'cancelled' && !lastLog(r, 'ceo'));

  /* кнопки внизу: решение по заявке, затем шаги выбранных, затем «Отменить заявку» */
  const actions = [];
  let form = null;
  if(reqTurn) switch(st){
    case 'draft': actions.push({label:'Дописать заявку', kind:'primary', run:() => go('#/r/' + r.id + '/edit')}); break;
    case 'returned': break;
    case 'hr': actions.push({label:'Принять', kind:'primary', run:c => d('hrAccept', {comment:c})},
      {label:'На доработку', run:() => startReview_()}); break;
    case 'finance': actions.push({label:'Согласовать', kind:'primary', run:c => d('finApprove', {comment:c})},
      {label:'На доработку', run:() => startReview_()},
      {label:'Отклонить', kind:'danger', ask:true, need:true, whom:'руководитель', confirm:'Отклонить заявку', note:REJECT_NOTE, run:c => d('finReject', {comment:c})}); break;
    case 'ceo': actions.push({label:'Одобрить', kind:'primary', run:c => d('ceoApprove', {comment:c})},
      {label:'Отклонить', kind:'danger', ask:true, need:true, whom:'руководитель', confirm:'Отклонить заявку', note:REJECT_NOTE, run:c => d('ceoReject', {comment:c})}); break;
    case 'assign': form = 'assign'; break;
    case 'assigned': case 'inwork': form = 'publish'; break;
  }
  let decide = null;
  mine.filter(t => t.h).forEach(t => {
    const h = r.hires.find(x => x.id === t.h), who = many ? ': ' + Model.short(h.name) : '';
    if(h.stage === 'prep') actions.push({label:'Вышел на стажировку' + who, kind:'primary', disabled:Model.listLeft(h.lists.prep) > 0, run:() => d('started', {hid:h.id})});
    if(h.stage === 'intern' && !decide) decide = h;
    if(h.stage === 'docs') actions.push({label:'Сотрудник оформлен' + who, kind:'primary', disabled:Model.listLeft(h.lists.docs) > 0, run:() => d('registered', {hid:h.id})});
    if(h.stage === 'fot' || h.stage === 'fin') actions.push({label:'Учесть в ФОТ' + who, kind:'primary', run:() => d('fot', {hid:h.id, comment:''})});
  });
  const extra = p.cancel && html`<${Btn} kind="ghost" className="btn-cancel" onClick=${() => setCancel(true)}>Отменить заявку<//>`;

  /* слева — дело этого шага, под ним заявка. Хода нет — сверху «Сейчас»: кто и что делает */
  const main = [];
  const owner = r.manager === v || r.initiator === v, editing = st === 'returned' && owner;
  if(!mine.length && !stopped && st !== 'closed' && !editing) main.push(html`<${NowBox} key="now" r=${r} turns=${Model.turns(r)}/>`);
  if(st === 'returned'){
    const ns = Object.entries(r.returned.notes || {});
    const jump = k => { const el = document.querySelector('.modal [data-f="' + k + '"]'); if(!el) return; el.scrollIntoView({block:'center', behavior:Anim.on() ? 'smooth' : 'auto'}); const f = el.querySelector('input,textarea,button'); f && f.focus({preventScroll:true}); };
    main.push(html`<div className="note" key="ret"><div className="note-t">Что просят исправить</div>
      ${r.returned.comment && html`<blockquote className="note-q">${r.returned.comment}</blockquote>`}
      ${ns.length > 0 && html`<ul className="ret-l">${ns.map(([k, t]) => html`<li key=${k}>${editing ? html`<button type="button" className="link-btn" onClick=${() => jump(k)}>${Model.FIELD_NAMES[k]}</button>` : html`<b>${Model.FIELD_NAMES[k]}</b>`}: ${t}</li>`)}</ul>`}
      <div className="note-m">${name(r.returned.by)}, ${Model.fmtDateTime(r.returned.at)}</div></div>`);
  }
  if(editing) main.push(html`<${RequestForm} key="edit" r=${r} inline=${true} guard=${guard} notes=${r.returned.notes || {}}/>`);
  if(st === 'finance' || st === 'ceo'){
    const hr = lastLog(r, 'hr'), fin = lastLog(r, 'finance');
    if(hr && hr.comment) main.push(html`<${Note} key="hr" title="Комментарий HR" by=${hr.by} at=${hr.at} quote=${hr.comment}/>`);
    if(st === 'ceo' && fin) main.push(html`<${Note} key="fin" title=${'Finance согласовал' + (fin.comment ? '' : ' без комментария')} by=${fin.by} at=${fin.at} quote=${fin.comment}/>`);
  }
  if(stopped) main.push(html`<${Stopped} key="stop" r=${r}/>`);
  if(st === 'closed') main.push(html`<${Result} key="res" r=${r}/>`);
  if(form === 'assign') main.push(html`<${AssignForm} key="as" r=${r} actions=${actions} extra=${extra}/>`);
  if(form === 'publish') main.push(html`<${PublishForm} key="pub" r=${r} actions=${actions} extra=${extra}/>`);
  open.forEach(h => main.push(html`<${HireWork} key=${h.id} r=${r} h=${h} v=${v} showName=${many}/>`));
  if(decide && !cancel) main.push(html`<${DecisionForm} key=${'dc' + decide.id} r=${r} h=${decide} many=${many} actions=${actions} extra=${extra}/>`);
  if(searching && st === 'published' && p.candidates) main.push(html`<${Candidates} key="c" r=${r} v=${v} now=${now} canAdd=${p.editCandidates} guard=${guard}/>`);
  if(p.request && !editing) main.push(approving ? html`<${Brief} key="brief" r=${r} v=${v} review=${review}/>` : html`<${RequestBox} key="rb" r=${r} v=${v}/>`);

  const own = ((form || decide) && !cancel) || editing;
  const late = r.deadline && r.deadline < now && Model.phase(r) !== 'closed';
  const pubs = r.publications;
  const info = [
    ['Подал', name(r.initiator)],
    ['Руководитель', r.manager !== r.initiator && name(r.manager)],
    ['Рекрутер', r.recruiter && name(r.recruiter)],
    ['Дата создания', Model.fmtDate(r.created, true)],
    ['Срок закрытия', r.deadline && html`<span className=${'num' + (late ? ' late' : '')}>${late ? html`<${Icon} n="late" s=${14} label="Срок прошёл"/> ` : ''}${Model.fmtDate(r.deadline, true)}</span>`],
    ['Публикация', pubs.length > 0 && html`${pubs.map((x, i) => html`<${Fragment} key=${i}>${i ? ', ' : ''}${x.link ? html`<a href=${x.link} target="_blank" rel="noopener">${x.platform}</a>` : x.platform}<//>`)}`],
    ['Последнее обновление', Model.fmtDate(r.updated, true)]
  ];
  const log = p.history && r.log.filter(l => !/^(Отметил|Снял отметку):/.test(l.text)).map(l => ({at:l.at, title:byGender(l.text, l.by), who:whoLine(l.by), comment:l.comment, kind:logKind(l)}));

  return html`<div className="mgrid">
    <${ModalHead} title=${html`${r.title}${r.seats > 1 && html`<small className="num">× ${r.seats}</small>`}`} sub=${r.dept + ' / ' + r.project} strip=${html`<${Strip} steps=${stripSteps(r)}/>`}/>
    <div className="mmain" ref=${mm}>${main}</div>
    <${Side} info=${info} history=${log}/>
    ${ask && html`<${ModalFoot}><div className="row is-end guard-row" role="alert"><span>Есть несохранённые изменения. Выйти без сохранения?</span>
      <${Btn} kind="ghost" onClick=${() => setAsk(null)}>Остаться<//><${Btn} kind="danger" onClick=${() => { const f = ask; setAsk(null); guard.current = false; f(); }}>Выйти<//></div><//>`}
    ${ask ? null : rev ? html`<${ModalFoot}><${ReturnForm} count=${Object.keys(rev.notes).length} comment=${revC} setComment=${t => { setRevC(t); setRevErr(''); }} err=${revErr} onCancel=${() => setRev(null)} onSend=${sendReturn}/><//>`
      : cancel ? html`<${ModalFoot}><${CancelForm} r=${r} onDone=${() => setCancel(false)}/><//>`
      : !own && (actions.length || extra) ? html`<${ModalFoot}><${Decide} actions=${actions} extra=${extra}/><//>` : null}
  </div>`;
}

/* ---------- окно кандидата: слева сведения и решение, справа документ — как договор в burabay-gis ----------
   Резюме открыто сразу: руководителю не нужно никуда проваливаться, чтобы решить. Вкладки — файлы кандидата.
   В прототипе загруженный файл виден, пока открыта вкладка браузера: настоящее хранение появится с сервером. */
const FILE_KINDS = ['Резюме','Портфолио','Тестовое задание','Результат тестового','Рекомендации','Другое'];
const FILE_URLS = new Map();
const fileKey = (c, f) => c.id + '/' + f.name + '/' + f.size;

/* резюме в прототипе собирается из сведений о кандидате и заявки; с сервером здесь будет сам файл */
function resumeOf(c, r){
  const years = parseInt(c.experience, 10) || 2, now = new Date().getFullYear();
  const duties = (r.duties || '').split(/[,.;]\s*/).map(x => x.trim()).filter(Boolean);
  const skills = (r.skills || '').split(/,\s*/).filter(Boolean);
  const prev = c.position && /,|в /.test(c.position) ? c.position.split(/,| в /)[0].trim() : r.title;
  return {
    head:c.name, sub:[c.position, 'Алматы'].filter(Boolean).join(' · '),
    contacts:[c.phone, c.tg, c.email].filter(Boolean).join('   '),
    jobs:[
      {when:(now - Math.min(years, 2)) + ' — по настоящее время', what:c.position || r.title, items:duties.slice(0, 3).map(d => d[0].toUpperCase() + d.slice(1))},
      years > 2 && {when:(now - years) + ' — ' + (now - 2), what:'Младший ' + prev.toLowerCase(), items:['Работа в команде над проектами компании', 'Подготовка материалов по задачам руководителя']}
    ].filter(Boolean),
    skills, edu:r.education || 'Высшее', about:c.comment, expect:c.expect
  };
}
function Paper({c, r}){
  const d = resumeOf(c, r);
  return html`<article className="paper">
    <h2 className="pp-h">${d.head}</h2>
    <p className="pp-sub">${d.sub}</p>
    ${d.contacts && html`<p className="pp-c">${d.contacts}</p>`}
    ${d.expect && html`<p className="pp-c">Желаемая зарплата: ${d.expect}</p>`}
    <h3 className="pp-s">Опыт работы</h3>
    ${d.jobs.map((j, i) => html`<div className="pp-job" key=${i}><div className="pp-when">${j.when}</div><div><b>${j.what}</b>
      ${j.items.length > 0 && html`<ul>${j.items.map((x, k) => html`<li key=${k}>${x}</li>`)}</ul>`}</div></div>`)}
    ${d.skills.length > 0 && html`<${Fragment}><h3 className="pp-s">Навыки</h3><p>${d.skills.join(' · ')}</p><//>`}
    <h3 className="pp-s">Образование</h3><p>${d.edu}</p>
    ${d.about && html`<${Fragment}><h3 className="pp-s">О себе</h3><p>${d.about}</p><//>`}
  </article>`;
}
function DocPane({r, c, can}){
  const docs = [{k:'cv', name:'Резюме'}].concat(c.files.map((f, i) => ({k:'f' + i, name:f.kind === 'Резюме' ? 'Резюме, файл' : f.kind, f})));
  const [tab, setTab] = useState('cv'), [kind, setKind] = useState('Портфолио'), [, force] = useState(0), inp = useRef(null);
  const doc = docs.find(x => x.k === tab) || docs[0], url = doc.f && FILE_URLS.get(fileKey(c, doc.f)), pane = useRef(null), first = useRef(true);
  /* другая вкладка — лист меняется плавно */
  useLayoutEffect(() => { if(first.current){ first.current = false; return; } if(pane.current){ pane.current.scrollTop = 0; Anim.page(pane.current.firstElementChild); } }, [tab]);
  const add = e => {
    const fs = Array.from(e.target.files); e.target.value = '';
    if(!fs.length) return;
    fs.forEach(f => FILE_URLS.set(fileKey(c, {name:f.name, size:f.size}), {url:URL.createObjectURL(f), type:f.type}));
    Store.dispatch('addFiles', {id:r.id, cid:c.id, files:fs.map(f => ({name:f.name, size:f.size, kind}))});
    setTab('f' + c.files.length); force(x => x + 1);
  };
  return html`<section className="doc" aria-label="Документы кандидата">
    <div className="doc-bar">
      ${docs.length > 1 ? html`<div className="seg" role="tablist" aria-label="Документы">${docs.map(x => html`<button key=${x.k} type="button" role="tab" aria-selected=${x.k === doc.k} aria-pressed=${x.k === doc.k} onClick=${() => setTab(x.k)}>${x.name}</button>`)}</div>`
        : html`<span className="doc-t">Резюме</span>`}
      <div className="doc-act">
        ${doc.k === 'cv' && c.resume && html`<a className="btn btn-secondary btn-sm" href=${c.resume} target="_blank" rel="noopener"><${Icon} n="ext" s=${15}/>Открыть оригинал<//>`}
        ${url && html`<a className="icon-btn" href=${url.url} download=${doc.f.name} aria-label="Скачать"><${Icon} n="dl" s=${18}/></a>`}
        ${can && html`<div style=${{width:170}}><${Select} label="Что прикрепляете" value=${kind} onChange=${setKind} options=${FILE_KINDS}/></div>
          <${Btn} className="btn-sm" onClick=${() => inp.current.click()}><${Icon} n="clip" s=${15}/>Прикрепить<//>
          <input ref=${inp} type="file" multiple hidden accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" onChange=${add}/>`}
      </div>
    </div>
    <div className="doc-pane" ref=${pane}>
      ${doc.k === 'cv' ? html`<${Paper} c=${c} r=${r}/>`
        : url && /pdf/.test(url.type) ? html`<iframe className="doc-frame" src=${url.url} title=${doc.f.name}></iframe>`
        : url && /^image\//.test(url.type) ? html`<img className="doc-img" src=${url.url} alt=${doc.f.name}/>`
        : html`<div className="no-scan"><${Icon} n="doc" s=${28}/><p>${doc.f.name}</p><small className="muted">${url ? 'Предпросмотр этого формата появится с сервером' : 'Файл прикреплён до перезагрузки страницы; с сервером он будет храниться'}</small>
          ${url && html`<a className="btn btn-secondary" href=${url.url} download=${doc.f.name}><${Icon} n="dl" s=${15}/>Скачать</a>`}</div>`}
    </div>
  </section>`;
}

function CandidateView({r, c, v, now}){
  const h = r.hires.find(x => x.cid === c.id);
  const stageName = c.stage === 'rejected' ? 'Отказ' : c.stage === 'accepted' ? (h ? {prep:'Выход ' + Model.fmtDate(h.start), intern:'На стажировке', docs:'Оформляется', fin:'Оформлен', fot:'Оформлен', done:'В штате', dropped:'Не продолжили после стажировки'}[h.stage] : 'Согласился')
    : c.stage === 'approved' ? 'Одобрен руководителем' : c.stage === 'mgr' ? 'У руководителя' : c.stage === 'offer' ? 'Оффер отправлен' : 'Интервью HR';
  const ckind = x => /одобрил$|согласил|Выбран|нанимаем/i.test(x.text) ? 'ok' : /отказ/i.test(x.text) ? 'stop' : 'ev';
  const ctimeline = c.timeline.map((x, i) => ({at:x.at, title:x.text, who:x.by ? whoLine(x.by) : '', kind:i === 0 ? 'new' : ckind(x)}));
  const link = (href, t, ext) => html`<a href=${href} target=${ext ? '_blank' : undefined} rel=${ext ? 'noopener' : undefined}>${t}</a>`;

  return html`<div className="cgrid">
    <${ModalHead} title=${c.name} sub=${html`<${BackLink} href=${'#/r/' + r.id}>${r.title}<//>`} strip=${html`<${Strip} steps=${candSteps(c)}/>`}/>
    <div className="cside">
      ${c.stage === 'rejected' && html`<${Note} title=${'Отказ: ' + c.reject.reason.toLowerCase()} by=${c.reject.by} at=${c.reject.at} quote=${c.reject.comment}/>`}
      <${Box} title="Кандидат"><${Fields} cols=${2} rows=${[['Этап', stageName], ['Откуда', c.source], ['Сейчас работает', c.position, true], ['Опыт', c.experience], ['Ожидания', c.expect],
        ['Телефон', c.phone && link('tel:' + c.phone.replace(/\s/g, ''), c.phone)], ['Telegram', c.tg && link('https://t.me/' + c.tg.replace('@', ''), c.tg, true)],
        ['Почта', c.email && link('mailto:' + c.email, c.email), true], ['Комментарий рекрутера', c.comment && html`<span className="text">${c.comment}</span>`, true]]}/><//>
      ${c.feedback.length > 0 && html`<${Box} title="Ответ руководителя">
        ${c.feedback.map((f, i) => html`<div key=${i} className="fb"><div className=${f.verdict === 'approve' ? 'ok' : 'late'}>${f.verdict === 'approve' ? 'Одобрил' : 'Отказал'}<span className="muted">, ${name(f.by)}, ${Model.fmtDate(f.at)}</span></div>${f.comment && html`<blockquote className="tl-c">${f.comment}</blockquote>`}</div>`)}
      <//>`}
      <${Box} title="История"><${Timeline} items=${ctimeline} limit=${4}/><//>
    </div>
    <${DocPane} r=${r} c=${c} can=${Model.perms(r, v).editCandidates}/>
    <${ModalFoot}><${CandActions} r=${r} c=${c} v=${v} now=${now}/><//>
  </div>`;
}

/* ---------- новый кандидат: контакты, затем о кандидате ---------- */
function AddCandidate({r, onDone, onCancel, guard}){
  const [f, setF] = useState({name:'', phone:'', tg:'', email:'', resume:'', source:'', expect:'', position:'', experience:'', comment:''});
  const [err, setErr] = useState({}), box = useRef(null);
  useEffect(() => { const el = box.current; if(!el) return; el.scrollIntoView({block:'nearest', behavior:Anim.on() ? 'smooth' : 'auto'}); Anim.reveal(el); el.querySelector('input').focus({preventScroll:true}); }, []);
  const set = k => e => { const n = Object.assign({}, f, {[k]:e.target.value}); setF(n); guard.current = Object.values(n).some(x => x.trim()); if(err[k] || err.contact) setErr({}); };
  const send = () => {
    const e = {};
    if(!f.name.trim()) e.name = 'Укажите ФИО';
    if(!f.phone.trim() && !f.tg.trim() && !f.email.trim()) e.contact = 'Нужен телефон, Telegram или почта';
    if(!f.source) e.source = 'Укажите, откуда кандидат';
    setErr(e);
    if(Object.keys(e).length){ const k = Object.keys(e)[0]; const el = document.getElementById('ac-' + (k === 'contact' ? 'phone' : k)); el && el.focus(); return; }
    guard.current = false;
    const cid = Store.dispatch('addCandidate', {id:r.id, fields:Object.fromEntries(Object.entries(f).map(([k, x]) => [k, x.trim()]))});
    onDone(cid);
  };
  return html`<div className="box add-c" ref=${box}>
    <div className="box-h"><h3 className="box-t">Новый кандидат</h3></div>
    <div className="grid-dc">
      <${Field} id="ac-name" label="ФИО" error=${err.name}><input className="inp" value=${f.name} onInput=${set('name')} autoComplete="off"/><//>
      <${Field} id="ac-source" label="Откуда" error=${err.source}><${Select} value=${f.source} onChange=${x => set('source')({target:{value:x}})} options=${Model.SOURCES}/><//>
    </div>
    <div className="grid3">
      <${Field} id="ac-phone" label="Телефон" error=${err.contact}><input className="inp" type="tel" value=${f.phone} onInput=${set('phone')} placeholder="+7"/><//>
      <${Field} label="Telegram"><input className="inp" value=${f.tg} onInput=${set('tg')} placeholder="@"/><//>
      <${Field} label="Почта"><input className="inp" type="email" value=${f.email} onInput=${set('email')}/><//>
    </div>
    <div className="grid3">
      <${Field} label="Сейчас работает" optional=${true}><input className="inp" value=${f.position} onInput=${set('position')}/><//>
      <${Field} label="Опыт" optional=${true}><input className="inp" value=${f.experience} onInput=${set('experience')}/><//>
      <${Field} label="Ожидания по зарплате" optional=${true}><input className="inp" value=${f.expect} onInput=${set('expect')}/><//>
    </div>
    <div className="grid-dc">
      <${Field} label="Ссылка на резюме" optional=${true}><input className="inp" type="url" value=${f.resume} onInput=${set('resume')} placeholder="https://"/><//>
      <${Field} label="Комментарий" optional=${true}><input className="inp" value=${f.comment} onInput=${set('comment')}/><//>
    </div>
    <div className="row is-end"><${Btn} kind="ghost" onClick=${onCancel}>Отмена<//><${Btn} kind="primary" onClick=${send}>Добавить<//></div>
  </div>`;
}
const Panel = {leave:f => f()};
