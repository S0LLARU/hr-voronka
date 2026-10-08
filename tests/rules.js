/* Правила check() против настоящего пути: демо-данные собраны теми же действиями, что и в работе,
   поэтому каждое из них должно проходить проверку. Плюс запреты: чужой шаг, чужая роль, плохие данные.
   Запуск: node tests/rules.js */
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'model.js'), 'utf8');
/* каждое действие сида сначала проверяем — так видно, какое правило строже реального пути */
const audited = src.replace('function act(S, by, type, p, at){', 'function act(S, by, type, p, at){ if(globalThis.AUDIT) globalThis.AUDIT(S, by, type, p);');
if(audited === src) throw new Error('не нашёл act() в model.js');
const Model = new Function(audited + ';return Model')();

let fails = 0;
const bad = (what) => { fails++; console.log('FAIL', what); };
const S0 = {requests:[], v:8};
globalThis.AUDIT = (S, by, type, p) => {
  if(type === 'take' || type === 'note' || type === 'finAccept') return; // в экранах их нет — сервер их не примет
  const e = Model.check(S, by, type, p);
  if(e) bad(`seed ${type} by ${by}: ${e}`);
};
const S = Model.seed(Date.now());
globalThis.AUDIT = null;
console.log('seed:', S.requests.length, 'заявок проверено');

/* запреты */
const find = t => S.requests.find(r => r.title === t);
const motion = find('Моушн-дизайнер'), analyst = find('Аналитик данных');
const at = name => motion.candidates.find(c => c.name.startsWith(name));
const expectNo = (v, type, p, what) => { const e = Model.check(S, v, type, p); if(!e) bad('разрешено, а не должно: ' + what); else console.log('ok  ', what, '—', e); };
const expectYes = (v, type, p, what) => { const e = Model.check(S, v, type, p); if(e) bad('запрещено, а должно быть можно: ' + what + ' — ' + e); else console.log('ok  ', what); };

const dima = at('Дмитрий'), aiym = at('Айым'), arsen = at('Арсен');
expectYes('ali', 'screened', {id:motion.id, cid:dima.id, text:'Созвонились'}, 'рекрутер докладывает HR');
expectNo('sam', 'screened', {id:motion.id, cid:dima.id, text:'x'}, 'чужой рекрутер докладывает');
expectNo('ali', 'screened', {id:motion.id, cid:dima.id, text:'  '}, 'пустые итоги звонка');
expectNo('gul', 'screened', {id:motion.id, cid:dima.id, text:'x'}, 'HR вместо рекрутера');
expectYes('gul', 'invite', {id:motion.id, cid:aiym.id}, 'HR зовёт на интервью');
expectNo('ali', 'invite', {id:motion.id, cid:aiym.id}, 'рекрутер зовёт вместо HR');
expectNo('gul', 'invite', {id:motion.id, cid:dima.id}, 'HR зовёт до звонка рекрутера');
expectYes('dan', 'feedback', {id:motion.id, cid:arsen.id, verdict:'approve'}, 'руководитель одобряет после интервью');
expectNo('mad', 'feedback', {id:motion.id, cid:arsen.id, verdict:'approve'}, 'чужой руководитель');
expectNo('dan', 'feedback', {id:motion.id, cid:arsen.id, verdict:'reject', comment:''}, 'отказ без причины');
expectNo('ali', 'addCandidate', {id:motion.id, fields:{name:'X', resume:'javascript:alert(1)'}}, 'javascript: в резюме');
expectYes('ali', 'addCandidate', {id:motion.id, newId:'cabcdef12', fields:{name:'X', resume:'https://hh.kz/r/1'}}, 'кандидат с нормальной ссылкой');
expectNo('ali', 'addCandidate', {id:motion.id, newId:motion.candidates[0].id, fields:{name:'X'}}, 'занятый id');
expectNo('ali', 'addCandidate', {id:motion.id, newId:'r123456789', fields:{name:'X'}}, 'id не того вида');
expectNo('ali', 'addFiles', {id:motion.id, cid:dima.id, files:[{name:'a.pdf', path:'../etc/passwd'}]}, 'чужой путь файла');
expectNo('rin', 'addCandidate', {id:motion.id, fields:{name:'X'}}, 'Finance не видит подбор');
expectNo('arm', 'create', {fields:{title:'X'}}, 'CEO создаёт заявку');
expectYes('dan', 'create', {fields:{title:'X'}}, 'черновик руководителя');
expectNo('dan', 'create', {fields:{title:'X', manager:'rin'}, send:true}, 'руководитель заявки — Finance');
expectNo('dan', 'hack', {id:motion.id}, 'неизвестное действие');
expectNo('dan', 'take', {id:motion.id}, 'take нет в экранах');

const h = analyst.hires.find(x => x.stage === 'hrok');
expectYes('gul', 'hrConfirm', {id:analyst.id, hid:h.id, yes:true}, 'HR подтверждает найм');
expectNo('erl', 'hrConfirm', {id:analyst.id, hid:h.id, yes:true}, 'руководитель вместо HR');
expectNo('gul', 'hrConfirm', {id:analyst.id, hid:h.id, yes:false, comment:''}, 'отказ HR без причины');
expectNo('sam', 'offer', {id:analyst.id, hid:h.id, salary:'1 ₸'}, 'оффер до подтверждения HR');

/* закрытая заявка: ничего нельзя */
const closed = S.requests.find(r => r.status === 'closed');
if(closed){ const c = closed.candidates[0]; expectNo('gul', 'reject', {id:closed.id, cid:c.id, reason:'Другое'}, 'отказ в закрытой заявке'); }

/* после configure — люди с сервера */
Model.configure({u1:{name:'А', role:'manager'}, u2:{name:'Б', role:'hrd'}, u3:{name:'В', role:'recruiter'}, u4:{name:'Г', role:'recruiter'}, u5:{name:'Д', role:'former'}});
if(Model.HRD !== 'u2' || Model.FIN !== null || Model.RECRUITERS.join() !== 'u3,u4') bad('configure: ' + [Model.HRD, Model.FIN, Model.RECRUITERS]);
else console.log('ok   configure: HRD, Finance, рекрутеры');
expectNo('u5', 'create', {fields:{title:'X'}}, 'бывший участник');
expectNo('nobody', 'create', {fields:{title:'X'}}, 'не участник');

/* часовой пояс: подпись не зависит от машины */
const t = Date.UTC(2026, 9, 9, 6, 0); // 11:00 в Алматы
if(Model.fmtDateTime(t) !== '9 окт, 11:00') bad('время ' + Model.fmtDateTime(t)); else console.log('ok   время в Алматы:', Model.fmtDateTime(t));

console.log(fails ? fails + ' FAIL' : 'all ok');
process.exit(fails ? 1 : 0);
