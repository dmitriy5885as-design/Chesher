/**
 * ЧЕШЕР — Цели дня (ежедневные квесты)
 * - 3 задания в сутки, выбор детерминирован от даты
 * - Прогресс: партии/победы/задачка/подарок (хуки из main.js)
 * - Награда выдаётся сразу при выполнении (локально + awardCoins на сервере)
 * - Состояние хранится в профиле: cu.quests = { date, items:[{id, prog, claimed}] }
 */
"use strict";

const QUEST_POOL = [
  { id: 'play2',  icon: '🎮', title: 'Сыграй 2 партии',            goal: 2, reward: 30 },
  { id: 'win1',   icon: '🏆', title: 'Победи в любой партии',      goal: 1, reward: 40 },
  { id: 'bot1',   icon: '🤖', title: 'Победи любого бота',         goal: 1, reward: 40 },
  { id: 'puzzle1',icon: '🧩', title: 'Реши задачку дня',           goal: 1, reward: 35 },
  { id: 'gift1',  icon: '🎁', title: 'Забери ежедневный подарок',  goal: 1, reward: 25 }
];

const Quests = {
  /* --- Детерминированный выбор 3 заданий от даты --- */
  _pick(dateStr) {
    let seed = 0;
    for(let i = 0; i < dateStr.length; i++) seed = (seed * 31 + dateStr.charCodeAt(i)) >>> 0;
    const pool = QUEST_POOL.slice();
    const picked = [];
    while(picked.length < 3 && pool.length) {
      seed = (seed * 1103515245 + 12345) >>> 0;
      picked.push(pool.splice(seed % pool.length, 1)[0]);
    }
    return picked;
  },

  /* --- Гарантировать свежие цели на сегодня --- */
  ensure() {
    const cu = typeof ProfilesManager !== 'undefined' ? ProfilesManager.getCurrent() : null;
    if(!cu) return null;
    const today = new Date().toISOString().slice(0, 10);
    if(!cu.quests || cu.quests.date !== today) {
      cu.quests = {
        date: today,
        items: this._pick(today).map(q => ({ id: q.id, prog: 0, claimed: false }))
      };
      saveProfiles();
    }
    return cu.quests;
  },

  _def(id) {
    return QUEST_POOL.find(q => q.id === id) || null;
  },

  /* --- Событие: 'game' {result, vsBot} | 'puzzle' | 'gift' --- */
  onEvent(type, meta) {
    const cu = typeof ProfilesManager !== 'undefined' ? ProfilesManager.getCurrent() : null;
    if(!cu) return;
    const quests = this.ensure();
    if(!quests) return;
    meta = meta || {};
    const fire = [];
    if(type === 'game') {
      fire.push('play2');
      if(meta.result === 'win') {
        fire.push('win1');
        if(meta.vsBot) fire.push('bot1');
      }
    } else if(type === 'puzzle') fire.push('puzzle1');
    else if(type === 'gift') fire.push('gift1');

    let changed = false;
    quests.items.forEach(item => {
      if(item.claimed || fire.indexOf(item.id) === -1) return;
      const def = this._def(item.id);
      if(!def) return;
      item.prog = Math.min(def.goal, item.prog + 1);
      changed = true;
      if(item.prog >= def.goal) {
        item.claimed = true;
        this._grant(def);
        if(typeof toast === 'function') toast('🎯 Цель выполнена: «' + def.title + '» +' + def.reward + ' 🪙');
        if(typeof Analytics !== 'undefined') Analytics.track('quest_done', { id: def.id, reward: def.reward });
      }
    });
    if(changed) {
      saveProfiles();
      this.render();
    }
  },

  /* --- Выдача награды: локально + сервер (как gift/daily) --- */
  _grant(def) {
    const cu = ProfilesManager.getCurrent();
    if(cu) {
      if(typeof cu.addCoins === 'function') cu.addCoins(def.reward);
      else cu.coins = (cu.coins || 0) + def.reward;
      saveProfiles();
      if(typeof renderCoins === 'function') renderCoins();
      if(typeof renderProfBar === 'function') renderProfBar();
    }
    if(typeof ChesAuth !== 'undefined' && ChesAuth.user) ChesAuth.awardCoins('quest', def.reward);
  },

  /* --- Прогресс для тестов/отладки --- */
  progress() {
    const quests = this.ensure();
    if(!quests) return [];
    return quests.items.map(item => {
      const def = this._def(item.id) || {};
      return { id: item.id, prog: item.prog, goal: def.goal || 0, claimed: !!item.claimed };
    });
  },

  /* --- Отрисовка блока «🎯 Цели дня» в профиле --- */
  render() {
    const list = document.getElementById('questList');
    if(!list) return;
    const quests = this.ensure();
    if(!quests) { list.innerHTML = ''; return; }
    list.innerHTML = quests.items.map(item => {
      const def = this._def(item.id);
      if(!def) return '';
      const pct = Math.round(Math.min(1, item.prog / def.goal) * 100);
      const done = item.claimed;
      return '<div class="questRow' + (done ? ' done' : '') + '" data-q="' + item.id + '">' +
        '<span class="qIcon">' + def.icon + '</span>' +
        '<div class="qBody">' +
          '<div class="qTitle">' + def.title + (done ? ' <b class="qOk">✓</b>' : '') + '</div>' +
          '<div class="qBar"><i style="width:' + pct + '%"></i></div>' +
        '</div>' +
        '<span class="qReward">' + (done ? 'получено' : '+' + def.reward + ' 🪙') + (done ? '' : ' · ' + item.prog + '/' + def.goal) + '</span>' +
      '</div>';
    }).join('');
  }
};

if(typeof window !== 'undefined') window.Quests = Quests;
