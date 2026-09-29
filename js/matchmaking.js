/**
 * ЧЕШЕР — Быстрый матч (мэтчмейкинг)
 * Очередь в RTDB `matchmaking`: {uid, sid, name, elo, ts, lobby?}
 * Детерминированная пара: свободные записи без lobby → два наименьших ts
 * (ничья — по ключу); первый становится хостом (createLobby), второй ждёт
 * lobby в записи хоста и делает joinLobby. Если lobby уже есть (хост ждёт
 * гостя) — свободные игроки идут в него.
 * Требует правил database.rules.json (узел matchmaking): выкатка отдельно.
 * Без правил/сети — аккуратная деградация: «временно недоступен».
 */
"use strict";

const ChesMM = {
  active: false,
  phase: 'idle', // idle | searching | hosting | joining | joined
  _sid: null,
  _myKey: null,
  _myRef: null,
  _queueRef: null,
  _cb: null,
  _timers: null,
  _tick: null,
  _startedAt: 0,
  _armed: false,
  _joinTried: null,
  _hostLobby: null,

  /* --- Чистая функция (юнит-тесты): две старейшие записи → пара ---
     list: { key: {uid, sid, ts, ...} } — фильтруются записи без uid/sid/ts.
     host = меньший ts (ничья → меньший ключ). null — если участников <2
     или мой sid не входит в пару. */
  pickPair(list, mySid) {
    const arr = [];
    Object.keys(list || {}).forEach(k => {
      const e = list[k];
      if(e && e.uid && e.sid && typeof e.ts === 'number') arr.push({ key: k, uid: e.uid, sid: e.sid, ts: e.ts });
    });
    arr.sort((a, b) => (a.ts - b.ts) || (a.key < b.key ? -1 : 1));
    if(arr.length < 2) return null;
    const host = arr[0];
    const guest = arr[1];
    if(host.sid !== mySid && guest.sid !== mySid) return null;
    return { host: host, guest: guest };
  },

  /* --- Старт поиска --- */
  async start() {
    if(this.active) return false;
    if(typeof firebaseRtdb === 'undefined' || !firebaseRtdb || !ChesAuth.user) {
      this._status('Онлайн-матч временно недоступен');
      toast('Онлайн-матч временно недоступен — попробуйте позже');
      return false;
    }
    try {
      this._sid = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      this._joinTried = {};
      this._hostLobby = null;
      this._armed = false;
      const cu = (typeof ProfilesManager !== 'undefined') ? ProfilesManager.getCurrent() : null;
      const ref = firebaseRtdb.ref('matchmaking').push();
      this._myRef = ref;
      this._myKey = ref.key;
      const entry = {
        uid: ChesAuth.getUid(),
        sid: this._sid,
        name: (cu && cu.name) || 'Игрок',
        elo: (cu && cu.ratings && cu.ratings.classic) || 1000,
        ts: Date.now()
      };
      await ref.set(entry);
      try { ref.onDisconnect().remove(); } catch(e) {}
      this.active = true;
      this.phase = 'searching';
      this._startedAt = Date.now();
      this._queueRef = firebaseRtdb.ref('matchmaking');
      this._cb = snap => this._reeval(snap.val() || {});
      this._queueRef.on('value', this._cb);
      this._tick = setInterval(() => this._tickStatus(), 1000);
      this._timers = setTimeout(() => this._timeout(), 15000);
      this._tickStatus();
      return true;
    } catch(e) {
      console.warn('matchmaking start:', e);
      this._hardReset();
      this._status('Онлайн-матч временно недоступен');
      toast('Онлайн-матч временно недоступен — попробуйте позже');
      return false;
    }
  },

  /* --- Отмена поиска --- */
  cancel(msg) {
    if(!this.active) return;
    const wasHosting = this.phase === 'hosting';
    if(wasHosting && typeof ChesMP !== 'undefined' && ChesMP.lobbyId) {
      try { ChesMP.cancelLobby(); } catch(e) {}
    }
    this._hardReset();
    this._status(msg || 'Поиск отменён');
    if(wasHosting && typeof showScreen === 'function') showScreen('scrMulti');
  },

  _timeout() {
    if(!this.active) return;
    this.cancel('Соперник не найден. Попробуйте позже или сыграйте с ботом 🤖');
    toast('Соперник не найден — попробуйте позже');
  },

  _hardReset() {
    try { if(this._queueRef && this._cb) this._queueRef.off('value', this._cb); } catch(e) {}
    this._queueRef = null;
    this._cb = null;
    if(this._timers) { clearTimeout(this._timers); this._timers = null; }
    if(this._tick) { clearInterval(this._tick); this._tick = null; }
    try { if(this._myRef) this._myRef.remove(); } catch(e) {}
    this._myRef = null;
    this._myKey = null;
    this.active = false;
    this.phase = 'idle';
    this._armed = false;
    this._hostLobby = null;
  },

  /* --- Пересчёт при изменении очереди --- */
  _reeval(list) {
    if(!this.active) return;
    try {
      if(this.phase === 'hosting' || this.phase === 'joining' || this.phase === 'joined') return;

      // 1) Уже есть хост с лобби (и ещё не моя попытка) → идём к нему
      const hosts = Object.keys(list)
        .map(k => ({ key: k, uid: list[k].uid, sid: list[k].sid, ts: list[k].ts, lobby: list[k].lobby }))
        .filter(e => e.sid && e.lobby && e.sid !== this._sid && !this._joinTried[e.lobby])
        .sort((a, b) => (a.ts - b.ts) || (a.key < b.key ? -1 : 1));
      if(hosts.length) { this._doJoin(hosts[0]); return; }

      // 2) Хостов нет → свободные (без lobby): я самый старший → становлюсь хостом
      const free = {};
      Object.keys(list).forEach(k => {
        const e = list[k];
        if(e && !e.lobby && e.sid) free[k] = e;
      });
      const pair = this.pickPair(free, this._sid);
      if(pair && pair.host.sid === this._sid) this._doHost();
      else this.phase = 'searching';
    } catch(e) {
      console.warn('matchmaking reeval:', e);
    }
  },

  /* --- Стать хостом: создать лобби через существующий ChesMP --- */
  async _doHost() {
    if(this.phase === 'hosting' || !this.active) return;
    this.phase = 'hosting';
    try {
      this._arm();
      const lobbyId = await ChesMP.createLobby();
      if(!lobbyId) throw new Error('createLobby failed');
      this._hostLobby = lobbyId;
      await this._myRef.update({ lobby: lobbyId });
      if(typeof ChesMP._listenGame === 'function') ChesMP._listenGame();
      NetUI._showLobby(lobbyId, 'Ищем соперника…');
      showScreen('scrLobby');
      this._status('Ждём соперника в лобби…');
    } catch(e) {
      console.warn('matchmaking host:', e);
      this.cancel('Онлайн-матч временно недоступен — попробуйте позже');
      toast('Онлайн-матч временно недоступен — попробуйте позже');
    }
  },

  /* --- Подключиться к лобби хоста --- */
  async _doJoin(host) {
    if(!this.active || this.phase === 'joining' || this.phase === 'joined') return;
    if(!host.lobby) return;
    this.phase = 'joining';
    this._joinTried[host.lobby] = true;
    try {
      this._arm();
      const ok = await ChesMP.joinLobby(host.lobby);
      if(!ok) { this.phase = 'searching'; return; } // лобби занято/снято → ревал подберёт другого
      this.phase = 'joined';
      this._status('Подключено!');
      try { if(this._myRef) await this._myRef.remove(); } catch(e) {}
      NetUI._showLobby(host.lobby, 'Подключено! Готовьтесь...');
      showScreen('scrLobby');
      if(this._timers) { clearTimeout(this._timers); this._timers = null; }
      if(this._tick) { clearInterval(this._tick); this._tick = null; }
      try { if(this._queueRef && this._cb) this._queueRef.off('value', this._cb); } catch(e) {}
      this.active = false;
    } catch(e) {
      console.warn('matchmaking join:', e);
      this.phase = 'searching';
    }
  },

  /* --- Обработчики игры — тот же паттерн, что у NetUI для друзей/кода --- */
  _arm() {
    if(this._armed) return;
    this._armed = true;
    ChesMP.onStart(opponent => {
      try { if(this._myRef) this._myRef.remove(); } catch(e) {}
      if(typeof ChesMP !== 'undefined' && ChesMP._isHost && opponent && opponent.name) {
        toast(opponent.name + ' присоединился!');
      }
      if(typeof NetUI !== 'undefined' && NetUI._startMultiplayerGame) NetUI._startMultiplayerGame();
    });
    ChesMP.onMove(move => {
      if(typeof NetUI !== 'undefined' && NetUI._onOpponentMove) NetUI._onOpponentMove(move);
    });
    ChesMP.onEnd((winner, reason) => {
      try { if(this._myRef) this._myRef.remove(); } catch(e) {}
      if(typeof NetUI === 'undefined' || !NetUI._onMultiplayerEnd) return;
      if(winner === 'draw') { NetUI._onMultiplayerEnd('draw', reason); return; }
      NetUI._onMultiplayerEnd(winner === ChesMP.myColor ? 'win' : 'loss', reason);
    });
  },

  _tickStatus() {
    if(!this.active) return;
    const sec = Math.max(1, Math.round((Date.now() - this._startedAt) / 1000));
    this._status('🔍 Ищем соперника… ' + sec + 'с (нажмите ещё раз — отменить)');
  },

  _status(text) {
    const st = document.getElementById('mpStatus');
    if(st) st.textContent = text;
  }
};

if(typeof window !== 'undefined') window.ChesMM = ChesMM;
