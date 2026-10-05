/* Окно заявки и кандидата. Одна страница без вкладок:
   - под шапкой полоса шагов того, что происходит внутри окна (не вся воронка — её видно по доске);
   - слева дело: на согласовании сама заявка, в подборе кандидаты, на выходе и оформлении
     чек-лист текущего шага, у закрытой итог;
   - справа всегда «кто подал» и история;
   - кнопки решения внизу: человек читает сверху вниз и решает в конце. */
'use strict';

const go = h => { location.hash = h; };

function Facts({rows}){
  return html`<dl className="kv">${rows.filter(x => x[1]).map(([k, val]) => html`<${Fragment} key=${k}><dt>${k}</dt><dd>${val}</dd><//>`)}</dl>`;
}
function Info({rows}){
  return html`<dl className="info">${rows.filter(x => x[1]).map(([k, val]) => html`<div key=${k}><dt>${k}</dt><dd>${val}</dd></div>`)}</dl>`;
}
const RETURN_NOTE = 'Заявка вернётся руководителю. После доработки она снова придёт в HR и пройдёт согласование заново.';
const REJECT_NOTE = 'Заявка закроется, руководитель увидит причину. Вернуть её нельзя: понадобится новая.';
const lastLog = (r, s) => r.log.filter(x => x.step === s).pop();
const logTip = l => l ? shortName(l.by) + ', ' + Model.fmtDateTime(l.at) : '';

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
  const st = r.status, tk = lastLog(r, 'take'), pubs = r.publications || [], n = r.candidates.length;
  return [
    {k:'rec', label:'Рекрутер', state:tk ? 'done' : st === 'assign' || st === 'assigned' ? 'now' : 'next', tip:r.recruiter ? name(r.recruiter) : ''},
    {k:'pub', label:'Публикация', state:pubs.length ? 'done' : st === 'inwork' ? 'now' : 'next', tip:pubs.map(x => x.platform + ' ' + Model.fmtDate(x.date)).join(', ')},
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

/* ---------- заявка: кого ищем ----------
   Две колонки, чтобы читалось без прокрутки. Finance и CEO решают про деньги — им условия слева. */
function Brief({r, v}){
  const p = Model.perms(r, v), role = Model.PEOPLE[v].role;
  const txt = s => s && html`<p className="text">${s}</p>`;
  const sec = (k, t, rows) => rows.some(x => x[1]) ? html`<section className="sec" key=${k}><h3 className="sec-h">${t}</h3><${Facts} rows=${rows}/></section>` : null;
  const who = sec('who', 'Кого ищем', [['Обязанности', txt(r.duties)], ['Требования', txt(r.reqs)], ['Опыт', r.experience], ['Навыки', r.skills],
    ['Личные качества', r.personal], ['Образование', r.education], ['Дополнительно', txt(r.extra)], ['Сколько человек', r.seats > 1 ? String(r.seats) : '']]);
  const cond = sec('cond', 'Условия', [['Зарплата', p.salary && r.salary], ['Бонусы / KPI', p.salary && r.bonus], ['Формат', [r.format, r.location].filter(Boolean).join(', ')],
    ['График', r.schedule], ['Занятость', r.employment], ['Испытательный срок', r.probation], ['Желаемый выход', Model.fmtDate(r.start, true)]]);
  const why = sec('why', 'Зачем открываем', [['Причина', Model.REASONS[r.reason] && Model.REASONS[r.reason] + (r.reasonOther ? ': ' + r.reasonOther : '')],
    ['Приоритет', r.priority === 'high' ? 'Срочно' : ''], ['Комментарий', txt(r.comment)],
    ['Файлы', r.files && r.files.length > 0 && html`<ul className="files">${r.files.map((f, i) => html`<li key=${i}><${Icon} n="clip" s=${15}/>${f.name}</li>`)}</ul>`]]);
  const money = role === 'finance' || role === 'ceo';
  return html`<div className="brief">
    <div className="brief-c">${money ? [cond, why] : [who]}</div>
    <div className="brief-c">${money ? [who] : [cond, why]}</div>
  </div>`;
}

/* заметка сверху: что вернули, что сказал HR, почему остановили */
function Note({title, by, at, quote}){
  return html`<div className="note"><div className="note-t">${title}</div>${quote && html`<blockquote className="note-q">${quote}</blockquote>`}
    ${by && html`<div className="note-m">${name(by)}, ${Model.fmtDateTime(at)}</div>`}</div>`;
}
function Result({r}){
  const hs = r.hires.filter(h => h.stage === 'done'), n = Model.days(r.created, r.closedAt), pub = r.publications[0];
  const first = f => { const x = hs.map(f).filter(Boolean); return x.length ? Model.fmtDate(Math.min(...x), true) : ''; };
  return html`<section className="sec"><h3 className="sec-h">Закрыта ${Model.fmtDate(r.closedAt, true)}, за ${n} ${Model.plural(n, 'день', 'дня', 'дней')}</h3>
    <${Facts} rows=${[['Нанят' + (hs.length > 1 ? 'ы' : ''), hs.map(h => h.name).join(', ')], ['Открыта', Model.fmtDate(r.created, true)], ['Опубликована', pub && Model.fmtDate(pub.date, true)],
      ['Кандидат найден', first(h => h.chosen)], ['Выход', first(h => h.internStart)], ['Оформление', first(h => h.hiredAt)], ['Учтено в ФОТ', first(h => h.fotAt && h.fotAt.at)]]}/>
  </section>`;
}
function Stopped({r}){
  const l = r.log.filter(x => x.step === 'reject' || x.step === 'cancel').pop();
  if(!l) return null;
  const title = r.status === 'cancelled' ? 'Отменена: ' + r.cancel.reason.toLowerCase() : (l.by === Model.FIN ? 'Finance' : 'CEO') + ' отклонил заявку';
  return html`<${Note} title=${title} by=${l.by} at=${l.at} quote=${r.status === 'cancelled' ? r.cancel.comment : l.comment}/>`;
}

/* ---------- чек-лист: пункты разложены по тому, кто их делает ---------- */
const WHO_ORDER = ['recruiter', 'recruiter it', 'it', 'manager', 'mentor'];
function Checklist({r, h, list, v}){
  const items = h.lists[list];
  if(!items) return null;
  const done = items.filter(i => i.done).length;
  const groups = WHO_ORDER.filter(w => items.some(i => i.who === w));
  return html`<section className="cl">
    <h3 className="cl-h">${Model.LISTS[list].name}<span className="num">${done} из ${items.length}</span></h3>
    <div className="cl-g">${groups.map(w => html`<div className="cl-col" key=${w}>
      <div className="cl-who">${Model.WHO[w]}</div>
      ${items.map((it, i) => {
        if(it.who !== w) return null;
        const can = Model.canCheck(it, r, v), id = 'ck-' + h.id + list + i;
        return html`<label key=${i} htmlFor=${id} className=${'ck' + (it.done ? ' is-done' : '') + (can ? '' : ' is-off')} title=${it.done ? shortName(it.done.by) + ', ' + Model.fmtDate(it.done.at) : null}>
          <input type="checkbox" id=${id} checked=${!!it.done} disabled=${!can} onChange=${e => Store.dispatch('check', {id:r.id, hid:h.id, list, i, done:e.target.checked})}/>
          <span className="ck-b" aria-hidden="true"><${Icon} n="check" s=${12} w=${2.6}/></span>
          <span className="ck-t">${it.t}${it.opt ? html` <span className="muted">при надобности</span>` : ''}</span>
        </label>`;
      })}
    </div>`)}</div>
  </section>`;
}

/* сотрудник: работа текущего шага. Finance на своём шаге видит уведомление из п. 19 */
function HireWork({r, h, v, showName}){
  const s = h.stage, fin = Model.PEOPLE[v].role === 'finance';
  const lists = {prep:['prep'], intern:['day1'], docs:['docs', 'onboarding'], fin:['onboarding'], fot:['onboarding']}[s] || [];
  return html`<section className="hire" id=${'h-' + h.id}>
    ${showName && html`<h3 className="sec-h">${h.name}</h3>`}
    ${fin && (s === 'fin' || s === 'fot') ? html`<section className="sec"><h3 className="sec-h">Новый сотрудник: учесть в ФОТ</h3>
      <${Facts} rows=${[['ФИО', h.name], ['Должность', r.title], ['Отдел', r.dept], ['Проект', r.project], ['Руководитель', name(r.manager)],
        ['Дата выхода', Model.fmtDate(h.internStart || h.start, true)], ['Оформлен', Model.fmtDate(h.hiredAt, true)], ['Оклад', h.salary],
        ['Бонус / KPI', r.bonus || 'Нет'], ['Тип занятости', r.employment]]}/></section>`
      : lists.map(l => html`<${Checklist} key=${l} r=${r} h=${h} list=${l} v=${v}/>`)}
  </section>`;
}

/* ---------- формы шагов: поля слева, кнопка внизу окна ---------- */
function AssignForm({r, actions, extra}){
  const load = id => Store.get().requests.filter(x => x.recruiter === id && !['closed','rejected','cancelled'].includes(x.status)).length;
  const [rec, setRec] = useState(''), [prio, setPrio] = useState(r.priority || 'normal'), [dl, setDl] = useState(toInput(r.start)), [err, setErr] = useState({});
  const send = () => {
    const e = {}; if(!rec) e.rec = 'Выберите рекрутера'; if(!dl) e.dl = 'Укажите срок закрытия';
    setErr(e); if(Object.keys(e).length) return;
    Store.dispatch('assign', {id:r.id, recruiter:rec, priority:prio, deadline:fromInput(dl)});
  };
  return html`<${Fragment}>
    <section className="sec"><h3 className="sec-h">Назначить рекрутера</h3>
      <div className="grid3">
        <${Field} label="Рекрутер" error=${err.rec}><select className="inp" data-k="rec" value=${rec} onChange=${e => { setRec(e.target.value); setErr({}); }}>
          <option value="">Выберите</option>${Model.RECRUITERS.map(id => html`<option key=${id} value=${id}>${name(id)}, в работе ${load(id)}</option>`)}</select><//>
        <div className="field"><span className="l">Приоритет</span><${Seg} label="Приоритет" value=${prio} onChange=${setPrio} options=${[['normal','Обычный'],['high','Срочно']]}/></div>
        <${Field} label="Срок закрытия" error=${err.dl}><input className="inp" type="date" value=${dl} onInput=${e => setDl(e.target.value)}/><//>
      </div>
    </section>
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
    <section className="sec"><h3 className="sec-h">Публикация вакансии</h3>
      <div className="grid4">
        <${Field} label="Площадка"><select className="inp" value=${f.platform} onChange=${set('platform')}>${Model.PLATFORMS.map(p => html`<option key=${p}>${p}</option>`)}</select><//>
        <${Field} label="Дата" error=${err}><input className="inp" type="date" value=${f.date} onInput=${set('date')}/><//>
        <${Field} label="Ссылка" optional=${true}><input className="inp" type="url" inputMode="url" value=${f.link} onInput=${set('link')} placeholder="https://"/><//>
        <${Field} label="Комментарий" optional=${true}><input className="inp" value=${f.comment} onInput=${set('comment')}/><//>
      </div>
    </section>
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
    <section className="sec">
      <div className="field"><span className="l">Решение по стажировке${many ? ': ' + h.name : ''}</span>
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
    </section>
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
    <p className="now-m" style=${{margin:'0 0 10px'}}>Поиск остановится, кандидаты останутся в истории. Вернуть заявку нельзя: понадобится новая.</p>
    <div className="grid-dc">
      <${Field} label="Причина отмены" error=${!reason ? err : ''}><select className="inp" value=${reason} onChange=${e => { setReason(e.target.value); setErr(''); }}><option value="">Выберите</option>${Model.CANCEL.map(x => html`<option key=${x}>${x}</option>`)}</select><//>
      <${Field} label="Комментарий" optional=${reason !== 'Другое'} error=${reason ? err : ''}><input className="inp" value=${c} onInput=${e => { setC(e.target.value); setErr(''); }}/><//>
    </div>
    <div className="row"><${Btn} kind="danger" onClick=${send}>Отменить заявку<//><${Btn} kind="ghost" onClick=${onDone}>Не отменять<//></div>
  </div>`;
}

/* ---------- кандидаты: одна таблица, кто ждёт вашего ответа — первыми ---------- */
const C_ORDER = {accepted:0, mgr:1, approved:2, offer:3, test:4, hr:5, new:6};
function Candidates({r, v}){
  const p = Model.perms(r, v), [showRej, setShowRej] = useState(false), manager = r.manager === v;
  const live = r.candidates.filter(c => c.stage !== 'rejected').sort((a, b) => C_ORDER[a.stage] - C_ORDER[b.stage] || b.stageAt - a.stageAt);
  const rej = r.candidates.filter(c => c.stage === 'rejected');
  const stage = c => {
    const h = r.hires.find(x => x.cid === c.id);
    if(c.stage === 'accepted') return [h && h.stage === 'prep' ? 'Выбран, выход ' + Model.fmtDate(h.start) : 'Выбран'];
    if(c.stage === 'mgr') return manager ? ['Ждёт вашего ответа', true] : ['У руководителя'];
    if(c.stage === 'approved') return p.editCandidates ? ['Отправить оффер', true] : ['Одобрен'];
    if(c.stage === 'offer') return ['Оффер отправлен'];
    return [{new:'Новый', hr:'Интервью HR', test:'Тестовое'}[c.stage]];
  };
  const row = (c, s, mine) => html`<button key=${c.id} className="crow" onClick=${() => go('#/r/' + r.id + '/c/' + c.id)}>
    <span className="crow-n">${c.name}</span><span className="crow-p">${c.position || c.source}</span><span className=${'crow-s' + (mine ? ' is-mine' : '')}>${s}</span></button>`;
  return html`<section className="sec">
    <h3 className="sec-h">Кандидаты <span className="muted num">${live.length}</span></h3>
    ${live.length ? html`<div className="crows">${live.map(c => { const [s, mine] = stage(c); return row(c, s, mine); })}</div>` : html`<p className="muted" style=${{margin:0}}>Кандидатов пока нет</p>`}
    ${rej.length > 0 && html`<button className="group-t rej-t" aria-expanded=${showRej} onClick=${() => setShowRej(!showRej)}>Отказы <span className="muted num">${rej.length}</span>
      <span style=${{transform:showRej ? 'rotate(180deg)' : '', display:'inline-flex'}}><${Icon} n="down" s=${14}/></span></button>`}
    ${showRej && html`<div className="crows is-rej">${rej.map(c => row(c, c.reject.reason))}</div>`}
  </section>`;
}

/* ---------- справа: кто подал и история ---------- */
const TL_ICON = {new:'doc', ok:'ok', stop:'no', ret:'ret', ev:'ev'};
const whoLine = id => { const p = Model.PEOPLE[id]; return p ? Model.short(p.name) + ', ' + (p.role === 'manager' ? 'руководитель' : p.role === 'recruiter' ? 'рекрутер' : Model.ROLE[p.role]) : ''; };
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
function Timeline({items, limit = 8}){
  const [all, setAll] = useState(false);
  items = items.slice().sort((a, b) => a.at - b.at);
  const hidden = !all && items.length > limit ? items.length - limit + 1 : 0;
  return html`<div className="tl-wrap">
    ${hidden > 0 && html`<button className="tl-more" onClick=${() => setAll(true)}><${Icon} n="down" s=${14}/>Ещё ${hidden} ${Model.plural(hidden, 'событие', 'события', 'событий')}</button>`}
    <ol className="tl">${items.slice(hidden).map((x, i) => html`<li key=${i}>
      <span className=${'tl-i is-' + x.kind}><${Icon} n=${TL_ICON[x.kind]} s=${20}/></span>
      <div className="tl-b">
        <div className="tl-t">${x.title}</div>
        <div className="tl-w"><span>${x.who}</span><time className="tl-d num">${Model.fmtDateTime(x.at)}</time></div>
        ${x.comment && html`<blockquote className="tl-c">${x.comment}</blockquote>`}
      </div>
    </li>`)}</ol>
  </div>`;
}
function Side({info, history}){
  return html`<aside className="mside">
    <${Info} rows=${info}/>
    ${history && html`<section><h2 className="side-h">История</h2><${Timeline} items=${history} limit=${7}/></section>`}
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
    case 'assigned': actions.push({label:'Взять в работу', kind:'primary', run:() => d('take')}); break;
    case 'inwork': form = 'publish'; break;
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
  if(searching && st === 'published' && p.editCandidates) actions.push({label:'Добавить кандидата', run:() => go('#/r/' + r.id + '/add')});
  const extra = p.cancel && html`<${Btn} kind="ghost" className="btn-cancel" onClick=${() => setCancel(true)}>Отменить заявку<//>`;

  /* слева — дело этого шага */
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
  if(searching && st === 'published' && p.candidates) main.push(html`<${Candidates} key="c" r=${r} v=${v}/>`);
  const showBrief = p.request && form !== 'assign' && (['draft','returned','hr','finance','ceo','assigned','inwork','rejected','cancelled'].includes(st) || (st === 'assign' && !reqTurn));
  if(showBrief) main.push(html`<${Brief} key="brief" r=${r} v=${v}/>`);

  const own = (form || decide) && !cancel;
  const late = r.deadline && r.deadline < now && Model.phase(r) !== 'closed';
  const pubs = r.publications;
  const info = [
    ['Подал', name(r.initiator)],
    ['Руководитель', r.manager !== r.initiator && name(r.manager)],
    ['Рекрутер', r.recruiter && name(r.recruiter)],
    ['Создана', Model.fmtDate(r.created, true)],
    ['Желаемый выход', Model.fmtDate(r.start, true)],
    ['Срок закрытия', r.deadline && html`<span className=${'num' + (late ? ' late' : '')}>${late ? html`<${Icon} n="late" s=${14} label="Срок прошёл"/> ` : ''}${Model.fmtDate(r.deadline, true)}</span>`],
    ['Публикация', pubs.length > 0 && html`${pubs.map((x, i) => html`<${Fragment} key=${i}>${i ? ', ' : ''}${x.link ? html`<a href=${x.link} target="_blank" rel="noopener">${x.platform}</a>` : x.platform}<//>`)}`]
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

/* ---------- карточка кандидата ---------- */
/* файлы: в прототипе сохраняются название и размер, сам файл остаётся у вас */
const FILE_KINDS = ['Резюме','Портфолио','Тестовое задание','Результат тестового','Рекомендации','Другое'];
function Files({files, can, onAdd}){
  const inp = useRef(null), [kind, setKind] = useState('Резюме');
  const size = b => b > 1e6 ? (b / 1e6).toFixed(1).replace('.', ',') + ' МБ' : Math.max(1, Math.round(b / 1e3)) + ' КБ';
  if(!files.length && !can) return null;
  return html`<section className="sec"><h3 className="sec-h">Файлы</h3>
    ${files.length ? html`<ul className="files">${files.map((f, i) => html`<li key=${i}><${Icon} n="clip" s=${15}/><span>${f.name}</span><small>${f.kind}, ${size(f.size)}</small></li>`)}</ul>` : null}
    ${can && html`<div className="row" style=${{marginTop:8}}>
      <select className="inp" style=${{width:'auto'}} aria-label="Что прикрепляете" value=${kind} onChange=${e => setKind(e.target.value)}>${FILE_KINDS.map(k => html`<option key=${k}>${k}</option>`)}</select>
      <${Btn} onClick=${() => inp.current.click()}><${Icon} n="clip" s=${15}/>Прикрепить<//>
      <input ref=${inp} type="file" multiple hidden onChange=${e => { const fs = Array.from(e.target.files).map(f => ({name:f.name, size:f.size, kind})); if(fs.length) onAdd(fs); e.target.value = ''; }}/>
    </div>`}
  </section>`;
}

function CandidateView({r, c, v, now}){
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

  /* кнопки внизу по этапу; поля оффера и даты выхода — слева над сведениями */
  const actions = [], top = [];
  if(open && editor){
    if(c.stage === 'new') actions.push({label:'Пригласить на интервью', kind:'primary', ask:true, need:false, field:'Когда интервью', confirm:'Пригласить', run:x => d('move', {to:'hr', when:x})});
    if(c.stage === 'hr') actions.push({label:'Передать руководителю', kind:'primary', run:() => d('move', {to:'mgr'})}, {label:'Отправить тестовое', run:() => d('move', {to:'test'})});
    if(c.stage === 'test'){
      actions.push({label:'Передать руководителю', kind:'primary', run:() => d('move', {to:'mgr'})});
      if(!c.timeline.some(x => x.text === 'Тестовое получено')) actions.push({label:'Тестовое получено', run:() => d('note', {text:'Тестовое получено'})});
    }
    if(c.stage === 'approved'){
      top.push(html`<section className="sec" key="offer"><h3 className="sec-h">Оффер</h3><div className="grid-dc">
        <${Field} label="Оклад"><input className="inp" value=${offer.salary} onInput=${e => setOffer(Object.assign({}, offer, {salary:e.target.value}))}/><//>
        <${Field} label="Дата выхода"><input className="inp" type="date" value=${offer.start} onInput=${e => setOffer(Object.assign({}, offer, {start:e.target.value}))}/><//></div></section>`);
      actions.push({label:'Отправить оффер', kind:'primary', run:() => d('offer', {salary:offer.salary, start:fromInput(offer.start)})});
    }
    if(c.stage === 'offer'){
      top.push(html`<section className="sec" key="acc"><h3 className="sec-h">Ответ на оффер</h3><div className="grid-dc">
        <${Field} label="Дата выхода"><input className="inp" type="date" value=${start} onInput=${e => setStart(e.target.value)}/><//></div></section>`);
      actions.push({label:'Согласился', kind:'primary', run:() => d('accepted', {start:fromInput(start)})},
        {label:'Отказался', kind:'danger', run:() => d('reject', {reason:'Отказался сам', comment:'Отказался от оффера'})});
    }
  }
  if(open && c.stage === 'mgr' && manager) actions.push(
    {label:'Одобрить', kind:'primary', ask:true, need:false, confirm:'Одобрить кандидата', note:'Рекрутер отправит кандидату оффер.', run:x => d('feedback', {verdict:'approve', comment:x})},
    {label:'Отказать', kind:'danger', ask:true, need:true, whom:'рекрутер', confirm:'Отказать кандидату', note:'Кандидат уйдёт в отказы, рекрутер увидит ваш комментарий. Вернуть кандидата нельзя.', run:x => d('feedback', {verdict:'reject', comment:x})});
  const canReject = open && editor && c.stage !== 'mgr' && c.stage !== 'offer';
  const extra = canReject && html`<${Btn} kind="ghost" className="btn-cancel" onClick=${() => setRej(true)}>Отказать кандидату<//>`;

  const h = r.hires.find(x => x.cid === c.id);
  const stageName = c.stage === 'rejected' ? 'Отказ' : c.stage === 'accepted' ? (h ? {prep:'Выход ' + Model.fmtDate(h.start), intern:'На стажировке', docs:'Оформляется', fin:'Оформлен', fot:'Оформлен', done:'В штате', dropped:'Не продолжили после стажировки'}[h.stage] : 'Согласился')
    : c.stage === 'approved' ? 'Одобрен руководителем' : c.stage === 'mgr' ? 'У руководителя' : c.stage === 'offer' ? 'Оффер отправлен' : {new:'Новый', hr:'Интервью HR', test:'Тестовое'}[c.stage];
  const ckind = x => /одобрил$|согласил|Выбран|нанимаем/i.test(x.text) ? 'ok' : /отказ/i.test(x.text) ? 'stop' : 'ev';
  const ctimeline = c.timeline.map((x, i) => ({at:x.at, title:x.text, who:x.by ? whoLine(x.by) : '', kind:i === 0 ? 'new' : ckind(x)}));
  const contacts = html`<section className="sec"><h3 className="sec-h">Контакты</h3>
    <${Facts} rows=${[['Телефон', c.phone && html`<a href=${'tel:' + c.phone.replace(/\s/g, '')}>${c.phone}</a>`],
      ['Telegram', c.tg && html`<a href=${'https://t.me/' + c.tg.replace('@', '')} target="_blank" rel="noopener">${c.tg}</a>`],
      ['Почта', c.email && html`<a href=${'mailto:' + c.email}>${c.email}</a>`],
      ['Резюме', c.resume && html`<a href=${c.resume} target="_blank" rel="noopener">Открыть</a>`]]}/>
  </section>`;
  const about = html`<section className="sec"><h3 className="sec-h">О кандидате</h3>
    <${Facts} rows=${[['Сейчас', c.position], ['Опыт', c.experience], ['Ожидания', c.expect], ['Комментарий', c.comment && html`<p className="text">${c.comment}</p>`]]}/>
  </section>`;

  return html`<div className="mgrid">
    <${ModalHead} title=${c.name} sub=${html`<${BackLink} href=${'#/r/' + r.id}>${r.title}<//>`} strip=${html`<${Strip} rows=${[{steps:candSteps(c)}]}/>`}/>
    <div className="mmain">
      ${c.stage === 'rejected' && html`<${Note} title=${'Отказ: ' + c.reject.reason.toLowerCase()} by=${c.reject.by} at=${c.reject.at} quote=${c.reject.comment}/>`}
      ${top}
      <div className="brief"><div className="brief-c">${editor ? contacts : about}</div><div className="brief-c">${editor ? about : contacts}</div></div>
      ${c.feedback.length > 0 && html`<section className="sec"><h3 className="sec-h">Ответ руководителя</h3>
        ${c.feedback.map((f, i) => html`<div key=${i} style=${{marginBottom:8}}><div>${f.verdict === 'approve' ? 'Одобрил' : 'Отказал'}: ${name(f.by)}, ${Model.fmtDate(f.at)}</div>${f.comment && html`<blockquote className="step-q">${f.comment}</blockquote>`}</div>`)}
      </section>`}
      <${Files} files=${c.files} can=${editor} onAdd=${fs => Store.dispatch('addFiles', {id:r.id, cid:c.id, files:fs})}/>
    </div>
    <${Side} info=${[['Этап', stageName], ['На этапе с', Model.fmtDate(c.stageAt, true)], ['Источник', c.source], ['Добавлен', c.timeline[0] && Model.fmtDate(c.timeline[0].at, true)]]} history=${ctimeline}/>
    ${rej ? html`<${ModalFoot}><div className="decide">
        <p className="now-m" style=${{margin:'0 0 10px'}}>Кандидат уйдёт в отказы, руководитель увидит причину. Вернуть кандидата нельзя.</p>
        <div className="grid-dc">
          <${Field} label="Причина отказа" error=${err && !reason ? err : ''}><select className="inp" value=${reason} onChange=${e => { setReason(e.target.value); setErr(''); }}>
            <option value="">Выберите</option>${Model.REJECT.map(x => html`<option key=${x}>${x}</option>`)}</select><//>
          <${Field} label="Комментарий" optional=${reason !== 'Другое'} error=${err && reason ? err : ''}><input className="inp" value=${rc} onInput=${e => { setRc(e.target.value); setErr(''); }}/><//>
        </div>
        <div className="row"><${Btn} kind="danger" onClick=${doReject}>Отказать<//><${Btn} kind="ghost" onClick=${() => { setRej(false); setErr(''); }}>Отмена<//></div>
      </div><//>`
      : (actions.length || extra) ? html`<${ModalFoot}><${Decide} actions=${actions} extra=${extra}/><//>` : null}
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
    <section className="form-sec"><h3>Контакты</h3>
      <div className="grid-dc">
        <${Field} id="ac-name" label="ФИО" error=${err.name}><input className="inp" value=${f.name} onInput=${set('name')} autoComplete="off"/><//>
        <${Field} id="ac-source" label="Откуда" error=${err.source}><select className="inp" value=${f.source} onChange=${set('source')}><option value="">Выберите</option>${Model.SOURCES.map(s => html`<option key=${s}>${s}</option>`)}</select><//>
      </div>
      <div className="grid3">
        <${Field} id="ac-phone" label="Телефон" error=${err.contact}><input className="inp" type="tel" value=${f.phone} onInput=${set('phone')} placeholder="+7"/><//>
        <${Field} label="Telegram"><input className="inp" value=${f.tg} onInput=${set('tg')} placeholder="@"/><//>
        <${Field} label="Почта"><input className="inp" type="email" value=${f.email} onInput=${set('email')}/><//>
      </div>
    </section>
    <section className="form-sec"><h3>О кандидате</h3>
      <div className="grid3">
        <${Field} label="Сейчас работает" optional=${true}><input className="inp" value=${f.position} onInput=${set('position')}/><//>
        <${Field} label="Опыт" optional=${true}><input className="inp" value=${f.experience} onInput=${set('experience')}/><//>
        <${Field} label="Ожидания по зарплате" optional=${true}><input className="inp" value=${f.expect} onInput=${set('expect')}/><//>
      </div>
      <${Field} label="Ссылка на резюме" optional=${true}><input className="inp" type="url" value=${f.resume} onInput=${set('resume')} placeholder="https://"/><//>
      <${Field} label="Комментарий" optional=${true}><textarea className="inp" rows="2" value=${f.comment} onInput=${set('comment')}/><//>
    </section>
    <${ModalFoot}><div className="row"><${Btn} kind="primary" onClick=${send}>Добавить<//><${Btn} kind="ghost" onClick=${onCancel}>Отмена<//></div><//>
  </div>`;
}
const Panel = {leave:f => f()};
