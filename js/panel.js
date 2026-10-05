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
function Fields({rows, cols = 2}){
  const list = rows.filter(x => x[1]);
  if(!list.length) return null;
  return html`<dl className=${'fields is-' + cols}>${list.map(([k, val, wide]) => html`<div key=${k} className=${wide ? 'is-wide' : null}><dt>${k}</dt><dd>${val}</dd></div>`)}</dl>`;
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
function StepRow({steps, name}){
  const ref = useRef(null);
  useLayoutEffect(() => {
    const ol = ref.current, el = ol && ol.querySelector('.is-now, .is-stop');
    const over = ol && ol.scrollWidth > ol.clientWidth + 1;
    if(ol) ol.classList.toggle('is-over', !!over);
    if(el && over) ol.scrollLeft = Math.max(0, el.offsetLeft - 40);
  });
  return html`<div className="rp-row">
    ${name && html`<span className="rp-hn">${name}</span>`}
    <ol className="rp" ref=${ref} aria-label=${name ? 'Шаги: ' + name : 'Шаги'}>${steps.map(s => html`<li key=${s.k} className=${'is-' + s.state} title=${s.tip || null}>
      <span className="rp-d" aria-hidden="true">${s.state === 'done' ? html`<${Icon} n="check" s=${10} w=${3}/>` : s.state === 'stop' ? html`<${Icon} n="x" s=${10} w=${3}/>` : null}</span>
      <span className="rp-l">${s.label}</span><span className="sr">${STATE_SR[s.state]}${s.tip ? ', ' + s.tip : ''}</span>
    </li>`)}</ol>
  </div>`;
}
function Strip({rows}){
  return html`<div className="strip">${rows.map((x, i) => html`<${StepRow} key=${x.key || i} steps=${x.steps} name=${x.name}/>`)}</div>`;
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
function stripRows(r){
  const st = r.status;
  if(['draft','returned','hr','finance','ceo','rejected'].includes(st)) return [{key:'a', steps:approveSteps(r)}];
  if(st === 'cancelled'){
    const steps = (lastLog(r, 'ceo') ? searchSteps(r) : approveSteps(r)).filter(x => x.state !== 'next' && x.state !== 'now');
    steps.push({k:'stop', label:'Отменено', state:'stop', tip:logTip(lastLog(r, 'cancel'))});
    return [{key:'c', steps}];
  }
  const rows = [], many = r.seats > 1;
  if(Model.activeHires(r).length < r.seats) rows.push({key:'s', steps:searchSteps(r)});
  const hs = st === 'closed' ? r.hires.filter(h => h.stage === 'done') : Model.openHires(r);
  hs.forEach(h => rows.push({key:h.id, name:many ? Model.short(h.name) : null, steps:hireSteps(h)}));
  return rows.length ? rows : [{key:'s', steps:searchSteps(r)}];
}

const C_STEPS = [['new','Новый'], ['hr','Интервью HR'], ['test','Тестовое'], ['mgr','Руководитель'], ['offer','Оффер'], ['accepted','Согласился']];
function candSteps(c){
  const rej = c.stage === 'rejected', at = rej ? c.reject.from : c.stage === 'approved' ? 'offer' : c.stage;
  let pos = C_STEPS.findIndex(x => x[0] === at);
  if(pos < 0 || (!rej && at === 'accepted')) pos = C_STEPS.length;
  const tested = (c.timeline || []).some(x => x.text.startsWith('Отправлено тестовое'));
  let s = C_STEPS.map(([k, label], j) => ({k, label,
    state:j < pos ? (k === 'test' && !tested ? 'skip' : 'done') : j === pos ? (rej ? 'stop' : 'now') : 'next',
    tip:k === 'test' && j < pos && !tested ? 'пропущено' : ''}));
  if(rej){ s = s.filter(x => x.state !== 'next'); if(pos === C_STEPS.length) s.push({k:'stop', label:'Отказ', state:'stop'}); }
  return s;
}

/* ---------- заявка: все поля ТЗ, разложенные по смыслу ----------
   Finance и CEO решают про деньги — у них условия первыми. */
function briefParts(r, v){
  const p = Model.perms(r, v), role = Model.PEOPLE[v].role;
  const txt = s => s && html`<span className="text">${s}</span>`;
  const files = r.files && r.files.length > 0 && html`<ul className="files">${r.files.map((f, i) => html`<li key=${i}><${Icon} n="clip" s=${15}/>${f.name}</li>`)}</ul>`;
  const who = ['who', 'Кого ищем', [['Обязанности', txt(r.duties), true], ['Требования', txt(r.reqs), true], ['Опыт', r.experience], ['Навыки', r.skills],
    ['Личные качества', r.personal], ['Образование', r.education], ['Дополнительные требования', txt(r.extra), true]]];
  const cond = ['cond', 'Условия', [['Зарплата', p.salary && r.salary], ['Бонусы / KPI', p.salary && r.bonus], ['Формат работы', r.format], ['Локация', r.location],
    ['График', r.schedule], ['Тип занятости', r.employment], ['Испытательный срок', r.probation], ['Желаемая дата выхода', Model.fmtDate(r.start, true)]]];
  const why = ['why', 'Зачем открываем', [['Причина', Model.REASONS[r.reason] && Model.REASONS[r.reason] + (r.reasonOther ? ': ' + r.reasonOther : '')],
    ['Сколько человек', String(r.seats || 1)], ['Приоритет', r.priority === 'high' ? 'Срочно' : 'Обычный'], ['Комментарий для HR', txt(r.comment), true], ['Файлы', files, true]]];
  return role === 'finance' || role === 'ceo' ? [cond, why, who] : [who, cond, why];
}
/* на согласовании заявка — само дело: три блока подряд */
function Brief({r, v}){
  return briefParts(r, v).map(([k, t, rows]) => html`<${Box} key=${k} title=${t}><${Fields} rows=${rows}/><//>`);
}
/* после согласования заявка — справка под делом шага: открыта, можно свернуть; выбор помнится */
function RequestBox({r, v}){
  const [open, setOpen] = useState(() => { try { return localStorage.getItem('hr-brief') !== '0'; } catch(e) { return true; } });
  const toggle = () => { const n = !open; setOpen(n); try { localStorage.setItem('hr-brief', n ? '1' : '0'); } catch(e) {} };
  const p = Model.perms(r, v);
  const sum = [p.salary && r.salary, [r.format, r.location].filter(Boolean).join(', '), r.schedule].filter(Boolean).join(' · ');
  return html`<section className=${'box is-fold' + (open ? ' is-open' : '')}>
    <h3 className="box-t"><button className="fold" aria-expanded=${open} onClick=${toggle}>
      <span>Заявка</span>${!open && html`<span className="fold-s">${sum}</span>`}
      <span className="fold-i" aria-hidden="true"><${Icon} n="down" s=${16}/></span>
    </button></h3>
    ${open && html`<div className="fold-b">${briefParts(r, v).map(([k, t, rows]) => html`<div className="sub" key=${k}><h4 className="sub-t">${t}</h4><${Fields} rows=${rows}/></div>`)}</div>`}
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

/* ---------- чек-лист: каждый исполнитель отмечает свою часть разом ----------
   Пункты — памятка, что входит в шаг. Отмечать каждый никто не станет, поэтому одна кнопка «Всё сделано»
   на исполнителя; у сделанного — кто и когда. */
const WHO_ORDER = ['recruiter', 'recruiter it', 'it', 'manager', 'mentor'];
function Checklist({r, h, list, v, who}){
  const items = h.lists[list];
  if(!items) return null;
  const groups = WHO_ORDER.filter(w => items.some(i => i.who === w)).map(w => ({w, items:items.filter(i => i.who === w)}));
  const ready = groups.filter(g => g.items.every(i => i.done)).length;
  const set = (w, done) => Store.dispatch('checkGroup', {id:r.id, hid:h.id, list, who:w, done});
  return html`<${Box} title=${Model.LISTS[list].name + (who ? ': ' + who : '')} aside=${html`<span className="box-n num">${ready} из ${groups.length} готово</span>`}>
    <div className="clg-all">${groups.map(({w, items:its}) => {
      const done = its.every(i => i.done), can = Model.canCheck(its[0], r, v);
      const last = done && its.map(i => i.done).sort((a, b) => b.at - a.at)[0];
      return html`<div key=${w} className=${'clg' + (done ? ' is-done' : '')}>
        <div className="clg-h">
          <span className="clg-w">${Model.WHO[w]}</span>
          ${done ? html`<span className="clg-ok"><${Icon} n="ok" s=${16}/>Сделано, ${shortName(last.by)}, ${Model.fmtDate(last.at)}</span>
              ${can && html`<button className="link-btn" onClick=${() => set(w, false)}>Вернуть</button>`}`
            : can ? html`<${Btn} kind="primary" className="btn-sm" onClick=${() => set(w, true)}>Всё сделано<//>` : html`<span className="muted clg-wait">Не готово</span>`}
        </div>
        <ul className="clg-l">${its.map((it, i) => html`<li key=${i}>${it.t}${it.opt ? html` <span className="muted">при надобности</span>` : ''}</li>`)}</ul>
      </div>`;
    })}</div>
  <//>`;
}

/* сотрудник: работа текущего шага. Finance на своём шаге видит уведомление из п. 19 */
function HireWork({r, h, v, showName}){
  const s = h.stage, fin = Model.PEOPLE[v].role === 'finance';
  const lists = {prep:['prep'], intern:['day1'], docs:['docs', 'onboarding'], fin:['onboarding'], fot:['onboarding']}[s] || [];
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
        <${Field} label="Рекрутер" error=${err.rec}><select className="inp" data-k="rec" value=${rec} onChange=${e => { setRec(e.target.value); setErr({}); }}>
          <option value="">Выберите</option>${Model.RECRUITERS.map(id => html`<option key=${id} value=${id}>${name(id)}, в работе ${load(id)}</option>`)}</select><//>
        <div className="field"><span className="l">Приоритет</span><${Seg} label="Приоритет" value=${prio} onChange=${setPrio} options=${[['normal','Обычный'],['high','Срочно']]}/></div>
        <${Field} label="Срок закрытия" error=${err.dl}><input className="inp" type="date" value=${dl} onInput=${e => setDl(e.target.value)}/><//>
      </div>
    <//>
    <${ModalFoot}><${Decide} actions=${[{label:'Назначить', kind:'primary', run:send}, ...actions]} extra=${extra}/><//>
  <//>`;
}

function PublishForm({r, actions, extra}){
  const [f, setF] = useState({platform:'HH', date:toInput(Date.now()), link:'', comment:''}), [err, setErr] = useState('');
  const set = k => e => setF(Object.assign({}, f, {[k]:e.target.value}));
  const send = () => {
    if(!f.date){ setErr('Укажите дату публикации'); return; }
    Store.dispatch('publish', {id:r.id, platform:f.platform, date:fromInput(f.date), link:f.link.trim(), comment:f.comment.trim()});
  };
  return html`<${Fragment}>
    <${Box} title="Публикация вакансии">
      <div className="grid2">
        <${Field} label="Площадка"><select className="inp" value=${f.platform} onChange=${set('platform')}>${Model.PLATFORMS.map(p => html`<option key=${p}>${p}</option>`)}</select><//>
        <${Field} label="Дата" error=${err}><input className="inp" type="date" value=${f.date} onInput=${set('date')}/><//>
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
        ${verdict === 'extend' && html`<${Field} label="До какого числа" error=${err.until}><input className="inp" type="date" value=${until} onInput=${e => setUntil(e.target.value)}/><//>`}
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
      <${Field} label="Причина отмены" error=${!reason ? err : ''}><select className="inp" value=${reason} onChange=${e => { setReason(e.target.value); setErr(''); }}><option value="">Выберите</option>${Model.CANCEL.map(x => html`<option key=${x}>${x}</option>`)}</select><//>
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
  const [offer, setOffer] = useState({salary:r.salary, start:toInput(r.start && r.start > now ? r.start : now + 14 * Model.D)});
  const [start, setStart] = useState(toInput(c.offer ? c.offer.start : r.start));
  useEffect(() => { setRej(false); setErr(''); }, [c.stage]);
  const editor = p.editCandidates, manager = r.manager === v, open = c.stage !== 'rejected' && c.stage !== 'accepted';
  const doReject = () => {
    if(!reason){ setErr('Выберите причину'); return; }
    if(reason === 'Другое' && !rc.trim()){ setErr('Напишите причину'); return; }
    d('reject', {reason, comment:rc.trim()}); setRej(false);
  };
  if(rej) return html`<div className="decide">
    <p className="note-m" style=${{margin:'0 0 10px'}}>Кандидат уйдёт в отказы, руководитель увидит причину. Вернуть кандидата нельзя.</p>
    <div className="grid-dc">
      <${Field} label="Причина отказа" error=${err && !reason ? err : ''}><select className="inp" value=${reason} onChange=${e => { setReason(e.target.value); setErr(''); }}>
        <option value="">Выберите</option>${Model.REJECT.map(x => html`<option key=${x}>${x}</option>`)}</select><//>
      <${Field} label="Комментарий" optional=${reason !== 'Другое'} error=${err && reason ? err : ''}><input className="inp" value=${rc} onInput=${e => { setRc(e.target.value); setErr(''); }}/><//>
    </div>
    <div className="row is-end"><${Btn} kind="ghost" onClick=${() => { setRej(false); setErr(''); }}>Отмена<//><${Btn} kind="danger" onClick=${doReject}>Отказать<//></div>
  </div>`;

  const actions = [];
  let fields = null;
  if(open && editor){
    if(c.stage === 'new') actions.push({label:'Пригласить на интервью', kind:'primary', ask:true, need:false, field:'Когда интервью', confirm:'Пригласить', run:x => d('move', {to:'hr', when:x})});
    if(c.stage === 'hr') actions.push({label:'Руководителю на решение', kind:'primary', run:() => d('move', {to:'mgr'})}, {label:'Дать тестовое задание', run:() => d('move', {to:'test'})});
    if(c.stage === 'test'){
      actions.push({label:'Руководителю на решение', kind:'primary', run:() => d('move', {to:'mgr'})});
      if(!c.timeline.some(x => x.text === 'Тестовое получено')) actions.push({label:'Тестовое сдано', run:() => d('note', {text:'Тестовое получено'})});
    }
    if(c.stage === 'approved'){
      fields = html`<div className="grid2 c-fields">
        <${Field} label="Оклад в оффере"><input className="inp" value=${offer.salary} onInput=${e => setOffer(Object.assign({}, offer, {salary:e.target.value}))}/><//>
        <${Field} label="Дата выхода"><input className="inp" type="date" value=${offer.start} onInput=${e => setOffer(Object.assign({}, offer, {start:e.target.value}))}/><//></div>`;
      actions.push({label:'Отправить оффер', kind:'primary', run:() => d('offer', {salary:offer.salary, start:fromInput(offer.start)})});
    }
    if(c.stage === 'offer'){
      fields = html`<div className="grid2 c-fields"><${Field} label="Дата выхода"><input className="inp" type="date" value=${start} onInput=${e => setStart(e.target.value)}/><//></div>`;
      actions.push({label:'Согласился', kind:'primary', run:() => d('accepted', {start:fromInput(start)})},
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
const C_GROUPS = [['accepted','Выбраны'], ['mgr','У руководителя'], ['approved','Одобрены, ждут оффер'], ['offer','Оффер отправлен'], ['test','Тестовое'], ['hr','Интервью HR'], ['new','Новые']];
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
  return html`<article className="cc">
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
function Candidates({r, v, now, onAdd}){
  const manager = r.manager === v, [showRej, setShowRej] = useState(false);
  const live = r.candidates.filter(c => c.stage !== 'rejected'), rej = r.candidates.filter(c => c.stage === 'rejected');
  const groups = C_GROUPS.map(([k, t]) => [k, k === 'mgr' && manager ? 'Ждут вашего ответа' : t, live.filter(c => c.stage === k).sort((a, b) => b.stageAt - a.stageAt)]).filter(g => g[2].length);
  return html`<section className="cands">
    <div className="cands-h"><h3 className="box-t">Кандидаты <span className="muted num">${live.length}</span></h3>
      ${onAdd && html`<${Btn} onClick=${onAdd}><${Icon} n="plus" s=${15}/>Добавить кандидата<//>`}</div>
    ${!live.length && html`<p className="muted" style=${{margin:0}}>Кандидатов пока нет</p>`}
    ${groups.map(([k, t, list]) => html`<div className="cg" key=${k}>
      <h4 className=${'cg-t' + (k === 'mgr' && manager ? ' is-mine' : '')}>${t} <span className="num">${list.length}</span></h4>
      ${list.map(c => html`<${CandCard} key=${c.id} r=${r} c=${c} v=${v} now=${now}/>`)}
    </div>`)}
    ${rej.length > 0 && html`<div className="cg">
      <h4 className="cg-t"><button className="fold" aria-expanded=${showRej} onClick=${() => setShowRej(!showRej)}>Отказы <span className="num">${rej.length}</span>
        <span className="fold-i" aria-hidden="true"><${Icon} n="down" s=${14}/></span></button></h4>
      ${showRej && html`<div className="crej">${rej.map(c => html`<a key=${c.id} className="crej-r" href=${'#/r/' + r.id + '/c/' + c.id}>
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
  const [all, setAll] = useState(false);
  items = items.slice().sort((a, b) => a.at - b.at);
  const hidden = !all && items.length > limit ? items.length - limit : 0;
  return html`<div>
    ${hidden > 0 && html`<button className="tl-more" onClick=${() => setAll(true)}><${Icon} n="down" s=${14}/>Ещё ${hidden} ${Model.plural(hidden, 'событие', 'события', 'событий')}</button>`}
    <ol className="tl">${items.slice(hidden).map((x, i) => html`<li key=${i}>
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

/* ---------- окно заявки ---------- */
function RequestPage({r, view, cid}){
  const v = useViewer(), now = useNow();
  const p = Model.perms(r, v), guard = useRef(false);
  const [cancel, setCancel] = useState(false), [ask, setAsk] = useState(null);
  useEffect(() => { setCancel(false); }, [r.id, v, r.status]);

  const leave = then => { if(guard.current){ setAsk(() => then); return; } then(); };
  useEffect(() => { Panel.leave = leave; });
  useEffect(() => () => { Panel.leave = f => f(); }, []);

  if(view === 'cand' || view === 'add'){
    const c = r.candidates.find(x => x.id === cid);
    return html`<div>
      ${view === 'add' ? html`<${AddCandidate} r=${r} guard=${guard} onCancel=${() => leave(() => { guard.current = false; go('#/r/' + r.id); })} onDone=${id => { guard.current = false; go('#/r/' + r.id + '/c/' + id); }}/>`
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
    case 'returned': actions.push({label:'Доработать', kind:'primary', run:() => go('#/r/' + r.id + '/edit')}); break;
    case 'hr': actions.push({label:'Принять', kind:'primary', run:c => d('hrAccept', {comment:c})},
      {label:'На доработку', ask:true, need:true, whom:'руководитель', confirm:'Вернуть на доработку', note:RETURN_NOTE, run:c => d('hrReturn', {comment:c})}); break;
    case 'finance': actions.push({label:'Согласовать', kind:'primary', run:c => d('finApprove', {comment:c})},
      {label:'На доработку', ask:true, need:true, whom:'руководитель', confirm:'Вернуть на доработку', note:RETURN_NOTE, run:c => d('finReturn', {comment:c})},
      {label:'Отклонить', kind:'danger', ask:true, need:true, whom:'руководитель', confirm:'Отклонить заявку', note:REJECT_NOTE, run:c => d('finReject', {comment:c})}); break;
    case 'ceo': actions.push({label:'Одобрить', kind:'primary', run:c => d('ceoApprove', {comment:c})},
      {label:'Отклонить', kind:'danger', ask:true, need:true, whom:'руководитель', confirm:'Отклонить заявку', note:REJECT_NOTE, run:c => d('ceoReject', {comment:c})}); break;
    case 'assign': form = 'assign'; break;
    case 'assigned': case 'inwork': form = 'publish'; break;
  }
  let decide = null;
  mine.filter(t => t.h).forEach(t => {
    const h = r.hires.find(x => x.id === t.h), who = many ? ': ' + Model.short(h.name) : '';
    if(h.stage === 'prep' && Model.PEOPLE[v].role !== 'it') actions.push({label:'Вышел на стажировку' + who, kind:'primary', disabled:Model.listLeft(h.lists.prep) > 0, run:() => d('started', {hid:h.id})});
    if(h.stage === 'intern' && !decide) decide = h;
    if(h.stage === 'docs') actions.push({label:'Сотрудник оформлен' + who, kind:'primary', disabled:Model.listLeft(h.lists.docs) > 0, run:() => d('registered', {hid:h.id})});
    if(h.stage === 'fin') actions.push({label:'Принято в работу' + who, kind:'primary', run:c => d('finAccept', {hid:h.id, comment:c})});
    if(h.stage === 'fot') actions.push({label:'Учтено в ФОТ' + who, kind:'primary', ask:true, need:false, confirm:'Учтено в ФОТ', run:c => d('fot', {hid:h.id, comment:c})});
  });
  const extra = p.cancel && html`<${Btn} kind="ghost" className="btn-cancel" onClick=${() => setCancel(true)}>Отменить заявку<//>`;

  /* слева — дело этого шага, под ним заявка */
  const main = [];
  if(st === 'returned') main.push(html`<${Note} key="ret" title="Что просят исправить" by=${r.returned.by} at=${r.returned.at} quote=${r.returned.comment}/>`);
  if(st === 'finance' || st === 'ceo'){
    const hr = lastLog(r, 'hr'), fin = lastLog(r, 'finance');
    if(hr && hr.comment) main.push(html`<${Note} key="hr" title="Комментарий HR" by=${hr.by} at=${hr.at} quote=${hr.comment}/>`);
    if(st === 'ceo' && fin) main.push(html`<${Note} key="fin" title=${'Finance согласовал' + (fin.comment ? '' : ' без комментария')} by=${fin.by} at=${fin.at} quote=${fin.comment}/>`);
  }
  if(stopped) main.push(html`<${Stopped} key="stop" r=${r}/>`);
  if(st === 'closed') main.push(html`<${Result} key="res" r=${r}/>`);
  if(form === 'assign') main.push(html`<${AssignForm} key="as" r=${r} actions=${actions} extra=${extra}/>`);
  if(form === 'publish') main.push(html`<${PublishForm} key="pub" r=${r} actions=${actions} extra=${extra}/>`);
  if(decide && !cancel) main.push(html`<${DecisionForm} key=${'dc' + decide.id} r=${r} h=${decide} many=${many} actions=${actions} extra=${extra}/>`);
  open.forEach(h => main.push(html`<${HireWork} key=${h.id} r=${r} h=${h} v=${v} showName=${many}/>`));
  if(searching && st === 'published' && p.candidates) main.push(html`<${Candidates} key="c" r=${r} v=${v} now=${now} onAdd=${p.editCandidates && (() => go('#/r/' + r.id + '/add'))}/>`);
  if(p.request) main.push(approving ? html`<${Brief} key="brief" r=${r} v=${v}/>` : html`<${RequestBox} key="rb" r=${r} v=${v}/>`);

  const own = (form || decide) && !cancel;
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
    <${ModalHead} title=${html`${r.title}${r.seats > 1 && html`<small className="num">× ${r.seats}</small>`}`} sub=${r.dept + ' / ' + r.project} strip=${html`<${Strip} rows=${stripRows(r)}/>`}/>
    <div className="mmain">${main}</div>
    <${Side} info=${info} history=${log}/>
    ${cancel ? html`<${ModalFoot}><${CancelForm} r=${r} onDone=${() => setCancel(false)}/><//>`
      : !own && (actions.length || extra) ? html`<${ModalFoot}><${Decide} actions=${actions} extra=${extra}/><//>` : null}
  </div>`;
}

/* ---------- окно кандидата ---------- */
/* файлы: в прототипе сохраняются название и размер, сам файл остаётся у вас */
const FILE_KINDS = ['Резюме','Портфолио','Тестовое задание','Результат тестового','Рекомендации','Другое'];
function Files({files, can, onAdd}){
  const inp = useRef(null), [kind, setKind] = useState('Резюме');
  const size = b => b > 1e6 ? (b / 1e6).toFixed(1).replace('.', ',') + ' МБ' : Math.max(1, Math.round(b / 1e3)) + ' КБ';
  if(!files.length && !can) return null;
  return html`<${Box} title="Файлы">
    ${files.length ? html`<ul className="files">${files.map((f, i) => html`<li key=${i}><${Icon} n="clip" s=${15}/><span>${f.name}</span><small>${f.kind}, ${size(f.size)}</small></li>`)}</ul>` : null}
    ${can && html`<div className="row" style=${{marginTop:files.length ? 10 : 0}}>
      <select className="inp" style=${{width:'auto'}} aria-label="Что прикрепляете" value=${kind} onChange=${e => setKind(e.target.value)}>${FILE_KINDS.map(k => html`<option key=${k}>${k}</option>`)}</select>
      <${Btn} onClick=${() => inp.current.click()}><${Icon} n="clip" s=${15}/>Прикрепить<//>
      <input ref=${inp} type="file" multiple hidden onChange=${e => { const fs = Array.from(e.target.files).map(f => ({name:f.name, size:f.size, kind})); if(fs.length) onAdd(fs); e.target.value = ''; }}/>
    </div>`}
  <//>`;
}

function CandidateView({r, c, v, now}){
  const h = r.hires.find(x => x.cid === c.id);
  const stageName = c.stage === 'rejected' ? 'Отказ' : c.stage === 'accepted' ? (h ? {prep:'Выход ' + Model.fmtDate(h.start), intern:'На стажировке', docs:'Оформляется', fin:'Оформлен', fot:'Оформлен', done:'В штате', dropped:'Не продолжили после стажировки'}[h.stage] : 'Согласился')
    : c.stage === 'approved' ? 'Одобрен руководителем' : c.stage === 'mgr' ? 'У руководителя' : c.stage === 'offer' ? 'Оффер отправлен' : {new:'Новый', hr:'Интервью HR', test:'Тестовое'}[c.stage];
  const ckind = x => /одобрил$|согласил|Выбран|нанимаем/i.test(x.text) ? 'ok' : /отказ/i.test(x.text) ? 'stop' : 'ev';
  const ctimeline = c.timeline.map((x, i) => ({at:x.at, title:x.text, who:x.by ? whoLine(x.by) : '', kind:i === 0 ? 'new' : ckind(x)}));
  const acts = html`<${CandActions} r=${r} c=${c} v=${v} now=${now}/>`;

  return html`<div className="mgrid">
    <${ModalHead} title=${c.name} sub=${html`<${BackLink} href=${'#/r/' + r.id}>${r.title}<//>`} strip=${html`<${Strip} rows=${[{steps:candSteps(c)}]}/>`}/>
    <div className="mmain">
      ${c.stage === 'rejected' && html`<${Note} title=${'Отказ: ' + c.reject.reason.toLowerCase()} by=${c.reject.by} at=${c.reject.at} quote=${c.reject.comment}/>`}
      <${Box} title="Контакты"><${Fields} rows=${[['Телефон', c.phone && html`<a href=${'tel:' + c.phone.replace(/\s/g, '')}>${c.phone}</a>`],
        ['Telegram', c.tg && html`<a href=${'https://t.me/' + c.tg.replace('@', '')} target="_blank" rel="noopener">${c.tg}</a>`],
        ['Почта', c.email && html`<a href=${'mailto:' + c.email}>${c.email}</a>`],
        ['Резюме', c.resume && html`<a href=${c.resume} target="_blank" rel="noopener">Открыть</a>`]]}/><//>
      <${Box} title="О кандидате"><${Fields} rows=${[['Сейчас работает', c.position], ['Опыт', c.experience], ['Ожидания по зарплате', c.expect], ['Откуда', c.source],
        ['Комментарий', c.comment && html`<span className="text">${c.comment}</span>`, true]]}/><//>
      ${c.feedback.length > 0 && html`<${Box} title="Ответ руководителя">
        ${c.feedback.map((f, i) => html`<div key=${i} className="fb"><div className=${f.verdict === 'approve' ? 'ok' : 'late'}>${f.verdict === 'approve' ? 'Одобрил' : 'Отказал'}<span className="muted">, ${name(f.by)}, ${Model.fmtDate(f.at)}</span></div>${f.comment && html`<blockquote className="tl-c">${f.comment}</blockquote>`}</div>`)}
      <//>`}
      <${Files} files=${c.files} can=${Model.perms(r, v).editCandidates} onAdd=${fs => Store.dispatch('addFiles', {id:r.id, cid:c.id, files:fs})}/>
    </div>
    <${Side} info=${[['Этап', stageName], ['На этапе с', Model.fmtDate(c.stageAt, true)], ['Откуда', c.source], ['Добавлен', c.timeline[0] && Model.fmtDate(c.timeline[0].at, true)]]} history=${ctimeline}/>
    <${ModalFoot}>${acts}<//>
  </div>`;
}

/* ---------- новый кандидат: контакты, затем о кандидате ---------- */
function AddCandidate({r, onDone, onCancel, guard}){
  const [f, setF] = useState({name:'', phone:'', tg:'', email:'', resume:'', source:'', expect:'', position:'', experience:'', comment:''});
  const [err, setErr] = useState({});
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
  return html`<div className="mpage">
    <${ModalHead} title="Новый кандидат" sub=${html`<${BackLink} href=${'#/r/' + r.id}>${r.title}<//>`}/>
    <${Box} title="Контакты">
      <div className="grid-dc">
        <${Field} id="ac-name" label="ФИО" error=${err.name}><input className="inp" value=${f.name} onInput=${set('name')} autoComplete="off"/><//>
        <${Field} id="ac-source" label="Откуда" error=${err.source}><select className="inp" value=${f.source} onChange=${set('source')}><option value="">Выберите</option>${Model.SOURCES.map(s => html`<option key=${s}>${s}</option>`)}</select><//>
      </div>
      <div className="grid3">
        <${Field} id="ac-phone" label="Телефон" error=${err.contact}><input className="inp" type="tel" value=${f.phone} onInput=${set('phone')} placeholder="+7"/><//>
        <${Field} label="Telegram"><input className="inp" value=${f.tg} onInput=${set('tg')} placeholder="@"/><//>
        <${Field} label="Почта"><input className="inp" type="email" value=${f.email} onInput=${set('email')}/><//>
      </div>
    <//>
    <${Box} title="О кандидате">
      <div className="grid3">
        <${Field} label="Сейчас работает" optional=${true}><input className="inp" value=${f.position} onInput=${set('position')}/><//>
        <${Field} label="Опыт" optional=${true}><input className="inp" value=${f.experience} onInput=${set('experience')}/><//>
        <${Field} label="Ожидания по зарплате" optional=${true}><input className="inp" value=${f.expect} onInput=${set('expect')}/><//>
      </div>
      <${Field} label="Ссылка на резюме" optional=${true}><input className="inp" type="url" value=${f.resume} onInput=${set('resume')} placeholder="https://"/><//>
      <${Field} label="Комментарий" optional=${true}><textarea className="inp" rows="2" value=${f.comment} onInput=${set('comment')}/><//>
    <//>
    <${ModalFoot}><div className="row is-end"><${Btn} kind="ghost" onClick=${onCancel}>Отмена<//><${Btn} kind="primary" onClick=${send}>Добавить<//></div><//>
  </div>`;
}
const Panel = {leave:f => f()};
