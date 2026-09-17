/**
 * ЧЕШЕР — Мультиплеер (Firebase Realtime Database)
 * Создание лобби, приглашение, синхронизация ходов
 */
"use strict";

const ChesMP = {
  lobbyId: null,
  myColor: null,
  opponent: null,
  _gameRef: null,
  _statusRef: null,
  _moveCallback: null,
  _endCallback: null,
  _startCallback: null,
  _lobbyUpdateCallback: null,
  _drawCallback: null,
  _drawRespCallback: null,
  _isHost: false,
  _started: false,
  _ended: false,
  _rematchFired: false,
  _resultSent: false,
  _connAttached: false,
  lobbyClock: null,
  round: 0,
  _sendQueue: [],
  _sending: false,
  _sendRetryTimer: null,
  _connectedRef: null,

  /* --- Установить статус онлайн --- */
  setOnline() {
    if(!firebaseRtdb || !ChesAuth.user) return;
    const uid = ChesAuth.getUid();
    firebaseRtdb.ref('status/' + uid).set({
      online: true,
      lastSeen: Date.now(),
      name: ChesAuth.profile ? ChesAuth.profile.name : 'Игрок'
    });
    firebaseRtdb.ref('status/' + uid).onDisconnect().set({
      online: false,
      lastSeen: Date.now()
    });
    // Flush queued moves as soon as we're back online (single listener, no duplicates)
    if(this._connAttached) return;
    this._connAttached = true;
    const connRef = firebaseRtdb.ref('.info/connected');
    this._connectedRef = connRef;
    connRef.on('value', snap => {
      if(snap.val() === true) this._flushSend();
    });
  },

  /* --- Создать лобби (хост) --- */
  async createLobby(settings) {
    if(!firebaseRtdb) {
      console.error('createLobby: firebaseRtdb not initialized');
      return null;
    }
    if(!ChesAuth.user) {
      console.error('createLobby: user not authenticated');
      return null;
    }
    const uid = ChesAuth.getUid();
    const isGuest = !ChesAuth.user || ChesAuth.user.isAnonymous;
    const guestProfile = ProfilesManager.getCurrent();
    const guestDisplayName = (guestProfile && guestProfile.name && guestProfile.name !== 'Гость') ? guestProfile.name : 'Гость';
    const name = isGuest ? guestDisplayName : (ChesAuth.profile ? ChesAuth.profile.name : 'Игрок');
    const ava = isGuest ? (guestProfile && guestProfile.ava ? guestProfile.ava : '👽') : (ChesAuth.profile ? ChesAuth.profile.ava : '👽');
    const lobbyRef = firebaseRtdb.ref('lobbies').push();
    const lobbyId = lobbyRef.key;

    const cfg = settings || {};
    const timeSec = cfg.timeSec != null ? cfg.timeSec : 300;
    const timeInc = cfg.timeInc != null ? cfg.timeInc : 0;
    const mode = cfg.mode || 'classic';
    const colorPref = cfg.color || 'random';
    const isWhite = colorPref === 'w' ? true : colorPref === 'b' ? false : Math.random() < 0.5;

    await lobbyRef.set({
      host: uid,
      hostName: name,
      hostAva: ava,
      hostReady: false,
      guest: null,
      guestName: null,
      guestAva: null,
      guestReady: false,
      status: 'waiting',
      mode: mode,
      ranked: !!settings.ranked,
      timeSec: timeSec,
      timeInc: timeInc,
      color: isWhite ? 'b' : 'w',
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      moves: [],
      turn: 'w',
      createdAt: Date.now()
    });

    this.lobbyId = lobbyId;
    this.myColor = isWhite ? 'w' : 'b';
    this._isHost = true;
    // If the host closes the tab without leaving, mark the lobby cancelled
    lobbyRef.onDisconnect().update({ status: 'cancelled' });
    return lobbyId;
  },

  /* --- Присоединиться к лобби (гость) --- */
  async joinLobby(lobbyId) {
    if(!firebaseRtdb || !ChesAuth.user) return false;
    const uid = ChesAuth.getUid();
    const isGuest = !ChesAuth.user || ChesAuth.user.isAnonymous;
    const guestProfile = ProfilesManager.getCurrent();
    const guestDisplayName = (guestProfile && guestProfile.name && guestProfile.name !== 'Гость') ? guestProfile.name : 'Гость';
    const name = isGuest ? guestDisplayName : (ChesAuth.profile ? ChesAuth.profile.name : 'Игрок');
    const lobbiesRef = firebaseRtdb.ref('lobbies');
    const guestAva = isGuest ? '👽' : (ChesAuth.profile ? ChesAuth.profile.ava : '👽');

    // Atomically claim the guest slot — prevents two guests from joining the same lobby
    const result = await lobbiesRef.child(lobbyId).transaction(node => {
      if(!node) return;
      if(node.status !== 'waiting') return;
      if(node.guest) return;
      if(node.host === uid) return;
      node.guest = uid;
      node.guestName = name;
      node.guestAva = guestAva;
      node.guestReady = false;
      return node;
    });

    if(!result.committed || !result.snapshot) return false;
    const lobby = result.snapshot.val();
    if(!lobby) return false;

    // If the guest closes the tab without leaving, mark the lobby cancelled
    lobbiesRef.child(lobbyId).onDisconnect().update({ status: 'cancelled' });

    this.lobbyId = lobbyId;
    this.myColor = lobby.color;
    this.opponent = { uid: lobby.host, name: lobby.hostName, ava: lobby.hostAva };
    this.lobbySettings = { mode: lobby.mode || 'classic', ranked: !!lobby.ranked, timeSec: lobby.timeSec != null ? lobby.timeSec : 300, timeInc: lobby.timeInc != null ? lobby.timeInc : 0 };
    this._isHost = false;
    this._listenGame();
    return true;
  },

  /* --- Пригласить друга --- */
  async inviteFriend(friendUid, lobbyId) {
    if(!firebaseRtdb || !ChesAuth.user) return false;
    const uid = ChesAuth.getUid();
    const name = ChesAuth.profile ? ChesAuth.profile.name : 'Игрок';
    const invRef = firebaseRtdb.ref('invites/' + friendUid).push();
    await invRef.set({
      from: uid,
      fromName: name,
      fromAva: ChesAuth.profile ? ChesAuth.profile.ava : '👽',
      lobbyId: lobbyId || this.lobbyId || null,
      createdAt: Date.now()
    });
    return true;
  },

  /* --- Слушать входящие приглашения --- */
  listenInvites(callback) {
    if(!firebaseRtdb || !ChesAuth.user) return;
    const uid = ChesAuth.getUid();
    firebaseRtdb.ref('invites/' + uid).on('child_added', snap => {
      const inv = snap.val();
      inv._key = snap.key;
      callback(inv);
    });
  },

  /* --- Принять приглашение --- */
  async acceptInvite(invite) {
    if(!firebaseRtdb) return false;
    const uid = ChesAuth.getUid();
    firebaseRtdb.ref('invites/' + uid + '/' + invite._key).remove();
    return await this.joinLobby(invite.lobbyId || this.lobbyId);
  },

  /* --- Слушать изменения в лобби --- */
  _listenGame() {
    if(!this.lobbyId) return;
    const ref = firebaseRtdb.ref('lobbies/' + this.lobbyId);
    this._gameRef = ref;
    const movesRef = ref.child('moves');
    const drawRef = ref.child('draw');
    const drawRespRef = ref.child('drawResp');
    this._movesRef = movesRef;
    this._drawRef = drawRef;
    this._drawRespRef = drawRespRef;

    ref.on('value', snap => {
      const data = snap.val();
      if(!data) return;

      if(data.status === 'playing' && (!this._started || this._ended)) {
        if(this._ended) {
          // Rematch restart: game was finished, now playing again
          this._ended = false;
          this._rematchFired = false;
          this._resultSent = false;
        }
        this._started = true;
        this.lobbyClock = data.clock || null;
        this.round = data.round || 0;
        if(!this.opponent && data.guest) {
          this.opponent = { uid: data.guest, name: data.guestName, ava: data.guestAva };
        }
        if(this._startCallback) this._startCallback(this.opponent);
      }

      // Rematch: both players marked rematch -> host resets the lobby to a fresh game
      if(data.status === 'finished' && data.rematch && !this._rematchFired) {
        const uid = ChesAuth.getUid();
        const hostWant = data.rematch[data.host] === true;
        const guestWant = data.guest && data.rematch[data.guest] === true;
        if(hostWant && guestWant) {
          this._rematchFired = true;
          this._started = false;
          this._ended = false;
          this._resultSent = false;
          if(data.host === uid) {
            // Host rebuilds the lobby for a new round (same settings & colors)
            this.resetForRematch();
          }
        }
      }

      if(data.winner && !this._ended) {
        this._ended = true;
        // Game ended normally — do NOT discard the finished status on tab close,
        // but keep listeners alive so both players can request a rematch
        if(firebaseRtdb && this.lobbyId) {
          try { firebaseRtdb.ref('lobbies/' + this.lobbyId).onDisconnect().cancel(); } catch(e) {}
        }
        if(this._endCallback) this._endCallback(data.winner, data.reason);
      }

      if(this._lobbyUpdateCallback) this._lobbyUpdateCallback(data);
    });

    movesRef.on('child_added', snap => {
      const move = snap.val();
      if(move.by !== ChesAuth.getUid() && this._moveCallback) {
        this._moveCallback(move);
      }
    });

    drawRef.on('child_added', snap => {
      const d = snap.val();
      if(d && d.by !== ChesAuth.getUid() && this._drawCallback) {
        this._drawCallback(d);
      }
    });

    drawRespRef.on('child_added', snap => {
      const r = snap.val();
      if(r && r.by !== ChesAuth.getUid() && this._drawRespCallback) {
        this._drawRespCallback(r);
      }
    });
  },

  /* --- Отправить ход (с очередью и повторами) --- */
  async sendMove(from, to, fen, notation, promo, clock) {
    if(!firebaseRtdb || !this.lobbyId) return;
    const uid = ChesAuth.getUid();
    const mid = uid + '_' + Date.now() + '_' + from + to;
    const move = {
      mid: mid,
      by: uid,
      from,
      to,
      fen,
      notation,
      promo: promo || null,
      clock: clock || null,
      timestamp: Date.now()
    };
    this._sendQueue.push(move);
    await this._flushSend();
  },

  /* --- Отправить накопленные ходы по очереди (идемпотентный по key) --- */
  async _flushSend() {
    if(!firebaseRtdb || !this.lobbyId) return;
    if(this._sending) return;
    this._sending = true;
    try {
      while(this._sendQueue.length) {
        const m = this._sendQueue[0];
        const ref = firebaseRtdb.ref('lobbies/' + this.lobbyId);
        const upd = { fen: m.fen, turn: m.fen.split(' ')[1] };
        if(m.clock) upd.clock = m.clock;
        await ref.update(upd);
        await ref.child('moves').child(m.mid).set({
          mid: m.mid,
          by: m.by,
          from: m.from,
          to: m.to,
          fen: m.fen,
          notation: m.notation,
          promo: m.promo,
          clock: m.clock || null,
          timestamp: m.timestamp
        });
        this._sendQueue.shift();
      }
    } catch(e) {
      console.warn('sendMove retry queued:', e);
    }
    this._sending = false;
    if(this._sendQueue.length) this._scheduleSendRetry();
  },

  _scheduleSendRetry() {
    if(this._sendRetryTimer) return;
    this._sendRetryTimer = setTimeout(() => {
      this._sendRetryTimer = null;
      this._flushSend();
    }, 2500);
  },

  /* --- Завершить игру --- */
  async endGame(winner, reason) {
    if(!firebaseRtdb || !this.lobbyId) return;
    // Each client may hit the same terminal condition (e.g. deterministic timeout);
    // write the result to the lobby at most once to avoid redundant writes/races.
    if(this._resultSent) return;
    this._resultSent = true;
    await firebaseRtdb.ref('lobbies/' + this.lobbyId).update({
      winner,
      reason,
      status: 'finished'
    });
  },

  /* --- Отменить/выйти --- */
  async cancelLobby() {
    if(!firebaseRtdb || !this.lobbyId) return;
    await firebaseRtdb.ref('lobbies/' + this.lobbyId).update({ status: 'cancelled' });
    this.cleanup();
  },

  /* --- Выйти из лобби без изменения статуса (игра окончена) --- */
  leaveLobby() {
    this.cleanup();
  },

  /* --- Предложить ничью --- */
  async offerDraw() {
    if(!firebaseRtdb || !this.lobbyId) return;
    await firebaseRtdb.ref('lobbies/' + this.lobbyId + '/draw').push({
      by: ChesAuth.getUid(),
      ts: Date.now()
    });
  },

  /* --- Ответить на предложение ничьей --- */
  async respondDraw(accepted) {
    if(!firebaseRtdb || !this.lobbyId) return;
    await firebaseRtdb.ref('lobbies/' + this.lobbyId + '/drawResp').push({
      by: ChesAuth.getUid(),
      accepted: !!accepted,
      ts: Date.now()
    });
  },

  /* --- Очистка --- */
  cleanup() {
    // Cancel pending onDisconnect so closing the tab after a finished game
    // doesn't overwrite status 'finished' with 'cancelled'
    if(firebaseRtdb && this.lobbyId) {
      try { firebaseRtdb.ref('lobbies/' + this.lobbyId).onDisconnect().cancel(); } catch(e) {}
    }
    if(this._connectedRef) {
      try { this._connectedRef.off(); } catch(e) {}
      this._connectedRef = null;
    }
    if(this._sendRetryTimer) {
      clearTimeout(this._sendRetryTimer);
      this._sendRetryTimer = null;
    }
    this._sendQueue = [];
    this._connAttached = false;
    if(this._gameRef) {
      this._gameRef.off();
      this._gameRef = null;
    }
    if(this._movesRef) {
      this._movesRef.off();
      this._movesRef = null;
    }
    if(this._drawRef) {
      this._drawRef.off();
      this._drawRef = null;
    }
    if(this._drawRespRef) {
      this._drawRespRef.off();
      this._drawRespRef = null;
    }
    this.lobbyId = null;
    this.myColor = null;
    this.opponent = null;
    this._moveCallback = null;
    this._endCallback = null;
    this._startCallback = null;
    this._lobbyUpdateCallback = null;
    this._drawCallback = null;
    this._drawRespCallback = null;
    this._isHost = false;
    this._started = false;
    this._ended = false;
    this._rematchFired = false;
    this._resultSent = false;
  },

  /* --- Готовность --- */
  async toggleReady() {
    if(!firebaseRtdb || !this.lobbyId) return;
    const uid = ChesAuth.getUid();
    const ref = firebaseRtdb.ref('lobbies/' + this.lobbyId);
    const snap = await ref.once('value');
    const data = snap.val();
    if(!data) return;
    const isHost = data.host === uid;
    const key = isHost ? 'hostReady' : 'guestReady';
    await ref.update({ [key]: !data[key] });
  },

  /* --- Начать игру (только хост) --- */
  async startGame() {
    if(!firebaseRtdb || !this.lobbyId || !this._isHost) return;
    const ref = firebaseRtdb.ref('lobbies/' + this.lobbyId);
    const snap = await ref.once('value');
    const data = snap.val();
    if(!data || data.host !== ChesAuth.getUid()) return;
    if(!data.guest || !data.hostReady || !data.guestReady) {
      toast('Оба игрока должны быть готовы');
      return;
    }
    const timeSec = data.timeSec != null ? data.timeSec : 300;
    const clockInit = timeSec > 0 ? { w: timeSec, b: timeSec, turn: 'w', lastMoveAt: Date.now() } : null;
    const upd = { status: 'playing' };
    if(clockInit) upd.clock = clockInit;
    await ref.update(upd);
  },

  /* --- Запросить реванш --- */
  async requestRematch() {
    if(!firebaseRtdb || !this.lobbyId) return;
    const uid = ChesAuth.getUid();
    await firebaseRtdb.ref('lobbies/' + this.lobbyId + '/rematch').update({ [uid]: true });
  },

  /* --- Хост пересобирает лобби для реванша --- */
  async resetForRematch() {
    if(!firebaseRtdb || !this.lobbyId || !this._isHost) return;
    const ref = firebaseRtdb.ref('lobbies/' + this.lobbyId);
    const snap = await ref.once('value');
    const data = snap.val();
    if(!data || data.host !== ChesAuth.getUid()) return;
    const timeSec = data.timeSec != null ? data.timeSec : 300;
    const clockInit = timeSec > 0 ? { w: timeSec, b: timeSec, turn: 'w', lastMoveAt: Date.now() } : null;
    const startFen = data.mode === 'fischer' ? null : 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    this._resultSent = false;
    await ref.update({
      fen: startFen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      turn: 'w',
      winner: null,
      reason: null,
      clock: clockInit,
      rematch: null,
      moves: null,
      draw: null,
      drawResp: null,
      status: 'playing',
      round: (data.round || 0) + 1
    });
  },

  /* --- Колбэки --- */
  onMove(fn) { this._moveCallback = fn; },
  onEnd(fn) { this._endCallback = fn; },
  onStart(fn) { this._startCallback = fn; },
  onLobbyUpdate(fn) { this._lobbyUpdateCallback = fn; },
  onDraw(fn) { this._drawCallback = fn; },
  onDrawResp(fn) { this._drawRespCallback = fn; }
};
