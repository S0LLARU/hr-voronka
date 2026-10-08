/* Хранилище: состояние воронки и подписка экранов на изменения.

   Два режима, экраны о них не знают:
   — демо (воронка открыта сама по себе): всё в localStorage, люди — демонстрационные, смотреть можно за любого;
   — сервер (воронка встроена в сайт): сайт кладёт в своё окно HrFunnelHost — доступ к своему серверу.
     Люди — пользователи сайта, данные общие. Действие сразу показывается на экране, сервер повторяет его
     той же моделью (Model.check + Model.act) и присылает итог; отказ сервера откатывает экран к его данным.
     Раз в 20 секунд и при возвращении на вкладку подтягиваем чужие изменения. */
'use strict';

const Store = (function(){
  const KEY = 'hr-funnel-v1', VKEY = 'hr-funnel-viewer';
  const host = (() => { try { return window.parent !== window && window.parent.HrFunnelHost || null; } catch(e) { return null; } })();
  let state = null, viewer = 'dan', subs = new Set(), ver = 0, kind = 'init';
  const emit = k => { kind = k; ver++; subs.forEach(f => f()); };
  const savedViewer = () => { try { return localStorage.getItem(VKEY); } catch(e) { return null; } };
  const saveViewer = v => { try { localStorage.setItem(VKEY, v); } catch(e) {} };

  /* сообщение об ошибке внизу экрана: действие не прошло или сервер недоступен */
  let toastTimer = 0;
  function notify(text){
    let el = document.querySelector('.sync-err');
    if(!el){ el = document.createElement('div'); el.className = 'sync-err'; el.setAttribute('role', 'alert'); document.body.appendChild(el); }
    el.textContent = text; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 6000);
  }

  const api = {
    get: () => state, viewer: () => viewer, version: () => ver, kind: () => kind,
    subscribe(f){ subs.add(f); return () => subs.delete(f); },
    remote: !!host,
    /* в демо смотреть можно за любого; на сервере — только админ сайта */
    canSwitch: () => !host || host.admin,
    notify
  };

  if(!host){
    try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if(s && s.v === 8) state = s; } catch(e) {}
    if(!state) state = Model.seed(Date.now());
    const v = savedViewer(); if(v && Model.PEOPLE[v]) viewer = v;
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch(e) {} };
    return Object.assign(api, {
      ready: Promise.resolve(),
      setViewer(v){ viewer = v; saveViewer(v); emit('viewer'); },
      dispatch(type, p){
        /* экран не должен предлагать то, что сервер не примет: тесты ловят это сообщение */
        const no = Model.check(state, viewer, type, p || {});
        if(no) console.error('Model.check: ' + type + ' — ' + no);
        const out = Model.act(state, viewer, type, p); save(); emit('act'); return out;
      },
      reset(){ state = Model.seed(Date.now()); save(); emit('reset'); },
      /* файлы в демо не уходят из вкладки */
      upload: files => Promise.resolve(files.map(f => ({name:f.name, size:f.size, type:f.type}))),
      fileUrl: () => Promise.reject(new Error('Файл не сохранён: демо хранит файлы до перезагрузки страницы'))
    });
  }

  /* ---------- сервер ---------- */
  let version = 0, pending = 0, queue = Promise.resolve();
  state = {requests:[], v:8}; viewer = null;
  Model.configure({});
  const take = snap => { Model.configure(snap.people); state = snap.state; viewer = snap.viewer; version = snap.version; };
  const as = () => host.admin ? (viewer || savedViewer() || undefined) : undefined;
  const pull = () => host.load(as()).then(snap => {
    if(pending) return;
    const changed = snap.version !== version || snap.viewer !== viewer;
    take(snap); if(changed) emit('sync');
  });
  const ready = host.load(as()).then(take);
  ready.then(() => {
    setInterval(() => { if(!pending && document.visibilityState === 'visible') pull().catch(() => {}); }, 20000);
    addEventListener('focus', () => { if(!pending) pull().catch(() => {}); });
  }, () => {});

  return Object.assign(api, {
    ready,
    setViewer(v){
      if(!host.admin || !Model.PEOPLE[v] || v === viewer) return;
      viewer = v; saveViewer(v); emit('viewer');
      pull().catch(e => notify(e.message));
    },
    dispatch(type, p){
      p = Object.assign({}, p);
      const no = Model.check(state, viewer, type, p);
      if(no){ notify(no); return undefined; }
      if(Model.NEW_ID[type]) p.newId = Model.newId(type);
      let out;
      try { out = Model.act(state, viewer, type, p); } catch(e) { notify(e.message); return undefined; }
      emit('act');
      /* по одному и по порядку: «добавить кандидата» и «приложить его тестовое» идут подряд */
      pending++;
      const by = viewer;
      queue = queue.then(() => host.act({type, p, as:host.admin ? by : undefined}))
        .then(snap => { pending--; if(!pending){ take(snap); emit('sync'); } },
          e => { pending--; notify(e.message || 'Сервер не принял действие'); if(!pending) return pull().catch(() => {}); });
      return out;
    },
    reset(){},
    upload(files){
      return Promise.all(files.map(f => host.upload(f).then(r => ({name:f.name, size:f.size, type:f.type, path:r.path}))))
        .catch(e => { notify('Файл не загрузился: ' + e.message); return []; });
    },
    fileUrl: path => host.fileUrl(path, host.admin ? viewer : undefined)
  });
})();
