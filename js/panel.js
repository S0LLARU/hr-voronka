/* Открытая заявка. Сверху — что за вакансия и чей сейчас ход; если ход того, кто смотрит,
   здесь же его решение. Ниже вкладки: путь заявки со всеми шагами и чек-листами,
   кандидаты, сама заявка, история. */
'use strict';

const go = h => { location.hash = h; };

/* ---------- решения по шагам ---------- */
function Facts({rows}){
  return html`<dl className="kv">${rows.filter(x => x[1]).map(([k, val]) => html`<${Fragment} key=${k}><dt>${k}</dt><dd>${val}</dd><//>`)}</dl>`;
}
const RETURN_NOTE = 'Заявка вернётся руководителю. После доработки она снова придёт в HR и пройдёт согласование заново.';
const REJECT_NOTE = 'Заявка закроется, руководитель увидит причину. Отменить это нельзя: понадобится новая заявка.';
const hrComment = r => { const l = r.log.filter(x => x.step === 'hr').pop(); return l && l.comment; };
const finComment = r => { const l = r.log.filter(x => x.step === 'finance').pop(); return l ? 'Согласовано' + (l.comment ? ': ' + l.comment : '') : ''; };

function AssignForm({r}){
  const load = id => Store.get().requests.filter(x => x.recruiter === id && !['closed','rejected','cancelled'].includes(x.status)).length;
  const [rec, setRec] = useState(''), [prio, setPrio] = useState(r.priority || 'normal'), [dl, setDl] = useState(toInput(r.start)), [err, setErr] = useState({});
  const send = () => {
    const e = {}; if(!rec) e.rec = 'Выберите рекрутера'; if(!dl) e.dl = 'Укажите срок закрытия';
    setErr(e); if(Object.keys(e).length) return;
    Store.dispatch('assign', {id:r.id, recruiter:rec, priority:prio, deadline:fromInput(dl)});
  };
  return html`<div style=${{marginTop:12}}>
    <div className="field">
      <span className="l" id="rec-l">Рекрутер</span>
      <div className="radios" role="radiogroup" aria-labelledby="rec-l">
        ${Model.RECRUITERS.map(id => html`<label key=${id}><input type="radio" name="rec" checked=${rec === id} onChange=${() => { setRec(id); setErr({}); }}/>
          ${name(id)} <small>${load(id)} в работе</small></label>`)}
      </div>
      ${err.rec && html`<span className="err">${err.rec}</span>`}
    </div>
    <div className="grid2">
      <div className="field"><span className="l">Приоритет</span><${Seg} label="Приоритет" value=${prio} onChange=${setPrio} options=${[['normal','Обычный'],['high','Срочно']]}/></div>
      <${Field} label="Срок закрытия" error=${err.dl}><input className="inp" type="date" value=${dl} onInput=${e => setDl(e.target.value)}/><//>
    </div>
    <${Btn} kind="primary" onClick=${send}>Назначить<//>
  </div>`;
}

function PublishForm({r, more}){
  const [f, setF] = useState({platform:'HH', date:toInput(Date.now()), link:'', comment:''}), [err, setErr] = useState('');
  const set = k => e => setF(Object.assign({}, f, {[k]:e.target.value}));
  const send = () => {
    if(!f.date){ setErr('Укажите дату публикации'); return; }
    Store.dispatch('publish', {id:r.id, platform:f.platform, date:fromInput(f.date), link:f.link.trim(), comment:f.comment.trim()});
    setF({platform:'HH', date:toInput(Date.now()), link:'', comment:''});
  };
  return html`<div style=${{marginTop:12}}>
    <div className="grid2">
      <${Field} label="Площадка"><select className="inp" value=${f.platform} onChange=${set('platform')}>${Model.PLATFORMS.map(p => html`<option key=${p}>${p}</option>`)}</select><//>
      <${Field} label="Дата публикации" error=${err}><input className="inp" type="date" value=${f.date} onInput=${set('date')}/><//>
    </div>
    <${Field} label="Ссылка" optional=${true}><input className="inp" type="url" inputMode="url" value=${f.link} onInput=${set('link')} placeholder="https://"/><//>
    <${Field} label="Комментарий" optional=${true}><input className="inp" value=${f.comment} onInput=${set('comment')}/><//>
    <${Btn} kind=${more ? 'secondary' : 'primary'} onClick=${send}>${more ? 'Добавить площадку' : 'Вакансия опубликована'}<//>
  </div>`;
}

