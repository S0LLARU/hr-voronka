/* Модель воронки найма: люди, роли, заявка и всё, что с ней происходит.

   Заявка идёт по одному пути. Каждый шаг делает конкретный человек, и следующий шаг
   открывается только после предыдущего (п. 27 ТЗ). Все действия проходят через act():
   оно меняет заявку и пишет запись в историю — кто, когда, что, с каким комментарием.
   Демонстрационные данные собраны теми же действиями, поэтому история у них настоящая.

   Сейчас всё хранится в браузере (localStorage). Сервер встанет на место Store,
   экраны при этом не меняются. */
'use strict';

const Model = (function(){
  const H = 3600e3, D = 24 * H;

  const ROLE = {manager:'Руководитель', hrd:'HRD', recruiter:'Рекрутер', finance:'Finance', ceo:'CEO', it:'IT'};

  const PEOPLE = {
    dan:{name:'Данияр Ахметов', role:'manager', dept:'Продакшн'},
    mad:{name:'Мадина Касымова', role:'manager', dept:'Маркетинг', f:1},
    ase:{name:'Асель Жумабаева', role:'manager', dept:'Продажи', f:1},
    erl:{name:'Ерлан Мусин', role:'manager', dept:'Разработка'},
    gul:{name:'Гульнара Исаева', role:'hrd', f:1},
    ali:{name:'Алия Нурланова', role:'recruiter', f:1},
    sam:{name:'Самат Беков', role:'recruiter'},
    rin:{name:'Ринат Оспанов', role:'finance'},
    arm:{name:'Арман Тлеубаев', role:'ceo'},
    olz:{name:'Олжас Каримов', role:'it'}
  };
  const HRD = 'gul', FIN = 'rin', CEO = 'arm', IT = 'olz';
  const RECRUITERS = ['ali','sam'];

  /* сколько шаг может ждать, пока не станет просроченным; потом настраивает администратор */
  const SLA = {hr:D, returned:2*D, finance:D, ceo:D, assign:D, assigned:D, inwork:2*D, feedback:D, offer:D, fin:D, fot:2*D};

  const DEPTS = ['Продакшн','Маркетинг','Продажи','Разработка','Финансы','Администрация'];
  const REASONS = {new:'Новая позиция', replace:'Замена сотрудника', grow:'Расширение команды', other:'Другое'};
  const FORMATS = ['Офис','Гибрид','Удалённо'];
  const EMPLOYMENT = ['Полная занятость','Частичная занятость','Проектная работа'];
  const PRIORITY = {normal:'Обычный', high:'Срочно'};
  const PLATFORMS = ['HH','Telegram','Instagram','LinkedIn','Рекомендации','Другое'];
  const SOURCES = PLATFORMS;
  const REJECT = ['Не подходит по опыту','Не прошёл интервью','Не сдал тестовое','Зарплатные ожидания','Отказался сам','Другое'];
  const CANCEL = ['Позиция больше не требуется','Нашли внутри компании','Другое'];

  /* этапы кандидата (п. 12): «Новые» включают первичный скрининг, «Одобрен» — решение руководителя */
  const STAGES = [
    {id:'new', name:'Новые'},
    {id:'hr', name:'Интервью HR'},
    {id:'test', name:'Тестовое'},
    {id:'mgr', name:'Руководитель'},
    {id:'offer', name:'Оффер'}
  ];
  const stageGroup = s => s === 'approved' ? 'offer' : s;

  /* чек-листы (пп. 14, 15, 17, 18); who — кто отмечает пункт */
  const LISTS = {
    prep:{name:'Подготовка к выходу', items:[
      ['Отправить onboarding-презентацию','recruiter'],['Отправить список документов','recruiter'],['Запросить фото','recruiter'],
      ['Запросить удостоверение личности','recruiter'],['Подготовить NDA','recruiter'],['Сформировать личное дело','recruiter'],
      ['Подготовить приветствие на экране','recruiter'],['Подготовить рабочее место','recruiter it'],['Подготовить технику','recruiter it'],
      ['Создать корпоративную почту','it','opt'],['Дать доступы к рабочим системам','it'],['Дать доступ к общим дискам','it'],
      ['Установить нужные программы','it']]},
    day1:{name:'Первый рабочий день', items:[
      ['Приветствие на экране к 10:00','recruiter'],['Приветствие в рабочем чате','recruiter'],['Встретить на ресепшн','recruiter'],
      ['Познакомить с HR и руководителем отдела','recruiter'],['Представить команде','manager'],['Познакомить с непосредственным руководителем','manager'],
      ['Назначить наставника','manager'],['Провести IT-брифинг','it'],['Проверить технику','it'],['Проверить доступы','it'],
      ['Провести по To-do листу','mentor'],['Обозначить первые задачи','mentor'],['Объяснить рабочие процессы','mentor']]},
    docs:{name:'Документы', items:[
      ['Подготовить трудовой договор','recruiter'],['Подписать трудовой договор','recruiter'],['Создать личное дело','recruiter'],
      ['Внести сотрудника в 1С','recruiter'],['Зарегистрировать в Clockster','recruiter'],['Заполнить данные сотрудника','recruiter'],
      ['Проверить документы','recruiter']]},
    onboarding:{name:'Onboarding', items:[
      ['Welcome pack','recruiter'],['Кофе с HRD','recruiter'],['Знакомство с командой','recruiter'],['Знакомство с руководителем','recruiter'],
      ['Закрепить наставника','manager'],['Поставить первые задачи','manager'],['Объяснить KPI на испытательный срок','manager'],
      ['Провести по офису','recruiter'],['Показать рабочие зоны','recruiter'],['Объяснить внутренние процессы','recruiter'],
      ['Пройти To-do лист','recruiter']]}
  };
  const makeList = k => LISTS[k].items.map(([t, who, opt]) => ({t, who, opt:!!opt, done:null}));
  const listLeft = l => l.filter(i => !i.done && !i.opt).length;

  /* ---------- колонки доски ---------- */
  const COLUMNS = [
    {id:'approve', name:'Согласование', steps:['HR','Finance','CEO']},
    {id:'search', name:'Подбор', steps:['Рекрутер','Публикация','Кандидаты']},
    {id:'start', name:'Выход', steps:['Подготовка','Стажировка']},
    {id:'hire', name:'Оформление', steps:['Документы','Finance','ФОТ']},
    {id:'closed', name:'Закрыто', steps:[]}
  ];

  const activeHires = r => r.hires.filter(h => h.stage !== 'dropped');
  const openHires = r => activeHires(r).filter(h => h.stage !== 'done');
  const HIRE_PHASE = {prep:'start', intern:'start', docs:'hire', fin:'hire', fot:'hire'};

  function phase(r){
    if(['draft','hr','returned','finance','ceo'].includes(r.status)) return 'approve';
    if(['closed','rejected','cancelled'].includes(r.status)) return 'closed';
    if(activeHires(r).length < r.seats) return 'search';
    const o = openHires(r);
    if(!o.length) return 'closed';
    return o.some(h => HIRE_PHASE[h.stage] === 'start') ? 'start' : 'hire';
  }

  /* шаг внутри колонки: сколько из скольких пройдено — для полосы на карточке */
  function progress(r){
    const p = phase(r);
    if(r.status === 'draft') return null;
    if(p === 'approve') return {n:3, at:{draft:0, returned:0, hr:0, finance:1, ceo:2}[r.status]};
    if(p === 'search') return {n:3, at:{assign:0, assigned:0, inwork:1}[r.status] ?? 2};
    const h = openHires(r)[0];
    if(!h) return null;
    if(p === 'start') return {n:2, at:h.stage === 'prep' ? 0 : 1};
    return {n:3, at:{docs:0, fin:1, fot:2}[h.stage]};
  }

  /* ---------- статус словами (п. 5) ---------- */
  function statusText(r){
    const s = {draft:'Черновик', hr:'На проверке HR', returned:'Возвращено на доработку', finance:'На согласовании Finance',
      ceo:'На согласовании CEO', assign:'Поиск разрешён', assigned:'Назначен рекрутер', inwork:'В работе',
      closed:'Закрыто', rejected:'Отклонено', cancelled:'Отменено'}[r.status];
    if(s) return s;
    const o = openHires(r);
    if(activeHires(r).length < r.seats || !o.length) return r.candidates.length ? 'В подборе' : 'Вакансия опубликована';
    return {prep:'Кандидат выбран', intern:'Стажировка', docs:'Оформление', fin:'Передано в Finance', fot:'Передано в Finance'}[o[0].stage];
  }

  /* ---------- чей сейчас ход ----------
     Список шагов, которые ждут действия: кто (p), что видят все (text), что видит он сам (mine),
     с какого момента ждёт (since) или к какому сроку (due). ongoing — работа идёт, но не ждёт решения. */
  function turns(r){
    const t = [], since = r.statusAt;
    const who = {
      draft:  () => t.push({p:r.initiator, text:'Черновик', mine:'Дописать и отправить', since, ongoing:true}),
      hr:     () => t.push({p:HRD, text:'Проверяет HR', mine:'Проверить заявку', since, sla:SLA.hr}),
      returned:() => t.push({p:r.initiator, text:'На доработке у руководителя', mine:'Доработать заявку', since, sla:SLA.returned}),
      finance:() => t.push({p:FIN, text:'Ждёт Finance', mine:'Согласовать заявку', since, sla:SLA.finance}),
      ceo:    () => t.push({p:CEO, text:'Ждёт решения CEO', mine:'Одобрить поиск', since, sla:SLA.ceo}),
      assign: () => t.push({p:HRD, text:'HRD назначает рекрутера', mine:'Назначить рекрутера', since, sla:SLA.assign}),
      assigned:() => t.push({p:r.recruiter, text:'Рекрутер публикует вакансию', mine:'Опубликовать вакансию', since, sla:SLA.inwork}),
      inwork: () => t.push({p:r.recruiter, text:'Рекрутер публикует вакансию', mine:'Опубликовать вакансию', since, sla:SLA.inwork})
    }[r.status];
    if(who){ who(); return t; }
    if(['closed','rejected','cancelled'].includes(r.status)) return t;

    if(activeHires(r).length < r.seats){
      const atMgr = r.candidates.filter(c => c.stage === 'mgr');
      const approved = r.candidates.filter(c => c.stage === 'approved');
      if(atMgr.length){
        const n = atMgr.length;
        t.push({p:r.manager, text:'Ждёт ответа руководителя', full:'Ждёт ответа руководителя по ' + n + ' ' + plural(n, 'кандидату','кандидатам','кандидатам'),
          mine:'Ответить по ' + n + ' ' + plural(n, 'кандидату','кандидатам','кандидатам'),
          since:Math.min(...atMgr.map(c => c.stageAt)), sla:SLA.feedback, tab:'candidates'});
      }
      if(approved.length) t.push({p:r.recruiter, text:'Рекрутер готовит оффер', mine:'Отправить оффер', since:Math.min(...approved.map(c => c.stageAt)), sla:SLA.offer, tab:'candidates'});
      if(!t.length) t.push({p:r.recruiter, text:'Идёт подбор', mine:'Идёт подбор', ongoing:true, passive:true, tab:'candidates'});
    }
    openHires(r).forEach(h => {
      const nm = short(h.name);
      if(h.stage === 'prep'){
        const l = h.lists.prep, left = listLeft(l), itLeft = l.filter(i => !i.done && !i.opt && i.who === 'it').length;
        /* свои пункты рекрутер закрыл, остались пункты IT — ход у IT, у рекрутера его нет */
        if(left > itLeft || !left) t.push({p:r.recruiter, h:h.id, hn:nm, text:left ? 'Готовим выход' : 'Выход подготовлен', mine:left ? 'Подготовить выход' : 'Отметить выход на стажировку', due:h.start, dueKind:'выход', ongoing:left > 0,
          count:[l.length - l.filter(i => !i.done).length, l.length]});
        if(itLeft) t.push({p:IT, h:h.id, hn:nm, text:'IT готовит рабочее место', mine:'Подготовить рабочее место', due:h.start, dueKind:'выход', ongoing:true});
      }
      if(h.stage === 'intern') t.push({p:r.manager, h:h.id, hn:nm, text:'Решение по стажировке', mine:'Решить по стажировке', due:h.decideBy, dueKind:'до'});
      if(h.stage === 'docs'){
        const l = h.lists.docs;
        t.push({p:r.recruiter, h:h.id, hn:nm, text:'Оформляем', mine:'Оформить сотрудника', since:h.stageAt, ongoing:listLeft(l) > 0,
          count:[l.filter(i => i.done).length, l.length]});
      }
      if(h.stage === 'fin') t.push({p:FIN, h:h.id, hn:nm, text:'Ждёт Finance', mine:'Принять в работу', since:h.stageAt, sla:SLA.fin});
      if(h.stage === 'fot') t.push({p:FIN, h:h.id, hn:nm, text:'Finance учитывает в ФОТ', mine:'Учесть в ФОТ', since:h.stageAt, sla:SLA.fot});
    });
    return t;
  }
  const mineTurn = (x, v) => x.p === v && !x.passive;
  const late = (x, now) => x.due ? x.due < now : (x.sla ? x.since + x.sla < now : false);

  /* ---------- кто что видит (п. 23) ---------- */
  function visible(r, v){
    const role = PEOPLE[v].role;
    if(r.status === 'draft') return r.initiator === v;
    if(role === 'manager') return r.manager === v || r.initiator === v;
    if(role === 'hrd') return true;
    if(role === 'recruiter') return r.recruiter === v;
    if(role === 'finance') return !!r.reached.finance;
    if(role === 'ceo') return !!r.reached.ceo;
    if(role === 'it') return activeHires(r).some(h => h.stage === 'prep' || h.stage === 'intern');
    return false;
  }
  function perms(r, v){
    const role = PEOPLE[v].role, own = r.manager === v || r.initiator === v;
    return {
      salary: own || ['hrd','recruiter','finance','ceo'].includes(role),
      candidates: own || role === 'hrd' || role === 'recruiter',
      request: role !== 'it',
      history: role !== 'it',
      editCandidates: role === 'hrd' || (role === 'recruiter' && r.recruiter === v),
      cancel: (own || role === 'hrd') && !['closed','rejected','cancelled'].includes(r.status)
    };
  }
  /* может ли человек отметить пункт чек-листа */
  function canCheck(item, r, v){
    const role = PEOPLE[v].role;
    if(role === 'hrd') return true;
    const w = item.who.split(' ');
    if(w.includes('recruiter') && r.recruiter === v) return true;
    if(w.includes('it') && role === 'it') return true;
    if(w.includes('manager') && r.manager === v) return true;
    if(w.includes('mentor') && (r.manager === v || r.recruiter === v)) return true;
    return false;
  }
  const WHO = {recruiter:'Рекрутер', it:'IT', manager:'Руководитель', mentor:'Наставник', 'recruiter it':'Рекрутер и IT'};

  /* ---------- действия ---------- */
  let seq = 1;
  const uid = p => p + (Date.now() % 1e7).toString(36) + (seq++).toString(36);

  function log(r, by, at, text, comment, step){
    r.log.push({at, by, text, comment:comment || '', step:step || ''});
    r.updated = at;
  }
  function status(r, s, at){ r.status = s; r.statusAt = at; }
  function find(S, id){ const r = S.requests.find(x => x.id === id); if(!r) throw new Error('Нет заявки ' + id); return r; }
  const cand = (r, cid) => r.candidates.find(c => c.id === cid);
  const hire = (r, hid) => r.hires.find(h => h.id === hid);
  const lower1 = t => t.charAt(0).toLowerCase() + t.slice(1);
  function ctl(c, at, by, text){ c.timeline.push({at, by, text}); }

  const FIELDS = ['title','dept','project','manager','seats','reason','reasonOther','duties','reqs','experience','skills','personal','education','extra',
    'format','location','schedule','employment','salary','bonus','probation','start','priority','comment','files'];

  const A = {
    create(S, by, at, p){
      const r = {id:uid('r'), initiator:by, created:at, updated:at, status:'draft', statusAt:at, log:[], candidates:[], hires:[],
        publications:[], reached:{}, recruiter:null, deadline:null, returned:null, closedAt:null, cancel:null};
      FIELDS.forEach(k => { r[k] = p.fields[k] ?? (k === 'files' ? [] : ''); });
      r.seats = Math.max(1, +r.seats || 1);
      S.requests.unshift(r);
      log(r, by, at, 'Создал заявку', '', 'created');
      if(p.send){ status(r, 'hr', at); log(r, by, at, 'Отправил в HR', '', 'sent'); }
      return r.id;
    },
    update(S, by, at, p){
      const r = find(S, p.id), was = r.status;
      FIELDS.forEach(k => { if(k in p.fields) r[k] = p.fields[k]; });
      r.seats = Math.max(1, +r.seats || 1);
      if(p.send){
        status(r, 'hr', at);
        log(r, by, at, was === 'returned' ? 'Доработал и отправил снова' : 'Отправил в HR', '', 'sent');
      } else log(r, by, at, 'Изменил заявку');
    },
    hrAccept(S, by, at, p){ const r = find(S, p.id); status(r, 'finance', at); r.reached.finance = at; r.returned = null; log(r, by, at, 'Принял заявку и передал в Finance', p.comment, 'hr'); },
    hrReturn(S, by, at, p){ const r = find(S, p.id); status(r, 'returned', at); r.returned = {by, at, comment:p.comment}; log(r, by, at, 'Вернул на доработку', p.comment, 'return'); },
    finApprove(S, by, at, p){ const r = find(S, p.id); status(r, 'ceo', at); r.reached.ceo = at; log(r, by, at, 'Согласовал', p.comment, 'finance'); },
    finReturn(S, by, at, p){ const r = find(S, p.id); status(r, 'returned', at); r.returned = {by, at, comment:p.comment}; log(r, by, at, 'Вернул на доработку', p.comment, 'return'); },
    finReject(S, by, at, p){ const r = find(S, p.id); status(r, 'rejected', at); r.closedAt = at; log(r, by, at, 'Отклонил заявку', p.comment, 'reject'); },
    ceoApprove(S, by, at, p){ const r = find(S, p.id); status(r, 'assign', at); log(r, by, at, 'Одобрил поиск', p.comment, 'ceo'); },
    ceoReject(S, by, at, p){ const r = find(S, p.id); status(r, 'rejected', at); r.closedAt = at; log(r, by, at, 'Отклонил открытие позиции', p.comment, 'reject'); },
    assign(S, by, at, p){
      const r = find(S, p.id); r.recruiter = p.recruiter; r.priority = p.priority; r.deadline = p.deadline;
      /* назначенный рекрутер сразу в работе: отдельного «взять в работу» нет, его следующий шаг — публикация */
      status(r, 'inwork', at); log(r, by, at, 'Назначил рекрутера: ' + PEOPLE[p.recruiter].name, p.comment, 'assign');
    },
    take(S, by, at, p){ const r = find(S, p.id); status(r, 'inwork', at); log(r, by, at, 'Взял в работу', '', 'take'); },
    publish(S, by, at, p){
      const r = find(S, p.id);
      r.publications.push({at, date:p.date, platform:p.platform, link:p.link || '', comment:p.comment || '', by});
      if(r.status === 'inwork' || r.status === 'assigned') status(r, 'published', at);
      log(r, by, at, 'Опубликовал вакансию: ' + p.platform, p.comment, 'publish');
    },
    addCandidate(S, by, at, p){
      const r = find(S, p.id), f = p.fields;
      const c = {id:uid('c'), name:f.name, phone:f.phone || '', tg:f.tg || '', email:f.email || '', resume:f.resume || '',
        source:f.source || '', expect:f.expect || '', position:f.position || '', experience:f.experience || '', comment:f.comment || '',
        files:f.files || [], stage:'new', stageAt:at, added:at, timeline:[], feedback:[], reject:null};
      r.candidates.push(c);
      ctl(c, at, by, 'Кандидат добавлен');
      log(r, by, at, 'Добавил кандидата: ' + c.name, '', 'cand');
      return c.id;
    },
    move(S, by, at, p){
      const r = find(S, p.id), c = cand(r, p.cid), name = STAGES.find(s => s.id === p.to).name;
      c.stage = p.to; c.stageAt = at;
      const text = {hr:'Приглашён на интервью HR', test:'Отправлено тестовое', mgr:'Передан руководителю'}[p.to] || ('Этап: ' + name);
      ctl(c, at, by, text + (p.when ? ' — ' + p.when : ''));
      log(r, by, at, c.name + ': ' + lower1(text), p.comment, 'cand');
    },
    note(S, by, at, p){ const r = find(S, p.id), c = cand(r, p.cid); ctl(c, at, by, p.text); log(r, by, at, c.name + ': ' + lower1(p.text), '', 'cand'); },
    addFiles(S, by, at, p){
      const r = find(S, p.id), c = cand(r, p.cid);
      p.files.forEach(f => c.files.push(Object.assign({at, by}, f)));
      const t = 'Прикреплено: ' + p.files.map(f => f.kind.toLowerCase() + ' ' + f.name).join(', ');
      ctl(c, at, by, t); log(r, by, at, c.name + ': ' + lower1(t), '', 'cand');
    },
    feedback(S, by, at, p){
      const r = find(S, p.id), c = cand(r, p.cid);
      c.feedback.push({at, by, verdict:p.verdict, comment:p.comment});
      if(p.verdict === 'approve'){ c.stage = 'approved'; c.stageAt = at; ctl(c, at, by, 'Руководитель одобрил'); log(r, by, at, 'Одобрил кандидата: ' + c.name, p.comment, 'feedback'); }
      else { c.stage = 'rejected'; c.reject = {at, by, from:'mgr', reason:'Не подошёл руководителю', comment:p.comment}; ctl(c, at, by, 'Руководитель отказал'); log(r, by, at, 'Отказал кандидату: ' + c.name, p.comment, 'feedback'); }
    },
    reject(S, by, at, p){
      const r = find(S, p.id), c = cand(r, p.cid);
      c.reject = {at, by, from:stageGroup(c.stage), reason:p.reason, comment:p.comment || ''};
      c.stage = 'rejected'; c.stageAt = at;
      ctl(c, at, by, 'Отказ: ' + p.reason.toLowerCase());
      log(r, by, at, 'Отказ кандидату ' + c.name + ': ' + p.reason.toLowerCase(), p.comment, 'cand');
    },
    offer(S, by, at, p){
      const r = find(S, p.id), c = cand(r, p.cid);
      c.stage = 'offer'; c.stageAt = at; c.offer = {salary:p.salary, start:p.start, at};
      ctl(c, at, by, 'Отправлен оффер');
      log(r, by, at, 'Отправил оффер: ' + c.name, '', 'offer');
    },
    accepted(S, by, at, p){
      const r = find(S, p.id), c = cand(r, p.cid);
      c.stage = 'accepted'; c.stageAt = at;
      const h = {id:uid('h'), cid:c.id, name:c.name, start:p.start, stage:'prep', stageAt:at, chosen:at, decideBy:null, decision:null,
        lists:{prep:makeList('prep')}, hiredAt:null, finAccepted:null, fotAt:null, salary:(c.offer && c.offer.salary) || r.salary};
      r.hires.push(h);
      ctl(c, at, by, 'Согласился, выход ' + fmtDate(p.start));
      log(r, by, at, c.name + ' согласился на оффер, выход ' + fmtDate(p.start), '', 'accepted');
    },
    /* исполнитель отмечает свою часть списка разом: «Всё сделано» */
    checkGroup(S, by, at, p){
      const r = find(S, p.id), h = hire(r, p.hid);
      h.lists[p.list].forEach(it => { if(it.who === p.who) it.done = p.done ? {at, by} : null; });
      log(r, by, at, (p.done ? 'Отметил выполненным: ' : 'Вернул в работу: ') + LISTS[p.list].name + ' (' + WHO[p.who] + ') — ' + short(h.name));
    },
    check(S, by, at, p){
      const r = find(S, p.id), h = hire(r, p.hid), it = h.lists[p.list][p.i];
      it.done = p.done ? {at, by} : null;
      log(r, by, at, (p.done ? 'Отметил: ' : 'Снял отметку: ') + it.t + ' — ' + short(h.name));
    },
    started(S, by, at, p){
      const r = find(S, p.id), h = hire(r, p.hid);
      h.stage = 'intern'; h.stageAt = at; h.internStart = at; h.decideBy = at + 2 * D; h.lists.day1 = makeList('day1');
      ctl(cand(r, h.cid), at, by, 'Начало стажировки');
      log(r, by, at, h.name + ' вышел на стажировку', '', 'start');
    },
    decide(S, by, at, p){
      const r = find(S, p.id), h = hire(r, p.hid), c = cand(r, h.cid);
      h.decision = {verdict:p.verdict, comment:p.comment, at, by, until:p.until || null};
      if(p.verdict === 'hire'){ h.stage = 'docs'; h.stageAt = at; h.lists.docs = makeList('docs'); ctl(c, at, by, 'Решение по стажировке: нанимаем'); log(r, by, at, 'Решение по стажировке: нанимаем ' + h.name, p.comment, 'decide'); }
      if(p.verdict === 'drop'){ h.stage = 'dropped'; h.stageAt = at; c.stage = 'rejected'; c.reject = {at, by, from:'intern', reason:'Отказ после стажировки', comment:p.comment}; ctl(c, at, by, 'Отказ после стажировки'); log(r, by, at, 'Не продолжаем с ' + h.name + ' после стажировки', p.comment, 'decide'); }
      if(p.verdict === 'extend'){ h.decideBy = p.until; ctl(c, at, by, 'Стажировка продлена до ' + fmtDate(p.until)); log(r, by, at, 'Продлил стажировку ' + h.name + ' до ' + fmtDate(p.until), p.comment, 'decide'); }
    },
    registered(S, by, at, p){
      const r = find(S, p.id), h = hire(r, p.hid);
      h.stage = 'fin'; h.stageAt = at; h.hiredAt = at; h.lists.onboarding = makeList('onboarding');
      ctl(cand(r, h.cid), at, by, 'Официально оформлен');
      log(r, by, at, h.name + ' официально оформлен', '', 'registered');
      log(r, by, at, 'Finance получил уведомление: учесть ' + h.name + ' в ФОТ', '', 'notify');
    },
    finAccept(S, by, at, p){ const r = find(S, p.id), h = hire(r, p.hid); h.stage = 'fot'; h.stageAt = at; h.finAccepted = {at, by, comment:p.comment}; log(r, by, at, 'Принял в работу: ' + h.name, p.comment, 'finaccept'); },
    fot(S, by, at, p){
      const r = find(S, p.id), h = hire(r, p.hid);
      h.stage = 'done'; h.stageAt = at; h.fotAt = {at, by, comment:p.comment};
      log(r, by, at, 'Учёл в ФОТ: ' + h.name, p.comment, 'fot');
      if(activeHires(r).length >= r.seats && !openHires(r).length){ status(r, 'closed', at); r.closedAt = at; log(r, by, at, 'Заявка закрыта', '', 'closed'); }
    },
    cancel(S, by, at, p){ const r = find(S, p.id); status(r, 'cancelled', at); r.closedAt = at; r.cancel = {reason:p.reason, comment:p.comment}; log(r, by, at, 'Отменил заявку: ' + p.reason.toLowerCase(), p.comment, 'cancel'); }
  };
  function act(S, by, type, p, at){ return A[type](S, by, at == null ? Date.now() : at, p || {}); }

  /* ---------- форматирование ---------- */
  function plural(n, one, few, many){ const a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many; }
  const MON = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
  function fmtDate(t, withYear){ if(!t) return ''; const d = new Date(t); return d.getDate() + ' ' + MON[d.getMonth()] + (withYear && d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''); }
  function fmtTime(t){ const d = new Date(t); return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0'); }
  function fmtDateTime(t){ return fmtDate(t) + ', ' + fmtTime(t); }
  function ago(t, now){
    const m = Math.max(0, now - t) / 60e3;
    if(m < 60) return Math.max(1, Math.round(m)) + ' мин';
    const h = m / 60;
    if(h < 24) return Math.round(h) + ' ч';
    const d = Math.floor(h / 24);
    return d + ' ' + plural(d, 'день','дня','дней');
  }
  function short(name){ const [a, b] = name.split(' '); return b ? a + ' ' + b[0] + '.' : a; }
  const days = (a, b) => Math.max(1, Math.round((b - a) / D));

  /* ---------- демонстрационные данные ----------
     Собраны теми же действиями, что и в работе: у каждой заявки настоящая история. */
  function seed(now){
    const S = {requests:[], v:1};
    const t = h => now - h * H, day = (d, hh) => { const x = new Date(now + d * D); x.setHours(hh ?? 10, 0, 0, 0); return x.getTime(); };
    /* события — в рабочее время: сутки сжимаются в 9:00–19:00, порядок событий сохраняется */
    const work = x => { const d = new Date(x), hr = d.getHours() + d.getMinutes() / 60, m = new Date(x); m.setHours(0, 0, 0, 0);
      const y = m.getTime() + (9 + hr / 24 * 10) * H; return y < now - 10 * 60e3 ? y : x; };
    const go = (by, type, p, h) => act(S, by, type, p, work(t(h)));

    const base = (o) => Object.assign({
      seats:1, reason:'new', reasonOther:'', format:'Офис', location:'Алматы', schedule:'5/2, 9:00–18:00', employment:'Полная занятость',
      probation:'3 месяца', priority:'normal', education:'', extra:'', comment:'', files:[]
    }, o);

    const F = {
      montage: base({title:'Монтажёр', dept:'Продакшн', project:'Новогодняя кампания', manager:'dan', reason:'grow',
        duties:'Монтаж рекламных роликов и видео для соцсетей, цветокоррекция, подготовка версий под площадки.',
        reqs:'Портфолио с коммерческими роликами. Уверенно Premiere Pro и DaVinci Resolve.', experience:'От 2 лет',
        skills:'Premiere Pro, DaVinci Resolve, After Effects на базовом уровне', personal:'Аккуратность, держит сроки',
        salary:'450 000 ₸', bonus:'Премия по итогам проекта', start:day(21), comment:'Под съёмки новогодней кампании в ноябре нужен второй монтажёр.'}),
      smm: base({title:'SMM-менеджер', dept:'Маркетинг', project:'Осенняя кампания', manager:'mad', reason:'replace',
        duties:'Ведение Instagram и Telegram, контент-план, работа с блогерами, отчёты по охватам.',
        reqs:'Кейсы с ростом аккаунтов, умение работать с таргетологом.', experience:'От 1 года', skills:'Контент-план, Canva, Meta Ads Manager',
        personal:'Инициативность', salary:'350 000 ₸', bonus:'KPI по охватам до 20%', format:'Гибрид', start:day(14),
        comment:'Сотрудник увольняется 25 октября, нужно успеть передать дела.'}),
      support: base({title:'Специалист поддержки', dept:'Продажи', project:'Корпоративные клиенты', manager:'ase', reason:'grow',
        duties:'Ответы клиентам в чате и по телефону, заведение заявок в CRM.', reqs:'Грамотная речь на русском и казахском.', experience:'Без опыта',
        skills:'CRM, деловая переписка', personal:'Спокойствие, вежливость', salary:'250 000 ₸', bonus:'', schedule:'2/2, 9:00–21:00', start:day(20)}),
      sales: base({title:'Менеджер по продажам', seats:2, dept:'Продажи', project:'Корпоративные клиенты', manager:'ase', reason:'grow',
        duties:'Поиск и ведение корпоративных клиентов, переговоры, заключение договоров.', reqs:'Опыт B2B-продаж, своя клиентская база приветствуется.',
        experience:'От 2 лет', skills:'Холодные звонки, переговоры, CRM', personal:'Настойчивость', salary:'300 000 ₸', bonus:'', start:day(30)}),
      sound: base({title:'Звукорежиссёр', dept:'Продакшн', project:'Новогодняя кампания', manager:'dan', duties:'Запись и сведение звука на съёмках.', reqs:'', experience:'', skills:'', personal:'', salary:'', bonus:'', start:''}),
      designer: base({title:'Дизайнер', dept:'Маркетинг', project:'Сайт', manager:'mad', reason:'new',
        duties:'Макеты страниц сайта и баннеров, поддержка дизайн-системы.', reqs:'Портфолио веб-проектов, Figma.', experience:'От 3 лет',
        skills:'Figma, дизайн-системы, адаптивная вёрстка макетов', personal:'Внимание к деталям', salary:'500 000 ₸', bonus:'', format:'Гибрид', start:day(30)}),
      front: base({title:'Frontend-разработчик', dept:'Разработка', project:'Мобильное приложение', manager:'erl', reason:'grow',
        duties:'Разработка веб-версии приложения на React, работа с API.', reqs:'React, TypeScript, опыт с REST.', experience:'От 3 лет',
        skills:'React, TypeScript, тестирование', personal:'Самостоятельность', salary:'900 000 ₸', bonus:'Годовой бонус', format:'Гибрид', start:day(35)}),
      motion: base({title:'Моушн-дизайнер', dept:'Продакшн', project:'Новогодняя кампания', manager:'dan', reason:'new',
        duties:'Анимация графики для роликов, титры, упаковка.', reqs:'Портфолио с моушн-работами.', experience:'От 2 лет',
        skills:'After Effects, Cinema 4D', personal:'Креативность', salary:'550 000 ₸', bonus:'', priority:'high', start:day(10)}),
      operator: base({title:'Оператор-постановщик', seats:2, dept:'Продакшн', project:'Новогодняя кампания', manager:'dan', reason:'grow',
        duties:'Съёмка рекламных роликов, работа со светом и камерой.', reqs:'Портфолио, опыт работы с кинокамерами.', experience:'От 3 лет',
        skills:'Blackmagic, RED, свет', personal:'Выносливость', salary:'600 000 ₸', bonus:'', schedule:'Проектный график', start:day(7)}),
      copy: base({title:'Копирайтер', dept:'Маркетинг', project:'Осенняя кампания', manager:'mad', reason:'new',
        duties:'Тексты для рекламы, сайта и соцсетей.', reqs:'Портфолио текстов.', experience:'От 1 года', skills:'Редактура, сторителлинг',
        personal:'Грамотность', salary:'320 000 ₸', bonus:'', format:'Гибрид', start:day(2)}),
      producer: base({title:'Продюсер', dept:'Продакшн', project:'Новогодняя кампания', manager:'dan', reason:'replace',
        duties:'Ведение проектов от брифа до сдачи, бюджеты, команда на площадке.', reqs:'Опыт продюсирования рекламы.', experience:'От 3 лет',
        skills:'Сметы, тайминг, переговоры', personal:'Ответственность', salary:'700 000 ₸', bonus:'Процент от проекта', start:day(-3)}),
      analyst: base({title:'Аналитик данных', dept:'Разработка', project:'Внутренние сервисы', manager:'erl', reason:'new',
        duties:'Отчёты по продажам и маркетингу, дашборды.', reqs:'SQL, Python, BI.', experience:'От 2 лет', skills:'SQL, Python, Power BI',
        personal:'Системность', salary:'650 000 ₸', bonus:'', start:day(-12)}),
      office: base({title:'Офис-менеджер', dept:'Администрация', project:'Офис', manager:'gul', reason:'replace',
        duties:'Ресепшн, закупки, порядок в офисе.', reqs:'Опыт офис-менеджером.', experience:'От 1 года', skills:'1С на базовом уровне', personal:'Доброжелательность',
        salary:'280 000 ₸', bonus:'', start:day(-14)}),
      video: base({title:'Видеограф', dept:'Продакшн', project:'Новогодняя кампания', manager:'dan', reason:'grow',
        duties:'Съёмка бэкстейджа и коротких видео.', reqs:'Портфолио.', experience:'От 1 года', skills:'Sony, монтаж на телефоне', personal:'', salary:'380 000 ₸', bonus:'', start:day(-20)}),
      assist: base({title:'Ассистент руководителя', dept:'Продажи', project:'Корпоративные клиенты', manager:'ase', reason:'new',
        duties:'Календарь, встречи, документы.', reqs:'', experience:'От 1 года', skills:'', personal:'', salary:'260 000 ₸', bonus:'', start:day(10)}),
      qa: base({title:'Тестировщик', dept:'Разработка', project:'Мобильное приложение', manager:'erl', reason:'grow',
        duties:'Ручное тестирование мобильного приложения.', reqs:'', experience:'От 1 года', skills:'', personal:'', salary:'400 000 ₸', bonus:'', start:day(15)})
    };

    /* до разрешения поиска */
    const approve = (key, h0, upto, extra) => {
      const f = F[key], id = go(f.manager, 'create', {fields:f, send:true}, h0);
      const s = extra || {};
      if(upto >= 1) go(HRD, 'hrAccept', {id, comment:s.hr || ''}, s.hrAt);
      if(upto >= 2) go(FIN, 'finApprove', {id, comment:s.fin || ''}, s.finAt);
      if(upto >= 3) go(CEO, 'ceoApprove', {id}, s.ceoAt);
      if(upto >= 4) go(HRD, 'assign', {id, recruiter:s.rec, priority:f.priority, deadline:s.deadline}, s.assignAt);
      if(upto >= 6) go(s.rec, 'publish', {id, date:t(s.pubAt), platform:'HH', link:'https://hh.kz/vacancy/' + (100000 + S.requests.length * 7919)}, s.pubAt);
      if(upto >= 6 && s.pub2) go(s.rec, 'publish', {id, date:t(s.pub2), platform:'Telegram', link:'', comment:'Канал вакансий и два профильных чата'}, s.pub2);
      return id;
    };
    const addC = (id, by, c, h) => go(by, 'addCandidate', {id, fields:c}, h);
    const C = (name, position, source, expect, extra) => Object.assign({name, position, source, expect, phone:phone(name), tg:'@' + translit(name.split(' ')[0]), email:''}, extra || {});

    /* закрытые */
    const qa = approve('qa', 420, 2, {hrAt:400, finAt:380});
    go('erl', 'cancel', {id:qa, reason:'Позиция больше не требуется', comment:'Тестирование забрали подрядчики.'}, 150);
    const assist = approve('assist', 200, 2, {hrAt:180, finAt:150, fin:'Бюджет есть, на усмотрение CEO.'});
    go(CEO, 'ceoReject', {id:assist, comment:'Пока закрываем задачу силами офис-менеджера, вернёмся к вопросу в январе.'}, 100);

    const video = approve('video', 48 + 34 * 24, 6, {hrAt:48 + 33 * 24, finAt:48 + 32 * 24, ceoAt:48 + 31 * 24 + 5, rec:'ali', deadline:day(-10), assignAt:48 + 31 * 24, takeAt:48 + 30 * 24 + 20, pubAt:48 + 30 * 24});
    let c1 = addC(video, 'ali', C('Тимур Бекмуханов','Видеограф, фриланс','Instagram','400 000 ₸'), 48 + 28 * 24);
    go('ali','move',{id:video,cid:c1,to:'hr'},48+27*24); go('ali','move',{id:video,cid:c1,to:'mgr'},48+25*24);
    go('dan','feedback',{id:video,cid:c1,verdict:'approve',comment:'Хорошее портфолио, берём.'},48+24*24);
    go('ali','offer',{id:video,cid:c1,salary:'380 000 ₸',start:t(48+20*24)},48+23*24);
    go('ali','accepted',{id:video,cid:c1,start:t(48+20*24)},48+22*24);
    let vh = S.requests.find(r => r.id === video).hires[0];
    checkAll(video, vh, 'prep', 48 + 21 * 24, 'ali');
    go('ali','started',{id:video,hid:vh.id},48+20*24); checkAll(video, vh, 'day1', 48 + 20 * 24, 'ali');
    go('dan','decide',{id:video,hid:vh.id,verdict:'hire',comment:'Справился, оставляем.'},48+18*24);
    checkAll(video, vh, 'docs', 48 + 10 * 24, 'ali');
    go('ali','registered',{id:video,hid:vh.id},48+5*24);
    go(FIN,'finAccept',{id:video,hid:vh.id},48+4*24);
    go(FIN,'fot',{id:video,hid:vh.id,comment:'Учтён с 1 октября.'},48);

    /* оформление */
    const office = approve('office', 900, 6, {hrAt:880, finAt:860, ceoAt:840, rec:'sam', deadline:day(-5), assignAt:835, takeAt:830, pubAt:828});
    c1 = addC(office, 'sam', C('Жанна Мухтарова','Администратор в клинике','HH','300 000 ₸'), 800);
    go('sam','move',{id:office,cid:c1,to:'hr'},790); go('sam','move',{id:office,cid:c1,to:'mgr'},770);
    go('gul','feedback',{id:office,cid:c1,verdict:'approve',comment:''},760);
    go('sam','offer',{id:office,cid:c1,salary:'280 000 ₸',start:day(-14)},750); go('sam','accepted',{id:office,cid:c1,start:day(-14)},740);
    let oh = S.requests.find(r => r.id === office).hires[0];
    checkAll(office, oh, 'prep', 400, 'sam'); go('sam','started',{id:office,hid:oh.id},14*24); checkAll(office, oh, 'day1', 14*24 - 2, 'sam');
    go('gul','decide',{id:office,hid:oh.id,verdict:'hire',comment:'Всё хорошо.'},11*24);
    checkAll(office, oh, 'docs', 3*24, 'sam'); go('sam','registered',{id:office,hid:oh.id},20);

    const analyst = approve('analyst', 1000, 6, {hrAt:990, finAt:960, ceoAt:950, rec:'sam', deadline:day(-2), assignAt:945, takeAt:940, pubAt:936});
    c1 = addC(analyst, 'sam', C('Ильяс Кенжебаев','Аналитик в банке','LinkedIn','700 000 ₸'), 900);
    go('sam','move',{id:analyst,cid:c1,to:'hr'},880); go('sam','move',{id:analyst,cid:c1,to:'test'},860); go('sam','move',{id:analyst,cid:c1,to:'mgr'},800);
    go('erl','feedback',{id:analyst,cid:c1,verdict:'approve',comment:'Сильное тестовое.'},790);
    go('sam','offer',{id:analyst,cid:c1,salary:'650 000 ₸',start:day(-12)},780); go('sam','accepted',{id:analyst,cid:c1,start:day(-12)},770);
    let ah = S.requests.find(r => r.id === analyst).hires[0];
    checkAll(analyst, ah, 'prep', 300, 'sam'); go('sam','started',{id:analyst,hid:ah.id},12*24); checkAll(analyst, ah, 'day1', 12*24 - 3, 'sam');
    go('erl','decide',{id:analyst,hid:ah.id,verdict:'hire',comment:'Берём.'},9*24);
    checkSome(analyst, ah, 'docs', 5, 30, 'sam');

    /* выход */
    const producer = approve('producer', 700, 6, {hrAt:690, finAt:670, ceoAt:660, rec:'ali', deadline:day(-1), assignAt:655, takeAt:650, pubAt:648, pub2:640});
    c1 = addC(producer, 'ali', C('Аружан Тулегенова','Продюсер в агентстве','Рекомендации','750 000 ₸'), 600);
    const c2 = addC(producer, 'ali', C('Сергей Волков','Линейный продюсер','HH','800 000 ₸'), 590);
    go('ali','move',{id:producer,cid:c1,to:'hr'},580); go('ali','move',{id:producer,cid:c1,to:'mgr'},560);
    go('ali','reject',{id:producer,cid:c2,reason:'Зарплатные ожидания',comment:'Ожидания выше вилки на 15%.'},570);
    go('dan','feedback',{id:producer,cid:c1,verdict:'approve',comment:'Опыт подходит.'},540);
    go('ali','offer',{id:producer,cid:c1,salary:'700 000 ₸',start:t(50)},500); go('ali','accepted',{id:producer,cid:c1,start:t(50)},480);
    let ph = S.requests.find(r => r.id === producer).hires[0];
    checkAll(producer, ph, 'prep', 70, 'ali'); go('ali','started',{id:producer,hid:ph.id},50); checkSome(producer, ph, 'day1', 10, 46, 'ali');

    const copy = approve('copy', 500, 6, {hrAt:490, finAt:470, ceoAt:460, rec:'ali', deadline:day(5), assignAt:455, takeAt:452, pubAt:450});
    c1 = addC(copy, 'ali', C('Динара Оразбаева','Редактор в медиа','Telegram','320 000 ₸'), 400);
    const c3 = addC(copy, 'ali', C('Максат Нургалиев','Копирайтер, фриланс','HH','350 000 ₸'), 395);
    go('ali','move',{id:copy,cid:c1,to:'hr'},380); go('ali','move',{id:copy,cid:c1,to:'test'},370); go('ali','move',{id:copy,cid:c1,to:'mgr'},300);
    go('ali','move',{id:copy,cid:c3,to:'hr'},378); go('ali','reject',{id:copy,cid:c3,reason:'Не прошёл интервью',comment:''},360);
    go('mad','feedback',{id:copy,cid:c1,verdict:'approve',comment:'Тексты живые, берём.'},280);
    go('ali','offer',{id:copy,cid:c1,salary:'320 000 ₸',start:day(2)},100); go('ali','accepted',{id:copy,cid:c1,start:day(2)},60);
    let ch = S.requests.find(r => r.id === copy).hires[0];
    checkSome(copy, ch, 'prep', 9, 30, 'ali');

    /* подбор */
    const operator = approve('operator', 400, 6, {hrAt:390, finAt:380, ceoAt:370, rec:'ali', deadline:day(12), assignAt:365, takeAt:360, pubAt:358, pub2:350});
    const o1 = addC(operator, 'ali', C('Руслан Ибраев','Оператор на ТВ','HH','650 000 ₸'), 300);
    const o2 = addC(operator, 'ali', C('Елена Пак','Оператор, фриланс','Instagram','600 000 ₸'), 280);
    const o3 = addC(operator, 'ali', C('Бауыржан Сейткали','Ассистент оператора','HH','450 000 ₸'), 120);
    const o4 = addC(operator, 'ali', C('Ксения Ли','Оператор в продакшне','Рекомендации','620 000 ₸'), 20);
    go('ali','move',{id:operator,cid:o1,to:'hr'},270); go('ali','move',{id:operator,cid:o1,to:'mgr'},250);
    go('dan','feedback',{id:operator,cid:o1,verdict:'approve',comment:'Сильный шоурил.'},240);
    go('ali','offer',{id:operator,cid:o1,salary:'600 000 ₸',start:day(3)},200); go('ali','accepted',{id:operator,cid:o1,start:day(3)},180);
    go('ali','move',{id:operator,cid:o2,to:'hr'},260); go('ali','reject',{id:operator,cid:o2,reason:'Отказался сам',comment:'Ушла на другой проект.'},230);
    go('ali','move',{id:operator,cid:o3,to:'hr'},100); go('ali','reject',{id:operator,cid:o3,reason:'Не подходит по опыту',comment:''},90);
    go('ali','move',{id:operator,cid:o4,to:'hr',when:'вт 11:00'},6);
    let oph = S.requests.find(r => r.id === operator).hires[0];
    checkSome(operator, oph, 'prep', 4, 100, 'ali');

    const motion = approve('motion', 260, 6, {hrAt:250, finAt:240, ceoAt:230, rec:'ali', deadline:day(6), assignAt:226, takeAt:224, pubAt:220, pub2:210});
    const m = [
      ['Камила Абдрахманова','Моушн-дизайнер в студии','HH','600 000 ₸', 190, ['hr',170,'test',150,'mgr',30]],
      ['Арсен Туяков','Моушн-дизайнер, фриланс','Telegram','500 000 ₸', 180, ['hr',160,'mgr',6]],
      ['Асем Касенова','Дизайнер-аниматор','Instagram','450 000 ₸', 140, ['hr',100,'test',70]],
      ['Алихан Жаксылыков','3D-аниматор','HH','700 000 ₸', 90, ['hr',30]],
      ['Мария Ким','Моушн-дизайнер в агентстве','LinkedIn','550 000 ₸', 60, ['hr',20]],
      ['Нурлан Абенов','Junior моушн-дизайнер','HH','350 000 ₸', 12, []],
      ['Айым Сарсенова','Графический дизайнер','Telegram','400 000 ₸', 8, []],
      ['Дмитрий Ан','Видеомонтажёр','HH','450 000 ₸', 3, []],
      ['Гаухар Бейсенова','Моушн-дизайнер','Рекомендации','520 000 ₸', 150, ['hr',130,'reject',120]]
    ];
    m.forEach(([n, pos, src, exp, h, path]) => {
      const cid = addC(motion, 'ali', C(n, pos, src, exp, {experience:'3 года', comment:'', resume:'https://hh.kz/resume/' + translit(n).slice(0,8)}), h);
      for(let i = 0; i < path.length; i += 2){
        if(path[i] === 'reject') go('ali','reject',{id:motion,cid,reason:'Не прошёл интервью',comment:'Слабое портфолио по моушну.'},path[i+1]);
        else go('ali','move',{id:motion,cid,to:path[i],when:path[i] === 'hr' ? '' : ''},path[i+1]);
      }
    });

    const front = approve('front', 160, 4, {hrAt:150, finAt:120, ceoAt:96, rec:'sam', deadline:day(30), assignAt:40, fin:'В пределах годового плана по ФОТ разработки.'});
    void front;
    approve('designer', 80, 3, {hrAt:70, finAt:40, ceoAt:5});

    /* согласование */
    const sales = go('ase', 'create', {fields:F.sales, send:true}, 30);
    go(HRD, 'hrReturn', {id:sales, comment:'Уточните вилку: в заявке оклад без бонусов, а позиция под план продаж. Добавьте KPI и бонусную часть.'}, 20);
    approve('montage', 70, 2, {hrAt:52, finAt:26, fin:'В бюджете продакшна на IV квартал.'});
    approve('smm', 60, 1, {hrAt:50, hr:'Срочная замена, прошу посмотреть в приоритете.'});
    approve('support', 3, 0, {});
    go('dan', 'create', {fields:F.sound, send:false}, 5);

    return S;

    function checkAll(id, h, list, at, by){ h.lists[list].forEach((it, i) => { if(!it.done) go(it.who === 'it' ? IT : it.who === 'manager' ? S.requests.find(r => r.id === id).manager : by, 'check', {id, hid:h.id, list, i, done:true}, at - i * .2); }); }
    function checkSome(id, h, list, n, at, by){ h.lists[list].slice(0, n).forEach((it, i) => go(it.who === 'it' ? IT : it.who === 'manager' ? S.requests.find(r => r.id === id).manager : by, 'check', {id, hid:h.id, list, i, done:true}, at - i * .3)); }
  }
  function phone(n){ let x = 0; for(const ch of n) x = (x * 31 + ch.charCodeAt(0)) % 9999991; const d = String(1000000 + x % 8999999); return '+7 70' + (x % 8) + ' ' + d.slice(0,3) + ' ' + d.slice(3,5) + ' ' + d.slice(5,7); }
  function translit(s){
    const m = {а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'i',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sh',ы:'y',э:'e',ю:'yu',я:'ya',ь:'',ъ:'',ә:'a',ғ:'g',қ:'k',ң:'n',ө:'o',ұ:'u',ү:'u',һ:'h',і:'i'};
    return s.toLowerCase().split('').map(ch => m[ch] ?? ch).join('').replace(/[^a-z0-9]/g, '');
  }

  return {H, D, ROLE, PEOPLE, HRD, FIN, CEO, IT, RECRUITERS, SLA, DEPTS, REASONS, FORMATS, EMPLOYMENT, PRIORITY, PLATFORMS, SOURCES, REJECT, CANCEL,
    STAGES, stageGroup, LISTS, listLeft, COLUMNS, phase, progress, statusText, turns, late, mineTurn, visible, perms, canCheck, WHO,
    activeHires, openHires, act, seed, plural, fmtDate, fmtTime, fmtDateTime, ago, short, days};
})();

/* Хранилище: состояние в браузере, подписка экранов на изменения. */
const Store = (function(){
  const KEY = 'hr-funnel-v1', VKEY = 'hr-funnel-viewer';
  let state = null, viewer = 'dan', subs = new Set(), ver = 0, kind = 'init';
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if(s && s.v === 1) state = s; } catch(e) {}
  if(!state) state = Model.seed(Date.now());
  try { const v = localStorage.getItem(VKEY); if(v && Model.PEOPLE[v]) viewer = v; } catch(e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch(e) {} };
  const emit = k => { kind = k; ver++; subs.forEach(f => f()); };
  return {
    get: () => state, viewer: () => viewer, version: () => ver, kind: () => kind,
    subscribe(f){ subs.add(f); return () => subs.delete(f); },
    setViewer(v){ viewer = v; try { localStorage.setItem(VKEY, v); } catch(e) {} emit('viewer'); },
    dispatch(type, p){ const out = Model.act(state, viewer, type, p); save(); emit('act'); return out; },
    reset(){ state = Model.seed(Date.now()); save(); emit('reset'); }
  };
})();
