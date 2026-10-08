/* Модель воронки найма: люди, роли, заявка и всё, что с ней происходит.

   Заявка идёт по одному пути. Каждый шаг делает конкретный человек, и следующий шаг
   открывается только после предыдущего (п. 27 ТЗ). Все действия проходят через act():
   оно меняет заявку и пишет запись в историю — кто, когда, что, с каким комментарием.
   Демонстрационные данные собраны теми же действиями, поэтому история у них настоящая.

   Модель не знает, где лежат данные: хранит их Store (js/store.js) — в браузере или на сервере.
   Сервер сайта выполняет эту же модель: check() решает, можно ли человеку действие, act() его делает.
   Поэтому здесь нет ни DOM, ни localStorage. */
'use strict';

const Model = (function(){
  const H = 3600e3, D = 24 * H;

  /* former — человек есть в истории, но роли в воронке у него больше нет */
  const ROLE = {manager:'Руководитель', hrd:'HRD', recruiter:'Рекрутер', finance:'Finance', ceo:'CEO', former:'Не в воронке'};

  const PEOPLE = {
    dan:{name:'Данияр Ахметов', role:'manager', dept:'Продакшн'},
    mad:{name:'Мадина Касымова', role:'manager', dept:'Маркетинг', f:1},
    ase:{name:'Асель Жумабаева', role:'manager', dept:'Продажи', f:1},
    erl:{name:'Ерлан Мусин', role:'manager', dept:'Разработка'},
    gul:{name:'Гульнара Исаева', role:'hrd', f:1},
    ali:{name:'Алия Нурланова', role:'recruiter', f:1},
    sam:{name:'Самат Беков', role:'recruiter'},
    rin:{name:'Ринат Оспанов', role:'finance'},
    arm:{name:'Арман Тлеубаев', role:'ceo'}
  };
  let HRD = 'gul', FIN = 'rin', CEO = 'arm';
  const RECRUITERS = ['ali','sam'];

  /* люди с сервера вместо демонстрационных. HRD, Finance и CEO — первые с этой ролью:
     шаги «ждёт HR» и «ждёт Finance» адресованы одному человеку */
  function configure(people){
    Object.keys(PEOPLE).forEach(k => { delete PEOPLE[k]; });
    Object.assign(PEOPLE, people);
    const ids = role => Object.keys(PEOPLE).filter(id => PEOPLE[id].role === role);
    HRD = ids('hrd')[0] || null; FIN = ids('finance')[0] || null; CEO = ids('ceo')[0] || null;
    RECRUITERS.splice(0, RECRUITERS.length, ...ids('recruiter'));
  }

  /* сколько шаг может ждать, пока не станет просроченным; потом настраивает администратор */
  const SLA = {hr:D, returned:2*D, finance:D, ceo:D, assign:D, assigned:D, inwork:2*D, feedback:D, call:D, invite:D, interview:2*D, terms:D, hrok:D, offer:D, answer:2*D, fin:D, fot:2*D};

  const DEPTS = ['Продакшн','Маркетинг','Продажи','Разработка','Финансы','Администрация'];
  const REASONS = {new:'Новая позиция', replace:'Замена сотрудника', grow:'Расширение команды', other:'Другое'};
  const FORMATS = ['Офис','Гибрид','Удалённо'];
  const EMPLOYMENT = ['Полная занятость','Частичная занятость','Проектная работа'];
  const PRIORITY = {normal:'Обычный', high:'Срочно'};
  const PLATFORMS = ['HH','Telegram','Instagram','LinkedIn','Рекомендации','Другое'];
  const SOURCES = PLATFORMS;
  const REJECT = ['Не подходит по опыту','Не прошёл интервью','Не сдал тестовое','Зарплатные ожидания','Отказался сам','Другое'];
  const CANCEL = ['Позиция больше не требуется','Нашли внутри компании','Другое'];

  /* этапы кандидата (п. 12): «Одобрен» — решение руководителя. Тестового этапа нет (решение пользователя):
     кнопка ничего не меняла, тестовое — часть интервью.
     Оффер — после стажировки (решение пользователя): до неё кандидат узнаёт условия и соглашается
     выйти на стажировку, а оффер получает, когда руководитель решил «Нанимаем» */
  const STAGES = [
    {id:'hr', name:'Интервью HR'},
    {id:'mgr', name:'Руководитель'},
    {id:'terms', name:'Условия'}
  ];
  const stageGroup = s => s === 'approved' ? 'terms' : s;

  /* чек-листы (пп. 14, 15, 17, 18); who — кто отмечает пункт */
  const LISTS = {
    prep:{name:'Подготовка к выходу', items:[
      ['Отправить onboarding-презентацию','recruiter'],['Отправить список документов','recruiter'],['Запросить фото','recruiter'],
      ['Запросить удостоверение личности','recruiter'],['Подготовить NDA','recruiter'],['Сформировать личное дело','recruiter'],
      ['Подготовить приветствие на экране','recruiter'],['Подготовить рабочее место','recruiter'],['Подготовить технику','recruiter'],
      ['Создать корпоративную почту','recruiter','opt'],['Дать доступы к рабочим системам','recruiter'],['Дать доступ к общим дискам','recruiter'],
      ['Установить нужные программы','recruiter']]},
    day1:{name:'Первый рабочий день', items:[
      ['Приветствие на экране к 10:00','recruiter'],['Приветствие в рабочем чате','recruiter'],['Встретить на ресепшн','recruiter'],
      ['Познакомить с HR и руководителем отдела','recruiter'],['Назначен наставник','recruiter'],['Представить команде','manager'],
      ['Познакомить с непосредственным руководителем','manager'],['Провести IT-брифинг','recruiter'],['Проверить технику','recruiter'],['Проверить доступы','recruiter']]},
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
    {id:'hire', name:'Оформление', steps:['HR','Оффер','Документы','ФОТ']},
    {id:'closed', name:'Закрыто', steps:[]}
  ];

  const activeHires = r => r.hires.filter(h => h.stage !== 'dropped');
  const openHires = r => activeHires(r).filter(h => h.stage !== 'done');
  const HIRE_PHASE = {prep:'start', intern:'start', hrok:'hire', offer:'hire', offered:'hire', docs:'hire', fin:'hire', fot:'hire'};

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
    return {n:4, at:{hrok:0, offer:1, offered:1, docs:2, fin:3, fot:3}[h.stage]};
  }

  /* ---------- статус словами (п. 5) ---------- */
  function statusText(r){
    const s = {draft:'Черновик', hr:'На проверке HR', returned:'Возвращено на доработку', finance:'На согласовании Finance',
      ceo:'На согласовании CEO', assign:'Поиск разрешён', assigned:'Назначен рекрутер', inwork:'В работе',
      closed:'Закрыто', rejected:'Отклонено', cancelled:'Отменено'}[r.status];
    if(s) return s;
    const o = openHires(r);
    if(activeHires(r).length < r.seats || !o.length) return r.candidates.length ? 'В подборе' : 'Вакансия опубликована';
    return {prep:'Кандидат выбран', intern:'Стажировка', hrok:'Подтверждение HR', offer:'Оффер', offered:'Оффер отправлен', docs:'Оформление', fin:'Передано в Finance', fot:'Передано в Finance'}[o[0].stage];
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
      /* интервью — у HRD, затем у руководителя (решение пользователя). Каждый сам назначает день и время,
         потом отмечает, что интервью прошло; только после этого кандидат идёт дальше */
      const n_ = n => n + ' ' + plural(n, 'кандидат','кандидата','кандидатов');
      const at = (k, st) => r.candidates.filter(c => ivStage(c) === k && ivState(c, k) === st);
      const hrAt = st => r.candidates.filter(c => ivStage(c) === 'hr' && hrStep(c) === st);
      const since = (l, f) => Math.min(...l.map(f));
      const call = hrAt('call'), review = hrAt('review'), invite = hrAt('invite'), hrSet = hrAt('set'), hrDone = hrAt('done');
      if(call.length) t.push({p:r.recruiter, text:'Рекрутер созванивается с кандидатами', full:'Рекрутер созванивается: ' + n_(call.length),
        mine:'Созвониться и доложить HR: ' + n_(call.length), since:since(call, c => c.stageAt), sla:SLA.call, tab:'candidates'});
      if(review.length) t.push({p:HRD, text:'HR решает, звать ли на интервью', full:'HR решает, звать ли на интервью: ' + n_(review.length),
        mine:'Решить, звать ли на интервью: ' + n_(review.length), since:since(review, c => c.screen.at), sla:SLA.invite, tab:'candidates'});
      if(invite.length) t.push({p:r.recruiter, text:'Рекрутер назначает интервью HR', full:'Рекрутер назначает интервью HR: ' + n_(invite.length),
        mine:'Назначить интервью HR: ' + n_(invite.length), since:since(invite, c => c.invite.at), sla:SLA.invite, tab:'candidates'});
      if(hrSet.length) t.push({p:HRD, text:IV_NAME.hr, full:IV_NAME.hr + ': ' + n_(hrSet.length), mine:'Провести интервью: ' + n_(hrSet.length),
        due:since(hrSet, c => c.iv.hr.when), dueKind:'at', ongoing:true, tab:'candidates'});
      if(hrDone.length) t.push({p:HRD, text:'Интервью HR пройдено', full:'Интервью HR пройдено: ' + n_(hrDone.length) + ', ждут передачи руководителю',
        mine:'Отправить руководителю: ' + n_(hrDone.length), since:since(hrDone, c => c.iv.hr.done.at), sla:SLA.feedback, tab:'candidates'});
      /* интервью с руководителем: он сам назначает, проводит и решает */
      const mNone = at('mgr', 'none'), mSet = at('mgr', 'set'), mDone = at('mgr', 'done'), p = r.manager;
      if(mNone.length) t.push({p, text:'Руководитель назначает интервью', full:'Руководитель назначает интервью: ' + n_(mNone.length),
        mine:'Назначить интервью: ' + n_(mNone.length), since:since(mNone, c => c.stageAt), sla:SLA.interview, tab:'candidates'});
      if(mSet.length) t.push({p, text:IV_NAME.mgr, full:IV_NAME.mgr + ': ' + n_(mSet.length), mine:'Провести интервью: ' + n_(mSet.length),
        due:since(mSet, c => c.iv.mgr.when), dueKind:'at', ongoing:true, tab:'candidates'});
      if(mDone.length) t.push({p, text:'Ждёт ответа руководителя', full:'Ждёт ответа руководителя по ' + mDone.length + ' ' + plural(mDone.length, 'кандидату','кандидатам','кандидатам'),
        mine:'Ответить по ' + mDone.length + ' ' + plural(mDone.length, 'кандидату','кандидатам','кандидатам'), since:since(mDone, c => c.iv.mgr.done.at), sla:SLA.feedback, tab:'candidates'});
      const approved = r.candidates.filter(c => c.stage === 'approved');
      if(approved.length) t.push({p:r.recruiter, text:'Рекрутер предлагает стажировку', mine:'Предложить стажировку', since:Math.min(...approved.map(c => c.stageAt)), sla:SLA.terms, tab:'candidates'});
      if(!t.length) t.push({p:r.recruiter, text:'Идёт подбор', mine:'Идёт подбор', ongoing:true, passive:true, tab:'candidates'});
    }
    openHires(r).forEach(h => {
      const nm = short(h.name);
      if(h.stage === 'prep'){
        const l = h.lists.prep, left = listLeft(l);
        t.push({p:r.recruiter, h:h.id, hn:nm, text:left ? 'Готовим выход' : 'Выход подготовлен', mine:left ? 'Подготовить выход' : 'Отметить выход на стажировку', due:h.start, dueKind:'выход', ongoing:left > 0,
          count:[l.length - l.filter(i => !i.done).length, l.length]});
      }
      if(h.stage === 'intern') t.push({p:r.manager, h:h.id, hn:nm, text:'Решение по стажировке', mine:'Решить по стажировке', due:h.decideBy, dueKind:'до'});
      if(h.stage === 'hrok') t.push({p:HRD, h:h.id, hn:nm, text:'HR подтверждает найм', mine:'Подтвердить найм', since:h.stageAt, sla:SLA.hrok});
      if(h.stage === 'offer') t.push({p:r.recruiter, h:h.id, hn:nm, text:'Рекрутер готовит оффер', mine:'Отправить оффер', since:h.stageAt, sla:SLA.offer});
      if(h.stage === 'offered') t.push({p:r.recruiter, h:h.id, hn:nm, text:'Ждём ответа на оффер', mine:'Отметить ответ на оффер', since:h.stageAt, sla:SLA.answer});
      if(h.stage === 'docs'){
        const l = h.lists.docs;
        t.push({p:r.recruiter, h:h.id, hn:nm, text:'Оформляем', mine:'Оформить сотрудника', since:h.stageAt, ongoing:listLeft(l) > 0,
          count:[l.filter(i => i.done).length, l.length]});
      }
      if(h.stage === 'fot') t.push({p:FIN, h:h.id, hn:nm, text:'Finance учитывает в ФОТ', mine:'Учесть в ФОТ', since:h.stageAt, sla:SLA.fot});
    });
    return t;
  }
  /* интервью кандидата: на каком он (hr / mgr) и в каком состоянии — не назначено, назначено, проведено */
  const IV_NAME = {hr:'Интервью HR', mgr:'Интервью с руководителем'};
  const ivStage = c => ['hr','new','test'].includes(c.stage) ? 'hr' : c.stage === 'mgr' ? 'mgr' : null;
  /* до интервью HR: рекрутер звонит и докладывает, HR решает, звать ли, рекрутер назначает дату (решение пользователя) */
  const hrStep = c => !c.screen ? 'call' : !c.invite ? 'review' : ivState(c, 'hr') === 'none' ? 'invite' : ivState(c, 'hr');
  /* результат тестового прикладывают от добавления кандидата до выхода на стажировку */
  const TEST_KINDS = ['Тестовое задание', 'Результат тестового'];
  const testFiles = c => (c.files || []).filter(f => TEST_KINDS.includes(f.kind));
  const canAttach = (r, c) => { if(['hr','new','test','mgr','approved'].includes(c.stage)) return true;
    const h = c.stage === 'accepted' && r.hires.find(x => x.cid === c.id); return !!h && h.stage === 'prep'; };
  const ivState = (c, k) => { const x = (c.iv || {})[k]; return !x ? 'none' : x.done ? 'done' : 'set'; };

  /* чего сейчас ждёт кандидат и от кого — пишем в карточке и окне кандидата, чтобы было понятно, почему он стоит */
  function candNow(r, c){
    const k = ivStage(c);
    if(k === 'hr') return {
      call:{text:'Ждёт звонка рекрутера', p:r.recruiter},
      review:{text:'Рекрутер доложил, HR решает, звать ли на интервью', p:HRD},
      invite:{text:'HR зовёт на интервью, рекрутер назначает дату', p:r.recruiter},
      set:{text:IV_NAME.hr, p:HRD, when:c.iv && c.iv.hr && c.iv.hr.when},
      done:{text:'Интервью HR пройдено, ждёт передачи руководителю', p:HRD}
    }[hrStep(c)];
    if(k === 'mgr'){
      const st = ivState(c, 'mgr'), p = r.manager;
      if(st === 'none') return {text:'Ждёт, когда руководитель назначит интервью', p};
      if(st === 'set') return {text:IV_NAME.mgr, p, when:c.iv.mgr.when};
      return {text:'Интервью пройдено, ждёт решения руководителя', p};
    }
    if(c.stage === 'approved') return {text:'Одобрен, рекрутер предлагает стажировку', p:r.recruiter};
    if(c.stage !== 'accepted') return null;
    const h = r.hires.find(x => x.cid === c.id);
    if(!h) return null;
    return {
      prep:{text:'Готовится к выходу на стажировку', p:r.recruiter, when:h.start, day:true},
      intern:{text:'На стажировке, ждёт решения руководителя', p:r.manager, when:h.decideBy, day:true, until:true},
      hrok:{text:'Руководитель решил нанять, ждёт подтверждения HR', p:HRD},
      offer:{text:'Стажировку прошёл, рекрутер готовит оффер', p:r.recruiter},
      offered:{text:'Оффер отправлен, ждём ответа кандидата', p:r.recruiter},
      docs:{text:'Принял оффер, идёт оформление', p:r.recruiter},
      fin:{text:'Оформлен, Finance учитывает в ФОТ', p:FIN},
      fot:{text:'Оформлен, Finance учитывает в ФОТ', p:FIN}
    }[h.stage] || null;
  }
  const isRange = s => /\d\s*[-–—]\s*\d|(^|\s)(от|до)\s/i.test(s || '');
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
    return false;
  }
  function perms(r, v){
    const role = PEOPLE[v].role, own = r.manager === v || r.initiator === v;
    return {
      salary: own || ['hrd','recruiter','finance','ceo'].includes(role),
      candidates: own || role === 'hrd' || role === 'recruiter',
      request: true,
      history: true,
      editCandidates: role === 'hrd' || (role === 'recruiter' && r.recruiter === v),
      cancel: (own || role === 'hrd') && !['closed','rejected','cancelled'].includes(r.status)
    };
  }
  /* может ли человек отметить пункт чек-листа —
     только сам исполнитель: HRD видит все части, но за других не отмечает */
  function canCheck(item, r, v){
    const w = item.who.split(' ');
    if(w.includes('recruiter') && r.recruiter === v) return true;
    if(w.includes('manager') && r.manager === v) return true;
    if(w.includes('mentor') && (r.manager === v || r.recruiter === v)) return true;
    return false;
  }
  /* поля заявки — для замечаний при возврате на доработку */
  const FIELD_NAMES = {title:'Должность', project:'Проект', dept:'Отдел', manager:'Руководитель', seats:'Сколько человек', reason:'Причина',
    duties:'Обязанности', reqs:'Требования', experience:'Опыт', skills:'Навыки', personal:'Личные качества', education:'Образование', extra:'Дополнительные требования',
    salary:'Зарплата', bonus:'Бонусы / KPI', format:'Формат работы', location:'Локация', schedule:'График', employment:'Тип занятости', probation:'Испытательный срок',
    start:'Желаемая дата выхода', priority:'Приоритет', comment:'Комментарий для HR', files:'Файлы'};
  const retText = p => [p.comment, ...Object.entries(p.notes || {}).map(([k, t]) => FIELD_NAMES[k] + ': ' + t)].filter(Boolean).join('\n');
  const WHO = {recruiter:'Рекрутер', manager:'Руководитель', mentor:'Наставник'};

  /* ---------- действия ---------- */
  let seq = 1;
  const uid = p => p + (Date.now() % 1e7).toString(36) + (seq++).toString(36);
  /* id новой заявки, кандидата и сотрудника задаёт тот, кто действие начал (p.newId): экран показывает
     запись сразу, а сервер, повторив действие, получает ту же запись под тем же id */
  const NEW_ID = {create:'r', addCandidate:'c', accepted:'h'};
  const newId = type => { const b = new Uint8Array(9); crypto.getRandomValues(b); return NEW_ID[type] + Array.from(b, x => (x % 36).toString(36)).join(''); };
  const takenId = (S, id) => S.requests.some(r => r.id === id || r.candidates.some(c => c.id === id) || r.hires.some(h => h.id === id));

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
      const r = {id:p.newId || uid('r'), initiator:by, created:at, updated:at, status:'draft', statusAt:at, log:[], candidates:[], hires:[],
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
    hrReturn(S, by, at, p){ const r = find(S, p.id); status(r, 'returned', at); r.returned = {by, at, comment:p.comment, notes:p.notes || {}}; log(r, by, at, 'Вернул на доработку', retText(p), 'return'); },
    finApprove(S, by, at, p){ const r = find(S, p.id); status(r, 'ceo', at); r.reached.ceo = at; log(r, by, at, 'Согласовал', p.comment, 'finance'); },
    finReturn(S, by, at, p){ const r = find(S, p.id); status(r, 'returned', at); r.returned = {by, at, comment:p.comment, notes:p.notes || {}}; log(r, by, at, 'Вернул на доработку', retText(p), 'return'); },
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
      const c = {id:p.newId || uid('c'), name:f.name, phone:f.phone || '', tg:f.tg || '', email:f.email || '', resume:f.resume || '',
        source:f.source || '', expect:f.expect || '', position:f.position || '', experience:f.experience || '', comment:f.comment || '',
        files:f.files || [], stage:'hr', stageAt:at, added:at, iv:{}, timeline:[], feedback:[], reject:null};
      r.candidates.push(c);
      ctl(c, at, by, 'Кандидат добавлен');
      log(r, by, at, 'Добавил кандидата: ' + c.name, '', 'cand');
      return c.id;
    },
    /* рекрутер созвонился с кандидатом и доложил HR */
    screened(S, by, at, p){
      const r = find(S, p.id), c = cand(r, p.cid);
      c.screen = {at, by, text:p.text};
      ctl(c, at, by, 'Рекрутер созвонился и доложил HR');
      log(r, by, at, c.name + ': созвонился и доложил HR', p.text, 'cand');
    },
    /* HR решила звать на интервью — дату назначает рекрутер */
    invite(S, by, at, p){
      const r = find(S, p.id), c = cand(r, p.cid);
      c.invite = {at, by, comment:p.comment || ''};
      ctl(c, at, by, 'HR: пригласить на интервью');
      log(r, by, at, c.name + ': пригласить на интервью HR', p.comment, 'cand');
    },
    /* рекрутер (интервью HR) или руководитель (своё) назначает или переносит интервью */
    schedule(S, by, at, p){
      const r = find(S, p.id), c = cand(r, p.cid);
      c.iv = c.iv || {};
      const was = c.iv[p.kind];
      c.iv[p.kind] = {when:p.when, by, set:at, done:null};
      const text = IV_NAME[p.kind] + (was ? ' перенесено на ' : ' назначено на ') + fmtDateTime(p.when);
      ctl(c, at, by, text);
      log(r, by, at, c.name + ': ' + lower1(text), '', 'cand');
    },
    interviewed(S, by, at, p){
      const r = find(S, p.id), c = cand(r, p.cid);
      c.iv[p.kind].done = {at, by};
      const text = IV_NAME[p.kind] + ' проведено';
      ctl(c, at, by, text);
      log(r, by, at, c.name + ': ' + lower1(text), '', 'cand');
    },
    move(S, by, at, p){
      const r = find(S, p.id), c = cand(r, p.cid), name = STAGES.find(s => s.id === p.to).name;
      if(c.stage === p.to) return;
      c.stage = p.to; c.stageAt = at;
      const text = {hr:'Приглашён на интервью HR', mgr:'Передан руководителю'}[p.to] || ('Этап: ' + name);
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
    /* кандидат узнал условия и согласился выйти на стажировку: дальше его путь — сотрудник (hire) */
    accepted(S, by, at, p){
      const r = find(S, p.id), c = cand(r, p.cid);
      c.stage = 'accepted'; c.stageAt = at;
      const h = {id:p.newId || uid('h'), cid:c.id, name:c.name, start:p.start, stage:'prep', stageAt:at, chosen:at, decideBy:null, decision:null,
        lists:{prep:makeList('prep')}, offerAt:null, hiredAt:null, finAccepted:null, fotAt:null, dropFrom:null, salary:p.salary || r.salary};
      r.hires.push(h);
      ctl(c, at, by, 'Согласился на стажировку, выход ' + fmtDate(p.start) + (p.salary ? ', оклад ' + p.salary : ''));
      log(r, by, at, c.name + ' согласился на стажировку, выход ' + fmtDate(p.start), '', 'accepted');
    },
    /* после «Нанимаем» HR подтверждает найм — только потом оффер (решение пользователя) */
    hrConfirm(S, by, at, p){
      const r = find(S, p.id), h = hire(r, p.hid), c = cand(r, h.cid);
      if(p.yes){ h.stage = 'offer'; h.stageAt = at; ctl(c, at, by, 'HR подтвердил найм'); log(r, by, at, 'Подтвердил найм: ' + h.name, p.comment, 'hrok'); return; }
      h.stage = 'dropped'; h.stageAt = at; h.dropFrom = 'hrok';
      c.stage = 'rejected'; c.reject = {at, by, from:'hrok', reason:'HR не подтвердил найм', comment:p.comment || ''};
      ctl(c, at, by, 'HR не подтвердил найм'); log(r, by, at, 'Не подтвердил найм: ' + h.name, p.comment, 'declined');
    },
    /* оффер: итоговый оклад, на который согласились, — его получит Finance */
    offer(S, by, at, p){
      const r = find(S, p.id), h = hire(r, p.hid);
      h.stage = 'offered'; h.stageAt = at; h.offerAt = at; h.salary = p.salary || h.salary;
      ctl(cand(r, h.cid), at, by, 'Отправлен оффер, оклад ' + h.salary);
      log(r, by, at, 'Отправил оффер: ' + h.name + ', оклад ' + h.salary, '', 'offer');
    },
    offerAccepted(S, by, at, p){
      const r = find(S, p.id), h = hire(r, p.hid);
      h.stage = 'docs'; h.stageAt = at; h.lists.docs = makeList('docs');
      ctl(cand(r, h.cid), at, by, 'Принял оффер');
      log(r, by, at, h.name + ' принял оффер', '', 'offerok');
    },
    offerDeclined(S, by, at, p){
      const r = find(S, p.id), h = hire(r, p.hid), c = cand(r, h.cid);
      h.stage = 'dropped'; h.stageAt = at; h.dropFrom = 'offer';
      c.stage = 'rejected'; c.reject = {at, by, from:'offer', reason:'Отказался от оффера', comment:p.comment || ''};
      ctl(c, at, by, 'Отказался от оффера');
      log(r, by, at, h.name + ' отказался от оффера', p.comment, 'declined');
    },
    /* исполнитель отмечает оставшиеся пункты своей части разом: «Отметить все» */
    checkGroup(S, by, at, p){
      const r = find(S, p.id), h = hire(r, p.hid);
      h.lists[p.list].forEach(it => { if(it.who === p.who && (!p.done || !it.done)) it.done = p.done ? {at, by} : null; });
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
      if(p.verdict === 'hire'){ h.stage = 'hrok'; h.stageAt = at; ctl(c, at, by, 'Решение по стажировке: нанимаем'); log(r, by, at, 'Решение по стажировке: нанимаем ' + h.name, p.comment, 'decide'); }
      if(p.verdict === 'drop'){ h.stage = 'dropped'; h.stageAt = at; h.dropFrom = 'intern'; c.stage = 'rejected'; c.reject = {at, by, from:'intern', reason:'Отказ после стажировки', comment:p.comment}; ctl(c, at, by, 'Отказ после стажировки'); log(r, by, at, 'Не продолжаем с ' + h.name + ' после стажировки', p.comment, 'decide'); }
      if(p.verdict === 'extend'){ h.decideBy = p.until; ctl(c, at, by, 'Стажировка продлена до ' + fmtDate(p.until)); log(r, by, at, 'Продлил стажировку ' + h.name + ' до ' + fmtDate(p.until), p.comment, 'decide'); }
    },
    registered(S, by, at, p){
      const r = find(S, p.id), h = hire(r, p.hid);
      h.stage = 'fot'; h.stageAt = at; h.hiredAt = at; h.lists.onboarding = makeList('onboarding');
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

  /* ---------- кто что может ----------
     Те же условия, при которых экраны показывают кнопку. Сервер проверяет каждое действие этим же
     кодом, поэтому правило меняется в одном месте. null — можно, иначе — почему нельзя. */
  const text = x => typeof x === 'string' && x.trim() !== '';
  const isTime = x => typeof x === 'number' && isFinite(x);
  /* ссылки из полей попадают в href: только http(s), иначе javascript: выполнился бы у того, кто нажмёт */
  const webLink = x => !x || /^https?:\/\/[^\s]+$/i.test(x);
  /* файл на сервере лежит по пути hr/<uuid>/<имя>, его выдаёт загрузка */
  const okFile = f => !!f && typeof f === 'object' && text(f.name) && (f.path == null || /^hr\/[0-9a-f-]{36}\/[^/]+$/.test(f.path));
  const okFields = (fl, send) => {
    if(!fl || typeof fl !== 'object') return 'Нет полей заявки';
    if(fl.files != null && (!Array.isArray(fl.files) || !fl.files.every(okFile))) return 'Файлы заявки повреждены';
    const m = PEOPLE[fl.manager];
    if((send || fl.manager) && !(m && (m.role === 'manager' || m.role === 'hrd'))) return 'Выберите руководителя';
    return null;
  };
  const liveCand = c => c.stage !== 'rejected' && c.stage !== 'accepted';
  const liveHire = h => h.stage !== 'dropped' && h.stage !== 'done';
  const editor = (r, v) => perms(r, v).editCandidates;
  const NEED_C = ['screened','invite','schedule','interviewed','move','addFiles','feedback','reject','accepted'];
  const NEED_H = ['hrConfirm','offer','offerAccepted','offerDeclined','check','checkGroup','started','decide','registered','fot'];
  const returnText = p => text(p.comment) || Object.values(p.notes || {}).some(text);
  const RULES = {
    update:({r, v, p}) => (r.initiator === v || r.manager === v) && ['draft','returned'].includes(r.status) ? okFields(p.fields, p.send) : 'Заявку сейчас нельзя изменить',
    hrAccept:({r, hrd}) => hrd && r.status === 'hr' ? null : 'Заявка не на проверке HR',
    hrReturn:({r, hrd, p}) => !(hrd && r.status === 'hr') ? 'Заявка не на проверке HR' : returnText(p) ? null : 'Напишите, что исправить',
    finApprove:({r, role}) => role === 'finance' && r.status === 'finance' ? null : 'Заявка не на согласовании Finance',
    finReturn:({r, role, p}) => !(role === 'finance' && r.status === 'finance') ? 'Заявка не на согласовании Finance' : returnText(p) ? null : 'Напишите, что исправить',
    finReject:({r, role, p}) => !(role === 'finance' && r.status === 'finance') ? 'Заявка не на согласовании Finance' : text(p.comment) ? null : 'Напишите причину',
    ceoApprove:({r, role}) => role === 'ceo' && r.status === 'ceo' ? null : 'Заявка не на решении CEO',
    ceoReject:({r, role, p}) => !(role === 'ceo' && r.status === 'ceo') ? 'Заявка не на решении CEO' : text(p.comment) ? null : 'Напишите причину',
    assign:({r, hrd, p}) => !(hrd && r.status === 'assign') ? 'Назначить рекрутера сейчас нельзя'
      : !(PEOPLE[p.recruiter] && PEOPLE[p.recruiter].role === 'recruiter') ? 'Выберите рекрутера' : null,
    /* ещё одна площадка после первой публикации — тоже можно (так собраны демо-заявки) */
    publish:({r, v, p}) => !(r.recruiter === v && ['assigned','inwork','published'].includes(r.status)) ? 'Опубликовать вакансию сейчас нельзя'
      : !text(p.platform) ? 'Укажите площадку' : !isTime(p.date) ? 'Укажите дату публикации' : !webLink(p.link) ? 'Ссылка должна начинаться с http:// или https://' : null,
    addCandidate:({r, v, p}) => !(editor(r, v) && r.status === 'published') ? 'Добавлять кандидатов сейчас нельзя'
      : !(p.fields && text(p.fields.name)) ? 'Укажите ФИО' : !webLink(p.fields.resume) ? 'Ссылка на резюме должна начинаться с http:// или https://'
      : p.fields.files != null && !(Array.isArray(p.fields.files) && p.fields.files.every(okFile)) ? 'Файлы кандидата повреждены' : null,
    screened:({r, c, v, p}) => !(r.recruiter === v && ivStage(c) === 'hr' && hrStep(c) === 'call') ? 'Доложить HR сейчас нельзя' : text(p.text) ? null : 'Напишите итоги звонка',
    invite:({c, hrd}) => hrd && ivStage(c) === 'hr' && hrStep(c) === 'review' ? null : 'Пригласить на интервью сейчас нельзя',
    schedule:({r, c, v, p}) => {
      if(!(p.kind === 'hr' || p.kind === 'mgr') || ivStage(c) !== p.kind) return 'Назначить интервью сейчас нельзя';
      if(!isTime(p.when)) return 'Укажите день и время интервью';
      if(p.kind === 'hr') return r.recruiter === v && ['invite','set'].includes(hrStep(c)) ? null : 'Интервью HR назначает рекрутер';
      return r.manager === v && ivState(c, 'mgr') !== 'done' ? null : 'Интервью назначает руководитель';
    },
    interviewed:({r, c, v, p, hrd}) => (p.kind === 'hr' ? hrd : p.kind === 'mgr' && r.manager === v) && ivStage(c) === p.kind && ivState(c, p.kind) === 'set' ? null : 'Отметить интервью сейчас нельзя',
    move:({c, hrd, p}) => hrd && p.to === 'mgr' && ivStage(c) === 'hr' && ivState(c, 'hr') === 'done' ? null : 'Передать руководителю сейчас нельзя',
    addFiles:({r, c, v, p}) => !(editor(r, v) && canAttach(r, c)) ? 'Прикладывать файлы сейчас нельзя'
      : Array.isArray(p.files) && p.files.length && p.files.every(okFile) ? null : 'Нет файлов',
    feedback:({r, c, v, p}) => !(r.manager === v && c.stage === 'mgr') ? 'Ответить по кандидату сейчас нельзя'
      : p.verdict === 'approve' ? (ivState(c, 'mgr') === 'done' ? null : 'Сначала проведите интервью')
      : p.verdict === 'reject' ? (text(p.comment) ? null : 'Напишите причину отказа') : 'Выберите решение',
    reject:({r, c, v, p}) => !(editor(r, v) && c.stage !== 'mgr') ? 'Отказать кандидату сейчас нельзя' : REJECT.includes(p.reason) ? null : 'Выберите причину отказа',
    accepted:({r, c, v, p}) => !(editor(r, v) && c.stage === 'approved') ? 'Отметить согласие сейчас нельзя' : p.start == null || isTime(p.start) ? null : 'Укажите дату выхода',
    hrConfirm:({h, hrd, p}) => !(hrd && h.stage === 'hrok') ? 'Подтвердить найм сейчас нельзя' : p.yes || text(p.comment) ? null : 'Напишите причину',
    offer:({r, h, v, p}) => !(r.recruiter === v && h.stage === 'offer') ? 'Отправить оффер сейчас нельзя' : text(p.salary) ? null : 'Укажите оклад, на который согласились',
    offerAccepted:({r, h, v}) => r.recruiter === v && h.stage === 'offered' ? null : 'Отметить ответ на оффер сейчас нельзя',
    offerDeclined:({r, h, v}) => r.recruiter === v && h.stage === 'offered' ? null : 'Отметить ответ на оффер сейчас нельзя',
    check:({r, h, v, p}) => { const it = h.lists[p.list] && h.lists[p.list][p.i];
      return !it ? 'Нет такого пункта' : liveHire(h) && canCheck(it, r, v) ? null : 'Этот пункт отмечает другой человек'; },
    checkGroup:({r, h, v, p}) => h.lists[p.list] && WHO[p.who] && liveHire(h) && canCheck({who:p.who}, r, v) ? null : 'Эту часть отмечает другой человек',
    started:({r, h, v}) => !(r.recruiter === v && h.stage === 'prep') ? 'Отметить выход сейчас нельзя' : listLeft(h.lists.prep) ? 'Сначала подготовьте выход' : null,
    decide:({r, h, v, p}) => !(r.manager === v && h.stage === 'intern') ? 'Решать по стажировке сейчас нельзя'
      : !['hire','drop','extend'].includes(p.verdict) ? 'Выберите решение' : !text(p.comment) ? 'Комментарий обязателен'
      : p.verdict === 'extend' && !isTime(p.until) ? 'Укажите новый срок' : null,
    registered:({r, h, v}) => !(r.recruiter === v && h.stage === 'docs') ? 'Отметить оформление сейчас нельзя' : listLeft(h.lists.docs) ? 'Сначала заполните документы' : null,
    fot:({h, role}) => role === 'finance' && (h.stage === 'fot' || h.stage === 'fin') ? null : 'Учесть в ФОТ сейчас нельзя',
    cancel:({r, v, p}) => !perms(r, v).cancel ? 'Отменить заявку нельзя' : CANCEL.includes(p.reason) ? null : 'Выберите причину отмены'
  };
  function check(S, v, type, p){
    const me = PEOPLE[v];
    if(!me || me.role === 'former') return 'Вы не участник воронки';
    if(!p || typeof p !== 'object') return 'Нет данных действия';
    if(NEW_ID[type] && p.newId != null && (typeof p.newId !== 'string' || !new RegExp('^' + NEW_ID[type] + '[a-z0-9]{6,24}$').test(p.newId) || takenId(S, p.newId))) return 'Неверный id новой записи';
    const role = me.role, hrd = role === 'hrd';
    if(type === 'create') return role === 'manager' || hrd ? okFields(p.fields, p.send) : 'Создавать заявки могут руководитель и HR';
    const rule = RULES[type];
    if(!rule) return 'Неизвестное действие';
    const r = S.requests.find(x => x.id === p.id);
    if(!r || !visible(r, v)) return 'Заявка не найдена';
    const c = NEED_C.includes(type) ? cand(r, p.cid) : null, h = NEED_H.includes(type) ? hire(r, p.hid) : null;
    if(NEED_C.includes(type) && !c) return 'Кандидат не найден';
    if(NEED_H.includes(type) && !h) return 'Сотрудник не найден';
    /* подбор и выход идут, пока заявка в работе: после отмены и закрытия менять нечего */
    if((c || h) && r.status !== 'published') return 'Подбор по заявке остановлен';
    if(c && !liveCand(c) && type !== 'accepted') return 'По кандидату уже есть решение';
    return rule({r, c, h, p, v, role, hrd});
  }

  /* ---------- форматирование ---------- */
  function plural(n, one, few, many){ const a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many; }
  const MON = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
  /* время компании — Алматы, UTC+5. Подписи вроде «Интервью назначено на 9 окт, 11:00» пишет и сервер,
     а у него часовой пояс UTC: от пояса машины время в истории зависеть не должно */
  const TZ = 5 * H, local = t => new Date(t + TZ);
  function fmtDate(t, withYear){ if(!t) return ''; const d = local(t); return d.getUTCDate() + ' ' + MON[d.getUTCMonth()] + (withYear && d.getUTCFullYear() !== local(Date.now()).getUTCFullYear() ? ' ' + d.getUTCFullYear() : ''); }
  function fmtTime(t){ const d = local(t); return String(d.getUTCHours()).padStart(2,'0') + ':' + String(d.getUTCMinutes()).padStart(2,'0'); }
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
    const S = {requests:[], v:8};
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
    /* интервью: назначили на время hWhen (часы назад; будущее — через day), отметили проведённым в hDone */
    const iv = (id, cid, kind, by, hSet, when, hDone) => { go(by, 'schedule', {id, cid, kind, when}, hSet); if(hDone != null) go(by, 'interviewed', {id, cid, kind}, hDone); };
    const SCREEN = 'Созвонились: вакансия актуальна, готов выйти в ближайшие две недели, ожидания в пределах заявки.';
    const recOf = id => S.requests.find(x => x.id === id).recruiter;
    /* до интервью HR: звонок рекрутера, решение HR, дату назначает рекрутер, интервью проводит HR */
    const toHr = (id, cid, h0, k, done) => {
      const rec = recOf(id);
      go(rec, 'screened', {id, cid, text:SCREEN}, h0);
      go(HRD, 'invite', {id, cid}, h0 - k);
      go(rec, 'schedule', {id, cid, kind:'hr', when:work(t(h0 - 3 * k))}, h0 - 2 * k);
      if(done) go(HRD, 'interviewed', {id, cid, kind:'hr'}, h0 - 3.5 * k);
    };
    /* весь путь до решения руководителя. h0 — звонок, h1 — решение руководителя */
    const pass = (id, cid, mgr, h0, h1) => {
      const k = (h0 - h1) / 10;
      toHr(id, cid, h0, k, true);
      go(HRD, 'move', {id, cid, to:'mgr'}, h0 - 4 * k);
      iv(id, cid, 'mgr', mgr, h0 - 5 * k, work(t(h0 - 7 * k)), h0 - 8 * k);
    };
    /* после «Нанимаем»: HR подтверждает, рекрутер отправляет оффер с итоговым окладом, кандидат принимает */
    const offerPath = (id, h, salary, h0) => {
      go(HRD, 'hrConfirm', {id, hid:h.id, yes:true}, h0);
      go(recOf(id), 'offer', {id, hid:h.id, salary}, h0 - 4);
      go(recOf(id), 'offerAccepted', {id, hid:h.id}, h0 - 20);
    };
    const testFile = (id, cid, name, h) => go(recOf(id), 'addFiles', {id, cid, files:[{name, size:240000, kind:'Результат тестового'}]}, h);
    const C = (name, position, source, expect, extra) => Object.assign({name, position, source, expect, phone:phone(name), tg:'@' + translit(name.split(' ')[0]), email:''}, extra || {});

    /* закрытые */
    const qa = approve('qa', 420, 2, {hrAt:400, finAt:380});
    go('erl', 'cancel', {id:qa, reason:'Позиция больше не требуется', comment:'Тестирование забрали подрядчики.'}, 150);
    const assist = approve('assist', 200, 2, {hrAt:180, finAt:150, fin:'Бюджет есть, на усмотрение CEO.'});
    go(CEO, 'ceoReject', {id:assist, comment:'Пока закрываем задачу силами офис-менеджера, вернёмся к вопросу в январе.'}, 100);

    const video = approve('video', 48 + 34 * 24, 6, {hrAt:48 + 33 * 24, finAt:48 + 32 * 24, ceoAt:48 + 31 * 24 + 5, rec:'ali', deadline:day(-10), assignAt:48 + 31 * 24, takeAt:48 + 30 * 24 + 20, pubAt:48 + 30 * 24});
    let c1 = addC(video, 'ali', C('Тимур Бекмуханов','Видеограф, фриланс','Instagram','400 000 ₸'), 48 + 28 * 24);
    pass(video, c1, 'dan', 48+27*24, 48+24*24);
    go('dan','feedback',{id:video,cid:c1,verdict:'approve',comment:'Хорошее портфолио, берём.'},48+24*24);
    go('ali','accepted',{id:video,cid:c1,start:t(48+20*24)},48+22*24);
    let vh = S.requests.find(r => r.id === video).hires[0];
    checkAll(video, vh, 'prep', 48 + 21 * 24, 'ali');
    go('ali','started',{id:video,hid:vh.id},48+20*24); checkAll(video, vh, 'day1', 48 + 20 * 24, 'ali');
    go('dan','decide',{id:video,hid:vh.id,verdict:'hire',comment:'Справился, оставляем.'},48+18*24);
    offerPath(video, vh, '380 000 ₸', 48+17*24);
    checkAll(video, vh, 'docs', 48 + 10 * 24, 'ali');
    go('ali','registered',{id:video,hid:vh.id},48+5*24);
    go(FIN,'fot',{id:video,hid:vh.id,comment:'Учтён с 1 октября.'},48);

    /* оформление */
    const office = approve('office', 900, 6, {hrAt:880, finAt:860, ceoAt:840, rec:'sam', deadline:day(-5), assignAt:835, takeAt:830, pubAt:828});
    c1 = addC(office, 'sam', C('Жанна Мухтарова','Администратор в клинике','HH','300 000 ₸'), 800);
    pass(office, c1, 'gul', 790, 760);
    go('gul','feedback',{id:office,cid:c1,verdict:'approve',comment:''},760);
    go('sam','accepted',{id:office,cid:c1,start:day(-14)},740);
    let oh = S.requests.find(r => r.id === office).hires[0];
    checkAll(office, oh, 'prep', 400, 'sam'); go('sam','started',{id:office,hid:oh.id},14*24); checkAll(office, oh, 'day1', 14*24 - 2, 'sam');
    go('gul','decide',{id:office,hid:oh.id,verdict:'hire',comment:'Всё хорошо.'},11*24);
    offerPath(office, oh, '290 000 ₸', 10*24 + 20);
    checkAll(office, oh, 'docs', 3*24, 'sam'); go('sam','registered',{id:office,hid:oh.id},20);

    const analyst = approve('analyst', 1000, 6, {hrAt:990, finAt:960, ceoAt:950, rec:'sam', deadline:day(-2), assignAt:945, takeAt:940, pubAt:936});
    c1 = addC(analyst, 'sam', C('Ильяс Кенжебаев','Аналитик в банке','LinkedIn','700 000 ₸'), 900);
    pass(analyst, c1, 'erl', 880, 790);
    go('erl','feedback',{id:analyst,cid:c1,verdict:'approve',comment:'Сильный кейс на интервью.'},790);
    go('sam','accepted',{id:analyst,cid:c1,start:day(-12)},770);
    let ah = S.requests.find(r => r.id === analyst).hires[0];
    checkAll(analyst, ah, 'prep', 300, 'sam'); go('sam','started',{id:analyst,hid:ah.id},12*24); checkAll(analyst, ah, 'day1', 12*24 - 3, 'sam');
    go('erl','decide',{id:analyst,hid:ah.id,verdict:'hire',comment:'Берём.'},20);

    /* выход */
    const producer = approve('producer', 700, 6, {hrAt:690, finAt:670, ceoAt:660, rec:'ali', deadline:day(-1), assignAt:655, takeAt:650, pubAt:648, pub2:640});
    c1 = addC(producer, 'ali', C('Аружан Тулегенова','Продюсер в агентстве','Рекомендации','750 000 ₸'), 600);
    const c2 = addC(producer, 'ali', C('Сергей Волков','Линейный продюсер','HH','800 000 ₸'), 590);
    pass(producer, c1, 'dan', 580, 540);
    go('ali','reject',{id:producer,cid:c2,reason:'Зарплатные ожидания',comment:'Ожидания выше вилки на 15%.'},570);
    go('dan','feedback',{id:producer,cid:c1,verdict:'approve',comment:'Опыт подходит.'},540);
    go('ali','accepted',{id:producer,cid:c1,start:t(50)},480);
    let ph = S.requests.find(r => r.id === producer).hires[0];
    checkAll(producer, ph, 'prep', 70, 'ali'); go('ali','started',{id:producer,hid:ph.id},50); checkSome(producer, ph, 'day1', 10, 46, 'ali');

    const copy = approve('copy', 500, 6, {hrAt:490, finAt:470, ceoAt:460, rec:'ali', deadline:day(5), assignAt:455, takeAt:452, pubAt:450});
    c1 = addC(copy, 'ali', C('Динара Оразбаева','Редактор в медиа','Telegram','320 000 ₸'), 400);
    const c3 = addC(copy, 'ali', C('Максат Нургалиев','Копирайтер, фриланс','HH','350 000 ₸'), 395);
    pass(copy, c1, 'mad', 380, 280);
    toHr(copy, c3, 378, 3, true); go(HRD,'reject',{id:copy,cid:c3,reason:'Не прошёл интервью',comment:''},360);
    go('mad','feedback',{id:copy,cid:c1,verdict:'approve',comment:'Тексты живые, берём.'},280);
    go('ali','accepted',{id:copy,cid:c1,start:day(2)},60);
    let ch = S.requests.find(r => r.id === copy).hires[0];
    checkSome(copy, ch, 'prep', 9, 30, 'ali');

    /* подбор */
    const operator = approve('operator', 400, 6, {hrAt:390, finAt:380, ceoAt:370, rec:'ali', deadline:day(12), assignAt:365, takeAt:360, pubAt:358, pub2:350});
    const o1 = addC(operator, 'ali', C('Руслан Ибраев','Оператор на ТВ','HH','650 000 ₸'), 300);
    const o2 = addC(operator, 'ali', C('Елена Пак','Оператор, фриланс','Instagram','600 000 ₸'), 280);
    const o3 = addC(operator, 'ali', C('Бауыржан Сейткали','Ассистент оператора','HH','450 000 ₸'), 120);
    const o4 = addC(operator, 'ali', C('Ксения Ли','Оператор в продакшне','Рекомендации','620 000 ₸'), 20);
    pass(operator, o1, 'dan', 270, 240);
    go('dan','feedback',{id:operator,cid:o1,verdict:'approve',comment:'Сильный шоурил.'},240);
    go('ali','accepted',{id:operator,cid:o1,start:day(3)},180);
    toHr(operator, o2, 258, 5, false); go('ali','reject',{id:operator,cid:o2,reason:'Отказался сам',comment:'Ушла на другой проект.'},230);
    go('ali','reject',{id:operator,cid:o3,reason:'Не подходит по опыту',comment:''},90);
    go('ali', 'screened', {id:operator, cid:o4, text:SCREEN}, 5); go(HRD, 'invite', {id:operator, cid:o4}, 4); go('ali', 'schedule', {id:operator, cid:o4, kind:'hr', when:day(1, 11)}, 3);
    let oph = S.requests.find(r => r.id === operator).hires[0];
    checkSome(operator, oph, 'prep', 4, 100, 'ali');

    const motion = approve('motion', 260, 6, {hrAt:250, finAt:240, ceoAt:230, rec:'ali', deadline:day(6), assignAt:226, takeAt:224, pubAt:220, pub2:210});
    /* кандидаты на всех шагах до решения руководителя: видно, чего ждёт каждый */
    const m = [
      ['Камила Абдрахманова','Моушн-дизайнер в студии','HH','600 000 ₸', 190, 'mgrSet'],
      ['Арсен Туяков','Моушн-дизайнер, фриланс','Telegram','500 000 ₸', 180, 'mgrDone'],
      ['Асем Касенова','Дизайнер-аниматор','Instagram','450 000 ₸', 140, 'hrDone'],
      ['Алихан Жаксылыков','3D-аниматор','HH','700 000 ₸', 90, 'hrSet'],
      ['Мария Ким','Моушн-дизайнер в агентстве','LinkedIn','550 000 ₸', 60, 'hrSet2'],
      ['Нурлан Абенов','Junior моушн-дизайнер','HH','350 000 ₸', 30, 'invite'],
      ['Айым Сарсенова','Графический дизайнер','Telegram','400 000 ₸', 20, 'review'],
      ['Дмитрий Ан','Видеомонтажёр','HH','450 000 ₸', 3, ''],
      ['Гаухар Бейсенова','Моушн-дизайнер','Рекомендации','520 000 ₸', 150, 'hrReject']
    ];
    m.forEach(([n, pos, src, exp, h, st]) => {
      const cid = addC(motion, 'ali', C(n, pos, src, exp, {experience:'3 года', comment:'', resume:'https://hh.kz/resume/' + translit(n).slice(0,8)}), h);
      if(st === 'review'){ testFile(motion, cid, 'Тестовое — анимация логотипа.pdf', h - 4); go('ali', 'screened', {id:motion, cid, text:SCREEN}, h - 6); }
      if(st === 'invite'){ go('ali', 'screened', {id:motion, cid, text:SCREEN}, h - 4); go(HRD, 'invite', {id:motion, cid}, h - 8); }
      if(st === 'hrSet'){ toHr(motion, cid, h - 5, 4, false); go('ali', 'schedule', {id:motion, cid, kind:'hr', when:day(1, 11)}, h - 20); }
      if(st === 'hrSet2'){ toHr(motion, cid, h - 5, 4, false); go('ali', 'schedule', {id:motion, cid, kind:'hr', when:day(2, 15)}, h - 20); }
      if(st === 'hrDone') toHr(motion, cid, h - 5, 6, true);
      if(st === 'hrReject'){ toHr(motion, cid, h - 5, 3, true); go(HRD,'reject',{id:motion,cid,reason:'Не прошёл интервью',comment:'Слабое портфолио по моушну.'},h - 30); }
      if(st === 'mgrSet' || st === 'mgrDone'){ toHr(motion, cid, h - 5, 4, true); go(HRD, 'move', {id:motion, cid, to:'mgr'}, h - 25); }
      if(st === 'mgrSet') iv(motion, cid, 'mgr', 'dan', h - 40, day(1, 15));
      if(st === 'mgrDone'){ testFile(motion, cid, 'Тестовое — титры для ролика.pdf', h - 50); iv(motion, cid, 'mgr', 'dan', h - 60, work(t(h - 80)), h - 90); }
    });

    const front = approve('front', 160, 4, {hrAt:150, finAt:120, ceoAt:96, rec:'sam', deadline:day(30), assignAt:40, fin:'В пределах годового плана по ФОТ разработки.'});
    void front;
    approve('designer', 80, 3, {hrAt:70, finAt:40, ceoAt:5});

    /* согласование */
    const sales = go('ase', 'create', {fields:F.sales, send:true}, 30);
    go(HRD, 'hrReturn', {id:sales, comment:'Позиция под план продаж — без бонусной части не закроем.', notes:{bonus:'Добавьте KPI и бонусную часть: процент от продаж.', salary:'Оклад без бонусов ниже рынка. Укажите вилку.'}}, 20);
    approve('montage', 70, 2, {hrAt:52, finAt:26, fin:'В бюджете продакшна на IV квартал.'});
    approve('smm', 60, 1, {hrAt:50, hr:'Срочная замена, прошу посмотреть в приоритете.'});
    approve('support', 3, 0, {});
    go('dan', 'create', {fields:F.sound, send:false}, 5);

    return S;

    function checkAll(id, h, list, at, by){ h.lists[list].forEach((it, i) => { if(!it.done) go(it.who === 'manager' ? S.requests.find(r => r.id === id).manager : by, 'check', {id, hid:h.id, list, i, done:true}, at - i * .2); }); }
    function checkSome(id, h, list, n, at, by){ h.lists[list].slice(0, n).forEach((it, i) => go(it.who === 'manager' ? S.requests.find(r => r.id === id).manager : by, 'check', {id, hid:h.id, list, i, done:true}, at - i * .3)); }
  }
  function phone(n){ let x = 0; for(const ch of n) x = (x * 31 + ch.charCodeAt(0)) % 9999991; const d = String(1000000 + x % 8999999); return '+7 70' + (x % 8) + ' ' + d.slice(0,3) + ' ' + d.slice(3,5) + ' ' + d.slice(5,7); }
  function translit(s){
    const m = {а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'i',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sh',ы:'y',э:'e',ю:'yu',я:'ya',ь:'',ъ:'',ә:'a',ғ:'g',қ:'k',ң:'n',ө:'o',ұ:'u',ү:'u',һ:'h',і:'i'};
    return s.toLowerCase().split('').map(ch => m[ch] ?? ch).join('').replace(/[^a-z0-9]/g, '');
  }

  return {H, D, ROLE, PEOPLE, get HRD(){ return HRD; }, get FIN(){ return FIN; }, get CEO(){ return CEO; }, RECRUITERS, configure, check, newId, NEW_ID, SLA, DEPTS, REASONS, FORMATS, EMPLOYMENT, PRIORITY, PLATFORMS, SOURCES, REJECT, CANCEL,
    STAGES, stageGroup, isRange, IV_NAME, ivStage, ivState, hrStep, candNow, TEST_KINDS, testFiles, canAttach, FIELD_NAMES, LISTS, listLeft, COLUMNS, phase, progress, statusText, turns, late, mineTurn, visible, perms, canCheck, WHO,
    activeHires, openHires, act, seed, plural, fmtDate, fmtTime, fmtDateTime, ago, short, days};
})();