function DecisionForm({r, h}){
  const [verdict, setVerdict] = useState(''), [comment, setComment] = useState(''), [until, setUntil] = useState(toInput(h.decideBy + 7 * Model.D)), [err, setErr] = useState({});
  const send = () => {
    const e = {};
    if(!verdict) e.verdict = 'Выберите решение';
    if(!comment.trim()) e.comment = 'Комментарий обязателен: его увидят HR и рекрутер';
    if(verdict === 'extend' && !until) e.until = 'Укажите новый срок';
    setErr(e); if(Object.keys(e).length) return;
    Store.dispatch('decide', {id:r.id, hid:h.id, verdict, comment:comment.trim(), until:verdict === 'extend' ? fromInput(until) : null});
  };
  return html`<div style=${{marginTop:12}}>
    <div className="field">
      <div className="radios" role="radiogroup" aria-label="Решение по стажировке">
        <label><input type="radio" name=${'dec' + h.id} checked=${verdict === 'hire'} onChange=${() => setVerdict('hire')}/>Нанимаем <small>начнётся оформление</small></label>
        <label><input type="radio" name=${'dec' + h.id} checked=${verdict === 'drop'} onChange=${() => setVerdict('drop')}/>Не продолжаем <small>отказ после стажировки, место снова в подборе</small></label>
        <label><input type="radio" name=${'dec' + h.id} checked=${verdict === 'extend'} onChange=${() => setVerdict('extend')}/>Продлить стажировку <small>решение перенесётся на новую дату</small></label>
      </div>
      ${err.verdict && html`<span className="err">${err.verdict}</span>`}
    </div>
    ${verdict === 'extend' && html`<${Field} label="До какого числа" error=${err.until}><input className="inp" type="date" value=${until} onInput=${e => setUntil(e.target.value)}/><//>`}
    <${Field} label=${verdict === 'extend' ? 'Причина продления' : 'Комментарий'} error=${err.comment}>
      <textarea className="inp" rows="3" value=${comment} onInput=${e => { setComment(e.target.value); setErr(Object.assign({}, err, {comment:''})); }}/>
    <//>
    <${Btn} kind="primary" onClick=${send}>Сохранить решение<//>
  </div>`;
}

/* блок «ваш ход»: одно решение — одна понятная кнопка; возврат и отказ — только с комментарием */
function MyTurn({r, t, setTab, tab, now}){
  const d = (type, p) => Store.dispatch(type, Object.assign({id:r.id}, p));
  const late = Model.late(t, now);
  const waited = t.since ? 'Ждёт ' + Model.ago(t.since, now) : t.due ? (t.dueKind === 'выход' ? 'Выход ' : 'Срок — ') + Model.fmtDate(t.due) : '';
  const head = html`<div className="now-t">${t.mine}${t.hn ? ': ' + t.hn : ''}</div>${waited && html`<div className=${'now-m' + (late ? ' late' : '')}>${late && html`<${Icon} n="late" s=${14} label="Срок прошёл"/> `}${waited}</div>`}`;
  const box = body => html`<div className="now is-mine">${head}${body}</div>`;
  const h = t.h && r.hires.find(x => x.id === t.h);

  if(!h) switch(r.status){
    case 'draft': return box(html`<div className="row"><${Btn} kind="primary" onClick=${() => go('#/r/' + r.id + '/edit')}>Открыть черновик<//></div>`);
    case 'returned': return box(html`
      <blockquote className="now-q">${r.returned.comment}</blockquote>
      <div className="now-m">${name(r.returned.by)}, ${Model.fmtDateTime(r.returned.at)}</div>
      <div className="row"><${Btn} kind="primary" onClick=${() => go('#/r/' + r.id + '/edit')}>Доработать заявку<//></div>`);
    case 'hr': return box(html`<${Decide} actions=${[
      {label:'Принять и передать в Finance', kind:'primary', run:c => d('hrAccept', {comment:c})},
      {label:'Вернуть на доработку', ask:true, need:true, whom:'руководитель', note:RETURN_NOTE, run:c => d('hrReturn', {comment:c})}]}/>`);
    case 'finance': return box(html`
      <${Facts} rows=${[['Зарплата', r.salary], ['Бонусы / KPI', r.bonus || 'Не указаны'], ['Количество', r.seats > 1 ? r.seats + ' человека' : ''],
        ['Дата выхода', Model.fmtDate(r.start, true)], ['Причина', Model.REASONS[r.reason] + (r.reasonOther ? ': ' + r.reasonOther : '')], ['Комментарий HR', hrComment(r)]]}/>
      <${Decide} actions=${[
        {label:'Согласовать и передать CEO', kind:'primary', run:c => d('finApprove', {comment:c})},
        {label:'Вернуть на доработку', ask:true, need:true, whom:'руководитель', note:RETURN_NOTE, run:c => d('finReturn', {comment:c})},
        {label:'Отклонить', kind:'danger', ask:true, need:true, whom:'руководитель', confirm:'Отклонить заявку', note:REJECT_NOTE, run:c => d('finReject', {comment:c})}]}/>`);
    case 'ceo': return box(html`
      <${Facts} rows=${[['Руководитель', name(r.manager)], ['Причина', Model.REASONS[r.reason]], ['Зарплата', r.salary + (r.seats > 1 ? ' × ' + r.seats : '')],
        ['Дата выхода', Model.fmtDate(r.start, true)], ['Комментарий HR', hrComment(r)], ['Finance', finComment(r)]]}/>
      <${Decide} actions=${[
        {label:'Одобрить поиск', kind:'primary', run:c => d('ceoApprove', {comment:c})},
        {label:'Отклонить', kind:'danger', ask:true, need:true, whom:'руководитель', confirm:'Отклонить заявку', note:REJECT_NOTE, run:c => d('ceoReject', {comment:c})}]}/>`);
    case 'assign': return box(html`<${AssignForm} r=${r}/>`);
    case 'assigned': return box(html`
      <${Facts} rows=${[['Срок закрытия', Model.fmtDate(r.deadline, true)], ['Приоритет', Model.PRIORITY[r.priority]]]}/>
      <div className="row"><${Btn} kind="primary" onClick=${() => d('take')}>Взять в работу<//></div>`);
    case 'inwork': return box(html`<${PublishForm} r=${r}/>`);
    default: return box(tab === 'candidates' ? null : html`<div className="row"><${Btn} kind="primary" onClick=${() => setTab('candidates')}>Открыть кандидатов<//></div>`);
  }

  if(h.stage === 'prep'){
    const left = Model.listLeft(h.lists.prep);
    if(Model.PEOPLE[Store.viewer()].role === 'it' || left) return box(html`<div className="row"><${Btn} onClick=${() => setTab('path', 'h-' + h.id)}>К чек-листу<//></div>`);
    return box(html`<div className="row"><${Btn} kind="primary" onClick=${() => d('started', {hid:h.id})}>Вышел на стажировку<//></div>`);
  }
  if(h.stage === 'intern') return box(html`<${DecisionForm} r=${r} h=${h}/>`);
  if(h.stage === 'docs'){
    const left = Model.listLeft(h.lists.docs);
    return box(html`<div className="row">${left
      ? html`<${Btn} onClick=${() => setTab('path', 'h-' + h.id)}>К документам<//>`
      : html`<${Btn} kind="primary" onClick=${() => d('registered', {hid:h.id})}>Сотрудник официально оформлен<//>`}</div>`);
  }
  if(h.stage === 'fin' || h.stage === 'fot') return box(html`
    <${Facts} rows=${[['ФИО', h.name], ['Должность', r.title], ['Отдел', r.dept], ['Проект', r.project], ['Руководитель', name(r.manager)],
      ['Дата выхода', Model.fmtDate(h.internStart || h.start, true)], ['Оформлен', Model.fmtDate(h.hiredAt, true)], ['Оклад', h.salary],
      ['Бонус / KPI', r.bonus || 'Нет'], ['Тип занятости', r.employment]]}/>
    <${Decide} actions=${h.stage === 'fin'
      ? [{label:'Принято в работу', kind:'primary', run:c => d('finAccept', {hid:h.id, comment:c})}]
      : [{label:'Учтено в ФОТ', kind:'primary', ask:true, need:false, confirm:'Учтено в ФОТ', run:c => d('fot', {hid:h.id, comment:c})}]}/>`);
  return null;
}

/* чужой ход: кто сейчас действует и сколько ждёт */
function Waiting({t, now}){
  const late = Model.late(t, now);
  const meta = [name(t.p)];
  if(t.since && !t.ongoing) meta.push('ждёт ' + Model.ago(t.since, now));
  if(t.due) meta.push((t.dueKind === 'выход' ? 'выход ' : 'срок ') + Model.fmtDate(t.due));
  if(t.count) meta.push(t.count[0] + ' из ' + t.count[1]);
  return html`<div className="now"><div className="now-t">${t.full || t.text}${t.hn ? ': ' + t.hn : ''}</div><div className=${'now-m' + (late ? ' late' : '')}>${late && html`<${Icon} n="late" s=${14} label="Срок прошёл"/> `}${meta.join(', ')}</div></div>`;
}

/* ---------- путь заявки ---------- */
function Checklist({r, h, list, v}){
  const items = h.lists[list];
  if(!items) return null;
  const done = items.filter(i => i.done).length;
  return html`<div>
    <div className="check-h">${Model.LISTS[list].name}<span className="num">${done} из ${items.length}</span></div>
    <ul className="check">
      ${items.map((it, i) => {
        const can = Model.canCheck(it, r, v), id = 'ck-' + h.id + list + i;
        return html`<li key=${i} className=${it.done ? 'done' : ''}>
          <input type="checkbox" id=${id} checked=${!!it.done} disabled=${!can}
            onChange=${e => Store.dispatch('check', {id:r.id, hid:h.id, list, i, done:e.target.checked})}/>
          <label className="ci-t" htmlFor=${id}>${it.t}${it.opt ? html` <span className="muted">при надобности</span>` : ''}</label>
          <span className="ci-w">${it.done ? shortName(it.done.by) + ', ' + Model.fmtDate(it.done.at) : Model.WHO[it.who]}</span>
        </li>`;
      })}
    </ul>
  </div>`;
}

function Step({state, title, meta, quote, children, id}){
  return html`<li className=${'step is-' + state} id=${id}>
    <span className="dot" aria-hidden="true">${state === 'done' && html`<${Icon} n="check" s=${12} w=${2.4}/>`}</span>
    <div>
      <div className="step-n">${title}<span className="sr">${{done:' — пройдено', now:' — текущий шаг', next:' — впереди', stop:' — остановлено'}[state]}</span></div>
      ${meta && html`<div className="step-m">${meta}</div>`}
      ${quote && html`<blockquote className="step-q">${quote}</blockquote>`}
      ${[].concat(children || []).some(Boolean) && html`<div className="step-body">${children}</div>`}
    </div>
  </li>`;
}

function PathTab({r, v, now, focus}){
  const ref = useRef(null);
  useEffect(() => { if(focus){ const el = document.getElementById(focus); if(el){ el.scrollIntoView({block:'start', behavior:Anim.on() ? 'smooth' : 'auto'}); } } }, [focus]);
  const last = s => r.log.filter(x => x.step === s).pop();
  const by = l => l ? name(l.by) + ', ' + Model.fmtDateTime(l.at) : '';
  const order = ['draft','returned','hr','finance','ceo','assign','assigned','inwork','published'];
  const pos = order.indexOf(r.status);
  const stopped = r.status === 'rejected' || r.status === 'cancelled';
  const stopAt = stopped ? r.log.filter(x => x.step === 'reject' || x.step === 'cancel').pop() : null;
  const reached = k => r.log.some(x => x.step === k);
  const st = (doneKey, nowCond) => reached(doneKey) && !nowCond ? 'done' : nowCond ? 'now' : 'next';
  const editC = Model.perms(r, v).editCandidates;
  const steps = [];

  const sent = last('sent');
  steps.push(html`<${Step} key="req" state=${sent && r.status !== 'draft' && r.status !== 'returned' ? 'done' : 'now'} title="Заявка"
    meta=${sent ? name(r.initiator) + ', ' + Model.fmtDateTime(sent.at) : 'Черновик'}
    quote=${r.status === 'returned' ? r.returned.comment : ''}/>`);
  const hr = last('hr');
  steps.push(html`<${Step} key="hr" state=${r.status === 'hr' ? 'now' : hr && pos !== 1 ? 'done' : stopped && !hr && reached('sent') ? 'stop' : 'next'} title="Проверка HR" meta=${hr && r.status !== 'hr' ? by(hr) : r.status === 'hr' ? name(Model.HRD) : ''} quote=${hr && hr.comment}/>`);
  const fin = last('finance');
  const finStop = stopAt && stopAt.by === Model.FIN;
  steps.push(html`<${Step} key="fin" state=${finStop ? 'stop' : r.status === 'finance' ? 'now' : fin && r.status !== 'returned' ? 'done' : 'next'} title=${finStop ? 'Finance отклонил' : 'Finance'}
    meta=${finStop ? by(stopAt) : fin ? by(fin) : r.status === 'finance' ? name(Model.FIN) : ''} quote=${finStop ? stopAt.comment : fin && fin.comment}/>`);
  const ceo = last('ceo');
  const ceoStop = stopAt && stopAt.by === Model.CEO;
  steps.push(html`<${Step} key="ceo" state=${ceoStop ? 'stop' : r.status === 'ceo' ? 'now' : ceo ? 'done' : 'next'} title=${ceoStop ? 'CEO отклонил' : 'CEO'}
    meta=${ceoStop ? by(stopAt) : ceo ? by(ceo) : r.status === 'ceo' ? name(Model.CEO) : ''} quote=${ceoStop ? stopAt.comment : ceo && ceo.comment}/>`);
  if(stopAt && stopAt.step === 'cancel') steps.push(html`<${Step} key="cancel" state="stop" title="Заявка отменена" meta=${by(stopAt)} quote=${r.cancel.reason + (r.cancel.comment ? '. ' + r.cancel.comment : '')}/>`);
  if(!stopped){
    const as = last('assign'), tk = last('take');
    steps.push(html`<${Step} key="rec" state=${tk ? 'done' : (r.status === 'assign' || r.status === 'assigned') ? 'now' : 'next'} title=${r.recruiter ? 'Рекрутер: ' + name(r.recruiter) : 'Рекрутер'}
      meta=${tk ? 'Назначила ' + shortName(as.by) + ' ' + Model.fmtDate(as.at) + ', в работе с ' + Model.fmtDate(tk.at) + (r.deadline ? ', срок ' + Model.fmtDate(r.deadline) : '')
        : as ? 'Назначен ' + Model.fmtDate(as.at) + ', ещё не взял в работу' : r.status === 'assign' ? 'Назначает ' + name(Model.HRD) : ''}/>`);
    const pubs = r.publications;
    steps.push(html`<${Step} key="pub" state=${pubs.length ? 'done' : r.status === 'inwork' ? 'now' : 'next'} title="Публикация"
      meta=${pubs.length ? '' : ''}>
      ${pubs.length ? html`<ul className="files">${pubs.map((p, i) => html`<li key=${i}><span>${p.platform}</span><small className="num">${Model.fmtDate(p.date)}</small>
        ${p.link && html`<a href=${p.link} target="_blank" rel="noopener">ссылка</a>`}${p.comment && html`<small>${p.comment}</small>`}</li>`)}</ul>` : null}
      ${pubs.length && editC && r.status === 'published' ? html`<details><summary className="muted" style=${{cursor:'pointer', marginTop:6}}>Добавить площадку</summary><${PublishForm} r=${r} more=${true}/></details>` : null}
    <//>`);
    const hires = Model.activeHires(r), nC = r.candidates.length;
    const searching = r.status === 'published' && hires.length < r.seats;
    steps.push(html`<${Step} key="search" state=${hires.length >= r.seats ? 'done' : searching ? 'now' : 'next'} title="Подбор"
      meta=${nC ? nC + ' ' + Model.plural(nC, 'кандидат','кандидата','кандидатов') + (r.seats > 1 ? ', выбрано ' + hires.length + ' из ' + r.seats : hires.length ? ', выбран ' + hires[0].name : '') : ''}/>`);
  }

  const hireSteps = r.hires.filter(h => h.stage !== 'dropped' || true).map(h => {
    const s = h.stage, idx = ['prep','intern','docs','fin','fot','done'].indexOf(s), dropped = s === 'dropped';
    const S = (i) => dropped ? (i < 1 ? 'done' : i === 1 ? 'stop' : 'next') : idx > i ? 'done' : idx === i ? 'now' : 'next';
    const dec = h.decision;
    return html`<${Fragment} key=${h.id}>
      <div className="hire-h" id=${'h-' + h.id}>${h.name}</div>
      <ol className="path">
        <${Step} state=${S(0)} title="Подготовка к выходу" meta=${'Согласился ' + Model.fmtDate(h.chosen) + ', выход ' + Model.fmtDate(h.start)}>
          ${(s === 'prep') && html`<${Checklist} r=${r} h=${h} list="prep" v=${v}/>`}
          ${s !== 'prep' && html`<details><summary className="muted" style=${{cursor:'pointer'}}>Чек-лист: ${h.lists.prep.filter(i => i.done).length} из ${h.lists.prep.length}</summary><${Checklist} r=${r} h=${h} list="prep" v=${v}/></details>`}
        <//>
        <${Step} state=${S(1)} title=${dropped ? 'Не продолжаем после стажировки' : 'Стажировка'}
          meta=${h.internStart ? 'С ' + Model.fmtDate(h.internStart) + (s === 'intern' ? ', решение до ' + Model.fmtDate(h.decideBy) : dec ? ', решение ' + Model.fmtDate(dec.at) + ' — ' + shortName(dec.by) : '') : ''}
          quote=${dec && dec.comment}>
          ${h.lists.day1 && html`${s === 'intern' ? html`<${Checklist} r=${r} h=${h} list="day1" v=${v}/>`
            : html`<details><summary className="muted" style=${{cursor:'pointer'}}>Первый день: ${h.lists.day1.filter(i => i.done).length} из ${h.lists.day1.length}</summary><${Checklist} r=${r} h=${h} list="day1" v=${v}/></details>`}`}
        <//>
        ${!dropped && html`
        <${Step} state=${S(2)} title="Оформление" meta=${h.hiredAt ? 'Официально оформлен ' + Model.fmtDate(h.hiredAt, true) : ''}>
          ${h.lists.docs && (s === 'docs' ? html`<${Checklist} r=${r} h=${h} list="docs" v=${v}/>`
            : html`<details><summary className="muted" style=${{cursor:'pointer'}}>Документы: ${h.lists.docs.filter(i => i.done).length} из ${h.lists.docs.length}</summary><${Checklist} r=${r} h=${h} list="docs" v=${v}/></details>`)}
          ${h.lists.onboarding && html`<details open=${s === 'fin' || s === 'fot'}><summary className="muted" style=${{cursor:'pointer', marginTop:8}}>Onboarding: ${h.lists.onboarding.filter(i => i.done).length} из ${h.lists.onboarding.length}</summary><${Checklist} r=${r} h=${h} list="onboarding" v=${v}/></details>`}
        <//>
        <${Step} state=${idx >= 3 ? (s === 'done' ? 'done' : 'now') : 'next'} title="Finance: учесть в ФОТ"
          meta=${h.fotAt ? 'Учтено ' + Model.fmtDateTime(h.fotAt.at) + ', ' + shortName(h.fotAt.by) : h.finAccepted ? 'Принято в работу ' + Model.fmtDateTime(h.finAccepted.at) : s === 'fin' ? 'Уведомление отправлено ' + Model.fmtDateTime(h.hiredAt) : ''}
          quote=${h.fotAt && h.fotAt.comment}/>`}
      </ol>
    <//>`;
  });

  const closed = r.status === 'closed';
  return html`<div ref=${ref}>
    <ol className="path">${steps}</ol>
    ${hireSteps}
    ${!stopped && html`<ol className="path" style=${{marginTop:hireSteps.length ? 4 : 0}}>
      <${Step} state=${closed ? 'done' : 'next'} title="Заявка закрыта" meta=${closed ? Model.fmtDate(r.closedAt, true) + ', за ' + Model.days(r.created, r.closedAt) + ' ' + Model.plural(Model.days(r.created, r.closedAt), 'день','дня','дней') : r.seats > 1 ? 'Когда все ' + r.seats + ' человека учтены в ФОТ' : 'Когда сотрудник учтён в ФОТ'}/>
    </ol>`}
  </div>`;
}

