/* Экран задач Finance и CEO вместо доски (решение пользователя): им не нужна вся воронка,
   только то, что ждёт их решения. Карточка задачи показывает главное для решения и кнопки сразу —
   CEO одобряет с телефона, не открывая ноутбук. Finance учитывает нового сотрудника в ФОТ одной кнопкой;
   потом это может делать сама финансовая платформа, когда сотрудника учтут там. */
'use strict';

/* решённая карточка гаснет, остальные подтягиваются (useFlip в TasksPage) */
function ApproveCard({r, v}){
  const card = useRef(null);
  const fin = Model.PEOPLE[v].role === 'finance', d = (t, x) => Anim.leave(card.current).then(() => Store.dispatch(t, Object.assign({id:r.id}, x)));
  const hr = lastLog(r, 'hr'), fl = lastLog(r, 'finance');
  const actions = fin ? [
    {label:'Согласовать', kind:'primary', run:c => d('finApprove', {comment:c})},
    {label:'На доработку', run:() => go('#/r/' + r.id + '/review')},
    {label:'Отклонить', kind:'danger', ask:true, need:true, whom:'руководитель', confirm:'Отклонить заявку', note:REJECT_NOTE, run:c => d('finReject', {comment:c})}
  ] : [
    {label:'Одобрить', kind:'primary', run:c => d('ceoApprove', {comment:c})},
    {label:'Отклонить', kind:'danger', ask:true, need:true, whom:'руководитель', confirm:'Отклонить заявку', note:REJECT_NOTE, run:c => d('ceoReject', {comment:c})}
  ];
  return html`<article className="task" data-card=${r.id} data-flip=${'a' + r.id} ref=${card}>
    <div className="task-h">
      <div className="task-t"><h3>${r.title}${r.seats > 1 && html`<small className="num"> × ${r.seats}</small>`}</h3><div className="muted">${r.dept} / ${r.project}</div></div>
      <a className="btn btn-ghost btn-sm" href=${'#/r/' + r.id}>Вся заявка</a>
    </div>
    <${Fields} rows=${[['Зарплата', r.salary], ['Бонусы / KPI', r.bonus], ['Сколько человек', String(r.seats)], ['Желаемый выход', Model.fmtDate(r.start, true)],
      ['Причина', Model.REASONS[r.reason] + (r.reasonOther ? ': ' + r.reasonOther : '')], ['Руководитель', name(r.manager)]]}/>
    ${hr && hr.comment && html`<${Note} title="Комментарий HR" by=${hr.by} at=${hr.at} quote=${hr.comment}/>`}
    ${!fin && fl && html`<${Note} title=${'Finance согласовал' + (fl.comment ? '' : ' без комментария')} by=${fl.by} at=${fl.at} quote=${fl.comment}/>`}
    <div className="task-a"><${Decide} actions=${actions}/></div>
  </article>`;
}

function FotCard({r, h}){
  const card = useRef(null);
  return html`<article className="task" data-card=${r.id} data-flip=${'f' + h.id} ref=${card}>
    <div className="task-h">
      <div className="task-t"><h3>${h.name}</h3><div className="muted">${r.title}, ${r.dept} / ${r.project}</div></div>
      <a className="btn btn-ghost btn-sm" href=${'#/r/' + r.id}>Вся заявка</a>
    </div>
    <${Fields} rows=${[['Оклад', h.salary], ['Бонус / KPI', r.bonus || 'Нет'], ['Дата выхода', Model.fmtDate(h.internStart || h.start, true)], ['Оформлен', Model.fmtDate(h.hiredAt, true)],
      ['Тип занятости', r.employment], ['Руководитель', name(r.manager)]]}/>
    <div className="task-a"><div className="row is-end"><${Btn} kind="primary" onClick=${() => Anim.leave(card.current).then(() => Store.dispatch('fot', {id:r.id, hid:h.id, comment:''}))}>Учесть в ФОТ<//></div></div>
  </article>`;
}

function TasksPage({S, v}){
  const fin = Model.PEOPLE[v].role === 'finance';
  const approve = S.requests.filter(r => r.status === (fin ? 'finance' : 'ceo')).sort((a, b) => a.statusAt - b.statusAt);
  const fot = fin ? S.requests.flatMap(r => r.hires.filter(h => h.stage === 'fot' || h.stage === 'fin').map(h => ({r, h}))) : [];
  const done = S.requests.flatMap(r => r.log.filter(l => l.by === v && ['finance', 'ceo', 'reject', 'return', 'fot'].includes(l.step)).map(l => ({r, l})))
    .sort((a, b) => b.l.at - a.l.at).slice(0, 6);
  const sec = (t, n, list) => html`<section className="tasks-sec"><h2 className="tasks-st" data-flip=${t}>${t} <span className="muted num">${n}</span></h2>${list}</section>`;
  const ref = useRef(null); useFlip(ref);
  useLayoutEffect(() => { if(ref.current) Anim.stagger(ref.current.querySelectorAll('.task, .tasks-done a, .tasks-empty'), 10); }, [v]);
  return html`<div className="tasks" ref=${ref}>
    <h1 className="sr">Мои задачи</h1>
    ${approve.length > 0 && sec(fin ? 'Согласовать заявку' : 'Одобрить поиск', approve.length, approve.map(r => html`<${ApproveCard} key=${r.id} r=${r} v=${v}/>`))}
    ${fot.length > 0 && sec('Учесть в ФОТ', fot.length, fot.map(({r, h}) => html`<${FotCard} key=${h.id} r=${r} h=${h}/>`))}
    ${!approve.length && !fot.length && html`<div className="tasks-empty"><${Icon} n="ok" s=${28}/><p>Задач нет</p><span className="muted">Заявка появится здесь, когда дойдёт до вас.</span></div>`}
    ${done.length > 0 && html`<section className="tasks-sec"><h2 className="tasks-st" data-flip="done">Сделано недавно</h2>
      <div className="tasks-done">${done.map(({r, l}, i) => html`<a key=${r.id + l.at} data-flip=${r.id + l.at} href=${'#/r/' + r.id}><span>${r.title}</span><span className="muted">${byGender(l.text, l.by)}</span><span className="muted num">${Model.fmtDate(l.at)}</span></a>`)}</div></section>`}
  </div>`;
}