/* ---------- кандидаты ---------- */
function CandidatesTab({r, v, now}){
  const p = Model.perms(r, v), [showRej, setShowRej] = useState(false);
  const live = r.candidates.filter(c => c.stage !== 'rejected' && c.stage !== 'accepted');
  const chosen = r.candidates.filter(c => c.stage === 'accepted');
  const rej = r.candidates.filter(c => c.stage === 'rejected');
  const row = c => {
    const waitMgr = c.stage === 'mgr', mine = waitMgr && r.manager === v, late = waitMgr && c.stageAt + Model.SLA.feedback < now;
    const s = c.stage === 'approved' ? (p.editCandidates ? 'Отправить оффер' : 'Одобрен') : c.stage === 'offer' ? 'Оффер ' + Model.fmtDate(c.offer.at)
      : Model.ago(c.stageAt, now);
    return html`<button key=${c.id} className="cand" onClick=${() => go('#/r/' + r.id + '/c/' + c.id)}>
      <span className="cand-n">${c.name}</span><span className="cand-p">${c.position || c.source}</span>
      <span className=${'cand-s' + (mine || (c.stage === 'approved' && p.editCandidates) ? ' is-mine' : '') + (late ? ' late' : '')}>${late && !mine ? html`<${Icon} n="late" s=${13} label="Срок ответа прошёл"/> ` : ''}${s}</span>
    </button>`;
  };
  return html`<div>
    ${p.editCandidates && Model.activeHires(r).length < r.seats && html`<div className="row" style=${{marginBottom:16}}><${Btn} onClick=${() => go('#/r/' + r.id + '/add')}><${Icon} n="plus"/>Добавить кандидата<//></div>`}
    ${chosen.length > 0 && html`<div className="group"><div className="group-h">Выбраны <span className="num">${chosen.length}</span></div>
      ${chosen.map(c => { const h = r.hires.find(x => x.cid === c.id); return html`<button key=${c.id} className="cand" onClick=${() => go('#/r/' + r.id + '/c/' + c.id)}>
        <span className="cand-n">${c.name}</span><span className="cand-p">${c.position}</span>
        <span className="cand-s">${h ? {prep:'выход ' + Model.fmtDate(h.start), intern:'стажировка', docs:'оформление', fin:'оформлен', fot:'оформлен', done:'в штате'}[h.stage] : ''}</span></button>`; })}</div>`}
    ${Model.STAGES.slice().reverse().map(s => { const list = live.filter(c => Model.stageGroup(c.stage) === s.id); return list.length ? html`<div className="group" key=${s.id}>
      <div className="group-h">${s.id === 'mgr' && r.manager === v ? 'Ждут вашего ответа' : s.name} <span className="num">${list.length}</span></div>${list.map(row)}</div>` : null; })}
    ${!r.candidates.length && html`<p className="muted">Кандидатов пока нет</p>`}
    ${rej.length > 0 && html`<div className="group">
      <button className="group-t" aria-expanded=${showRej} onClick=${() => setShowRej(!showRej)}>Отказы <span className="muted num">${rej.length}</span>
        <span style=${{transform:showRej ? 'rotate(180deg)' : '', display:'inline-flex'}}><${Icon} n="down" s=${14}/></span></button>
      ${showRej && rej.map(c => html`<button key=${c.id} className="cand" onClick=${() => go('#/r/' + r.id + '/c/' + c.id)}>
        <span className="cand-n">${c.name}</span><span className="cand-p">${c.reject.reason}</span>
        <span className="cand-s">${(Model.STAGES.find(s => s.id === c.reject.from) || {name:c.reject.from === 'intern' ? 'Стажировка' : ''}).name}</span></button>`)}
    </div>`}
  </div>`;
}

function CandidateView({r, c, v, now}){
  const p = Model.perms(r, v), d = (type, x) => Store.dispatch(type, Object.assign({id:r.id, cid:c.id}, x));
  const [rej, setRej] = useState(false), [reason, setReason] = useState(''), [rc, setRc] = useState(''), [err, setErr] = useState('');
  const [offer, setOffer] = useState({salary:r.salary, start:toInput(r.start && r.start > now ? r.start : now + 14 * Model.D)});
  const [start, setStart] = useState(toInput(c.offer ? c.offer.start : r.start));
  const [when, setWhen] = useState('');
  const editor = p.editCandidates, manager = r.manager === v, open = c.stage !== 'rejected' && c.stage !== 'accepted';
  const doReject = () => {
    if(!reason){ setErr('Выберите причину'); return; }
    if(reason === 'Другое' && !rc.trim()){ setErr('Напишите причину'); return; }
    d('reject', {reason, comment:rc.trim()}); setRej(false);
  };
  const stageName = c.stage === 'rejected' ? 'Отказ' : c.stage === 'accepted' ? 'Выбран' : c.stage === 'approved' ? 'Одобрен руководителем' : c.stage === 'mgr' ? 'У руководителя' : Model.STAGES.find(s => s.id === c.stage).name;

  let actions = null;
  if(open && editor && !rej){
    if(c.stage === 'new') actions = html`<div className="grid2" style=${{alignItems:'end'}}><${Field} label="Когда интервью" optional=${true}><input className="inp" value=${when} onInput=${e => setWhen(e.target.value)} placeholder="вт 11:00"/><//><div className="field"><${Btn} kind="primary" onClick=${() => d('move', {to:'hr', when:when.trim()})}>Пригласить на интервью HR<//></div></div>`;
    if(c.stage === 'hr') actions = html`<div className="row"><${Btn} kind="primary" onClick=${() => d('move', {to:'mgr'})}>Передать руководителю<//><${Btn} onClick=${() => d('move', {to:'test'})}>Отправить тестовое<//></div>`;
    if(c.stage === 'test') actions = html`<div className="row"><${Btn} kind="primary" onClick=${() => d('move', {to:'mgr'})}>Передать руководителю<//>
      ${!c.timeline.some(x => x.text === 'Тестовое получено') && html`<${Btn} onClick=${() => d('note', {text:'Тестовое получено'})}>Тестовое получено<//>`}</div>`;
    if(c.stage === 'mgr' && !manager) actions = html`<p className=${'muted' + (c.stageAt + Model.SLA.feedback < now ? ' late' : '')}>Ждёт ответа: ${name(r.manager)}, ${Model.ago(c.stageAt, now)}</p>`;
    if(c.stage === 'approved') actions = html`<div>
      <div className="grid2"><${Field} label="Оклад в оффере"><input className="inp" value=${offer.salary} onInput=${e => setOffer(Object.assign({}, offer, {salary:e.target.value}))}/><//>
        <${Field} label="Дата выхода"><input className="inp" type="date" value=${offer.start} onInput=${e => setOffer(Object.assign({}, offer, {start:e.target.value}))}/><//></div>
      <${Btn} kind="primary" onClick=${() => d('offer', {salary:offer.salary, start:fromInput(offer.start)})}>Отправить оффер<//></div>`;
    if(c.stage === 'offer') actions = html`<div>
      <${Field} label="Дата выхода"><input className="inp" type="date" value=${start} onInput=${e => setStart(e.target.value)}/><//>
      <div className="row"><${Btn} kind="primary" onClick=${() => d('accepted', {start:fromInput(start)})}>Согласился<//>
        <${Btn} kind="danger" onClick=${() => d('reject', {reason:'Отказался сам', comment:'Отказался от оффера'})}>Отказался от оффера<//></div></div>`;
  }
  const mgrDecide = open && c.stage === 'mgr' && manager && html`<div className="now is-mine" style=${{marginTop:0, marginBottom:20}}>
    <div className="now-t">Ваш ответ по кандидату</div>
    <div className=${'now-m' + (c.stageAt + Model.SLA.feedback < now ? ' late' : '')}>Ждёт ${Model.ago(c.stageAt, now)}</div>
    <${Decide} actions=${[
      {label:'Одобрить', kind:'primary', ask:true, need:false, confirm:'Одобрить кандидата', run:x => d('feedback', {verdict:'approve', comment:x})},
      {label:'Отказать', kind:'danger', ask:true, need:true, whom:'рекрутер', confirm:'Отказать кандидату', run:x => d('feedback', {verdict:'reject', comment:x})}]}/>
  </div>`;

  const hasTop = mgrDecide || actions || (open && editor && c.stage !== 'mgr') || rej || c.stage === 'rejected';
  const ckind = x => /одобрил$|согласил|Выбран|нанимаем/i.test(x.text) ? 'ok' : /отказ/i.test(x.text) ? 'stop' : 'ev';
  const ctimeline = c.timeline.map((x, i) => ({at:x.at, title:x.text, who:x.by ? whoLine(x.by) : '', kind:i === 0 ? 'new' : ckind(x)}));
  return html`<div className="page">
    <div className="pg-main">
      <${ModalHead} title=${c.name} sub=${html`<${BackLink} href=${'#/r/' + r.id}>${r.title}<//>`} badge=${stageName} stop=${c.stage === 'rejected'}/>
      ${hasTop && html`<section className="box">
        ${mgrDecide}
        ${actions && html`<div className="box-act">${actions}</div>`}
        ${open && editor && c.stage !== 'mgr' && !rej && html`<div className="row" style=${{marginTop:12}}><${Btn} kind="ghost" className="btn-flush" onClick=${() => setRej(true)}>Отказать кандидату<//></div>`}
        ${rej && html`<div className="now">
          <${Field} label="Причина отказа" error=${err && !reason ? err : ''}><select className="inp" value=${reason} onChange=${e => { setReason(e.target.value); setErr(''); }}>
            <option value="">Выберите</option>${Model.REJECT.map(x => html`<option key=${x}>${x}</option>`)}</select><//>
          <${Field} label="Комментарий" optional=${reason !== 'Другое'} error=${err && reason ? err : ''}><textarea className="inp" rows="2" value=${rc} onInput=${e => { setRc(e.target.value); setErr(''); }}/><//>
          <div className="row"><${Btn} kind="danger" onClick=${doReject}>Отказать<//><${Btn} kind="ghost" onClick=${() => { setRej(false); setErr(''); }}>Отмена<//></div>
        </div>`}
        ${c.stage === 'rejected' && html`<div className="now"><div className="now-t">Отказ: ${c.reject.reason.toLowerCase()}</div>
          <div className="now-m">${name(c.reject.by)}, ${Model.fmtDateTime(c.reject.at)}</div>${c.reject.comment && html`<blockquote className="now-q">${c.reject.comment}</blockquote>`}</div>`}
      </section>`}
      <section className="box">
        ${c.position && html`<p className="muted" style=${{margin:'0 0 18px'}}>${c.position}</p>`}
        <section className="sec"><h2 className="sec-h">Контакты</h2>
          <${Facts} rows=${[['Телефон', c.phone && html`<a href=${'tel:' + c.phone.replace(/\s/g, '')}>${c.phone}</a>`],
            ['Telegram', c.tg && html`<a href=${'https://t.me/' + c.tg.replace('@', '')} target="_blank" rel="noopener">${c.tg}</a>`],
            ['Почта', c.email && html`<a href=${'mailto:' + c.email}>${c.email}</a>`],
            ['Резюме', c.resume && html`<a href=${c.resume} target="_blank" rel="noopener">Открыть</a>`]]}/>
        </section>
        ${[c.position, c.experience, c.expect, c.comment].some(Boolean) && html`<section className="sec"><h2 className="sec-h">О кандидате</h2>
          <${Facts} rows=${[['Сейчас', c.position], ['Опыт', c.experience], ['Ожидания', c.expect], ['Комментарий рекрутера', c.comment]]}/>
        </section>`}
        ${c.feedback.length > 0 && html`<section className="sec"><h2 className="sec-h">Ответ руководителя</h2>
          ${c.feedback.map((f, i) => html`<div key=${i} style=${{marginBottom:8}}><div>${f.verdict === 'approve' ? 'Одобрил' : 'Отказал'}: ${name(f.by)}, ${Model.fmtDate(f.at)}</div>${f.comment && html`<blockquote className="step-q">${f.comment}</blockquote>`}</div>`)}
        </section>`}
        <${Files} files=${c.files} can=${editor} onAdd=${fs => Store.dispatch('addFiles', {id:r.id, cid:c.id, files:fs})}/>
      </section>
    </div>
    <aside className="pg-side">
      <section className="box"><h2 className="box-t">История</h2><${Timeline} items=${ctimeline}/></section>
      <section className="box"><h2 className="box-t">Информация</h2>
        <${Info} rows=${[['Вакансия', r.title], ['Этап', stageName], ['На этапе с', Model.fmtDate(c.stageAt, true)], ['Источник', c.source], ['Добавлен', c.timeline[0] && Model.fmtDate(c.timeline[0].at, true)]]}/>
      </section>
    </aside>
  </div>`;
}

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

function AddCandidate({r, onDone, onCancel, guard}){
  const [f, setF] = useState({name:'', phone:'', tg:'', email:'', resume:'', source:'', expect:'', position:'', experience:'', comment:''});
  const [err, setErr] = useState({});
  const set = k => e => { const n = Object.assign({}, f, {[k]:e.target.value}); setF(n); guard.current = Object.values(n).some(x => x.trim()); if(err[k] || err.contact) setErr({}); };
  const send = () => {
    const e = {};
    if(!f.name.trim()) e.name = 'Укажите ФИО';
    if(!f.phone.trim() && !f.tg.trim() && !f.email.trim()) e.contact = 'Нужен хотя бы один контакт: телефон, Telegram или почта';
    if(!f.source) e.source = 'Укажите источник';
    setErr(e);
    if(Object.keys(e).length){ const k = Object.keys(e)[0]; const el = document.getElementById('ac-' + (k === 'contact' ? 'phone' : k)); el && el.focus(); return; }
    guard.current = false;
    const cid = Store.dispatch('addCandidate', {id:r.id, fields:Object.fromEntries(Object.entries(f).map(([k, x]) => [k, x.trim()]))});
    onDone(cid);
  };
  return html`<div className="page is-narrow">
    <${ModalHead} title="Новый кандидат" sub=${html`<${BackLink} href=${'#/r/' + r.id}>${r.title}<//>`}/>
    <section className="box">
      <${Field} id="ac-name" label="ФИО" error=${err.name}><input className="inp" value=${f.name} onInput=${set('name')} autoComplete="off"/><//>
      <div className="grid2">
        <${Field} id="ac-phone" label="Телефон" error=${err.contact}><input className="inp" type="tel" value=${f.phone} onInput=${set('phone')} placeholder="+7"/><//>
        <${Field} label="Telegram"><input className="inp" value=${f.tg} onInput=${set('tg')} placeholder="@"/><//>
        <${Field} label="Почта"><input className="inp" type="email" value=${f.email} onInput=${set('email')}/><//>
        <${Field} id="ac-source" label="Источник" error=${err.source}><select className="inp" value=${f.source} onChange=${set('source')}><option value="">Выберите</option>${Model.SOURCES.map(s => html`<option key=${s}>${s}</option>`)}</select><//>
      </div>
      <${Field} label="Ссылка на резюме" optional=${true}><input className="inp" type="url" value=${f.resume} onInput=${set('resume')} placeholder="https://"/><//>
      <div className="grid2">
        <${Field} label="Текущая должность" optional=${true}><input className="inp" value=${f.position} onInput=${set('position')}/><//>
        <${Field} label="Опыт" optional=${true}><input className="inp" value=${f.experience} onInput=${set('experience')}/><//>
      </div>
      <${Field} label="Зарплатные ожидания" optional=${true}><input className="inp" value=${f.expect} onInput=${set('expect')}/><//>
      <${Field} label="Комментарий" optional=${true}><textarea className="inp" rows="3" value=${f.comment} onInput=${set('comment')}/><//>
      <div className="row"><${Btn} kind="primary" onClick=${send}>Добавить кандидата<//><${Btn} kind="ghost" onClick=${onCancel}>Отмена<//></div>
    </section>
  </div>`;
}

/* ---------- заявка и история ---------- */
function InfoTab({r, v}){
  const p = Model.perms(r, v), canEdit = (r.status === 'draft' || r.status === 'returned') && r.initiator === v;
  const sec = (t, rows) => html`<section className="sec"><h3 className="sec-h">${t}</h3><${Facts} rows=${rows}/></section>`;
  return html`<div>
    ${canEdit && html`<div className="row" style=${{marginBottom:16}}><${Btn} onClick=${() => go('#/r/' + r.id + '/edit')}>Изменить заявку<//></div>`}
    ${sec('Общая информация', [['Должность', r.title], ['Отдел', r.dept], ['Проект', r.project], ['Руководитель', name(r.manager)], ['Количество', String(r.seats)],
      ['Причина', Model.REASONS[r.reason] + (r.reasonOther ? ': ' + r.reasonOther : '')]])}
    ${sec('Должность', [['Обязанности', r.duties && html`<p className="text">${r.duties}</p>`], ['Требования', r.reqs && html`<p className="text">${r.reqs}</p>`], ['Опыт', r.experience],
      ['Навыки', r.skills], ['Личные качества', r.personal], ['Образование', r.education], ['Дополнительно', r.extra]])}
    ${sec('Условия', [['Формат', r.format], ['Локация', r.location], ['График', r.schedule], ['Занятость', r.employment],
      ['Зарплата', p.salary ? r.salary : ''], ['Бонусы / KPI', p.salary ? r.bonus : ''], ['Испытательный срок', r.probation], ['Желаемая дата выхода', Model.fmtDate(r.start, true)]])}
    ${sec('Дополнительно', [['Приоритет', Model.PRIORITY[r.priority]], ['Комментарий', r.comment && html`<p className="text">${r.comment}</p>`]])}
    ${r.files && r.files.length > 0 && html`<section className="sec"><h3 className="sec-h">Файлы</h3><ul className="files">${r.files.map((f, i) => html`<li key=${i}><${Icon} n="clip" s=${15}/>${f.name}</li>`)}</ul></section>`}
  </div>`;
}

/* лента событий справа: что было, кто и когда. Длинная история свёрнута до последних событий */
const TL_ICON = {new:'doc', ok:'ok', stop:'no', ret:'ret', ev:'ev'};
const whoLine = id => { const p = Model.PEOPLE[id]; return p ? p.name + ', ' + (p.role === 'manager' ? 'руководитель' : p.role === 'recruiter' ? 'рекрутер' : Model.ROLE[p.role]) : ''; };
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
    ${hidden > 0 && html`<button className="tl-more" onClick=${() => setAll(true)}><${Icon} n="down" s=${14}/>Показать ещё ${hidden} ${Model.plural(hidden, 'событие', 'события', 'событий')}</button>`}
    <ol className="tl">${items.slice(hidden).map((x, i) => html`<li key=${i}>
      <span className=${'tl-i is-' + x.kind}><${Icon} n=${TL_ICON[x.kind]} s=${20}/></span>
      <div className="tl-b">
        <div className="tl-top"><span className="tl-t">${x.title}</span><time className="tl-d num">${Model.fmtDateTime(x.at)}</time></div>
        ${x.who && html`<div className="tl-w">${x.who}</div>`}
        ${x.comment && html`<blockquote className="tl-c">${x.comment}</blockquote>`}
      </div>
    </li>`)}</ol>
  </div>`;
}
function Info({rows}){
  return html`<dl className="info">${rows.filter(x => x[1]).map(([k, val]) => html`<div key=${k}><dt>${k}</dt><dd>${val}</dd></div>`)}</dl>`;
}

/* ---------- отмена заявки ---------- */
function CancelForm({r, onDone}){
  const [reason, setReason] = useState(''), [c, setC] = useState(''), [err, setErr] = useState('');
  const box = useRef(null);
  useEffect(() => { Anim.reveal(box.current); }, []);
  const send = () => {
    if(!reason){ setErr('Выберите причину'); return; }
    if(reason === 'Другое' && !c.trim()){ setErr('Напишите причину'); return; }
    Store.dispatch('cancel', {id:r.id, reason, comment:c.trim()}); onDone();
  };
  return html`<div className="now" ref=${box}>
    <div className="now-t">Отменить заявку?</div>
    <div className="now-m">Поиск остановится. HR, рекрутер и Finance увидят причину.</div>
    <div style=${{marginTop:12}}>
      <${Field} label="Причина" error=${!reason ? err : ''}><select className="inp" value=${reason} onChange=${e => { setReason(e.target.value); setErr(''); }}><option value="">Выберите</option>${Model.CANCEL.map(x => html`<option key=${x}>${x}</option>`)}</select><//>
      <${Field} label="Комментарий" optional=${reason !== 'Другое'} error=${reason ? err : ''}><textarea className="inp" rows="2" value=${c} onInput=${e => { setC(e.target.value); setErr(''); }}/><//>
      <div className="row"><${Btn} kind="danger" onClick=${send}>Отменить заявку<//><${Btn} kind="ghost" onClick=${onDone}>Не отменять<//></div>
    </div>
  </div>`;
}

/* ---------- страница заявки: слева заявка и ваш ход, справа история и сведения ---------- */
function RequestPage({r, view, cid}){
  const v = useViewer(), now = useNow();
  const [tab, setTabState] = useState('path'), [focus, setFocus] = useState(null), [cancel, setCancel] = useState(false);
  const p = Model.perms(r, v), more = useMenu(), guard = useRef(false);
  const [ask, setAsk] = useState(null);
  const tabsRef = useRef(null);
  const setTab = (t, f) => { setTabState(t); setFocus(f || null); if(!f && tabsRef.current && tabsRef.current.getBoundingClientRect().top < 0) tabsRef.current.scrollIntoView({block:'start'}); };
  useEffect(() => { setTabState(Model.phase(r) === 'search' && p.candidates && r.manager === v ? 'candidates' : 'path'); setCancel(false); setFocus(null); }, [r.id, v]);
  useEffect(() => { if(!p.candidates && tab === 'candidates') setTabState('path'); }, [v]);

  const showCands = p.candidates && !['draft','hr','returned','finance','ceo','assign','assigned'].includes(r.status) && r.status !== 'rejected';
  const turns = Model.turns(r), mine = turns.filter(t => Model.mineTurn(t, v)), others = turns.filter(t => !Model.mineTurn(t, v) && !t.passive);

  const leave = then => { if(guard.current){ setAsk(() => then); return; } then(); };
  useEffect(() => { Panel.leave = leave; });
  useEffect(() => () => { Panel.leave = f => f(); }, []);

  if(view === 'cand' || view === 'add'){
    const c = r.candidates.find(x => x.id === cid);
    return html`<div>
      ${view === 'add' ? html`<${AddCandidate} r=${r} guard=${guard} onCancel=${() => leave(() => { guard.current = false; go('#/r/' + r.id); })} onDone=${id => { guard.current = false; go('#/r/' + r.id + '/c/' + id); }}/>`
        : c ? html`<${CandidateView} r=${r} c=${c} v=${v} now=${now}/>` : html`<div className="page is-narrow"><${ModalHead} title="Кандидат не найден" sub=${html`<${BackLink} href=${'#/r/' + r.id}>${r.title}<//>`}/></div>`}
      ${ask && html`<div className="guard" role="alert"><span>Кандидат не добавлен. Выйти без сохранения?</span>
        <${Btn} kind="danger" onClick=${() => { const f = ask; setAsk(null); guard.current = false; f(); }}>Выйти<//><${Btn} kind="ghost" onClick=${() => setAsk(null)}>Остаться<//></div>`}
    </div>`;
  }

  const hires = Model.activeHires(r), ph = Model.phase(r), stopped = r.status === 'rejected' || r.status === 'cancelled';
  const tabs = [['path','Путь'], showCands && ['candidates','Кандидаты', r.candidates.filter(c => c.stage !== 'rejected').length], p.request && ['info','Заявка']].filter(Boolean);
  const late = r.deadline && r.deadline < now && ph !== 'closed';
  const log = r.log.filter(l => !/^(Отметил|Снял отметку):/.test(l.text)).map(l => ({at:l.at, title:byGender(l.text, l.by), who:whoLine(l.by), comment:l.comment, kind:logKind(l)}));
  return html`<div className="page">
    <div className="pg-main">
      <${ModalHead} title=${html`${r.title}${r.seats > 1 && html`<small className="num">× ${r.seats}</small>`}`} sub=${r.dept + ' / ' + r.project} badge=${Model.statusText(r)} stop=${stopped}>
          ${p.cancel && html`<div className="m-more">
            <button className="icon-btn" ref=${more.btn} aria-label="Ещё" aria-haspopup="menu" aria-expanded=${more.open} onClick=${() => more.setOpen(!more.open)}><${Icon} n="more"/></button>
            ${more.open && html`<div className="menu" role="menu" ref=${more.box} onKeyDown=${more.onMenuKey} style=${{right:0, top:38}}>
              <button className="menu-item" role="menuitem" style=${{color:'var(--red)'}} onClick=${() => { more.setOpen(false); setCancel(true); }}>Отменить заявку</button>
            </div>`}
          </div>`}
      <//>
      ${(cancel || mine.length > 0 || others.length > 0) && html`<section className="box">
        ${cancel && html`<${CancelForm} r=${r} onDone=${() => setCancel(false)}/>`}
        ${!cancel && mine.map((t, i) => html`<${MyTurn} key=${'m' + i + (t.h || '') + r.status} r=${r} t=${t} now=${now} setTab=${setTab} tab=${tab}/>`)}
        ${!cancel && others.map((t, i) => html`<${Waiting} key=${'o' + i} t=${t} now=${now}/>`)}
        ${!cancel && r.seats > 1 && hires.length > 0 && hires.length < r.seats && html`<div className="now-m" style=${{marginTop:10}}>Выбрано ${hires.length} из ${r.seats}, подбор продолжается</div>`}
      </section>`}
      <section className="box">
        <div className="pills" role="tablist" aria-label="Разделы заявки" ref=${tabsRef}>
          ${tabs.map(([k, t, n]) => html`<button key=${k} role="tab" className="tab" id=${'tab-' + k} aria-selected=${tab === k} aria-controls="tabpanel"
            onClick=${() => setTab(k)} onKeyDown=${e => { if(e.key === 'ArrowRight' || e.key === 'ArrowLeft'){ const i = tabs.findIndex(x => x[0] === tab), j = (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length; setTab(tabs[j][0]); requestAnimationFrame(() => document.getElementById('tab-' + tabs[j][0]).focus()); } }}
            tabIndex=${tab === k ? 0 : -1}>${t}${n ? html`<span className="n num">${n}</span>` : null}</button>`)}
        </div>
        <div className="tab-body" role="tabpanel" id="tabpanel" aria-labelledby=${'tab-' + tab}>
          ${tab === 'path' && html`<${PathTab} r=${r} v=${v} now=${now} focus=${focus}/>`}
          ${tab === 'candidates' && html`<${CandidatesTab} r=${r} v=${v} now=${now}/>`}
          ${tab === 'info' && html`<${InfoTab} r=${r} v=${v}/>`}
        </div>
      </section>
    </div>
    <aside className="pg-side">
      ${p.history && html`<section className="box"><h2 className="box-t">История</h2><${Timeline} key=${r.id} items=${log}/></section>`}
      <section className="box"><h2 className="box-t">Информация</h2>
        <${Info} rows=${[
          ['Руководитель', name(r.manager)],
          ['Рекрутер', r.recruiter ? name(r.recruiter) : html`<span className="muted">не назначен</span>`],
          ['Создана', Model.fmtDate(r.created, true)],
          ['Желаемый выход', Model.fmtDate(r.start, true)],
          ['Срок закрытия', r.deadline && html`<span className=${'num' + (late ? ' late' : '')}>${late ? html`<${Icon} n="late" s=${14} label="Срок прошёл"/> ` : ''}${Model.fmtDate(r.deadline, true)}</span>`],
          ['Зарплата', p.salary && r.salary],
          ['Последнее изменение', Model.fmtDate(r.updated, true)]]}/>
      </section>
    </aside>
  </div>`;
}
const Panel = {leave:f => f()};
