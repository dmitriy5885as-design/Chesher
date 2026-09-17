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
    const lobbyRef = firebaseRtdb.ref('lobbies/' + lobbyId);
    const snap = await lobbyRef.once('value');
    const lobby = snap.val();

    if(!lobby || lobby.status !== 'waiting') return false;
    if(lobby.host === uid) return false;

    await lobbyRef.update({
      guest: uid,
      guestName: name,
      guestAva: isGuest ? '👽' : (ChesAuth.profile ? ChesAuth.profile.ava : '👽'),
      guestReady: false
    });

    this.lobbyId = lobbyId;
    this.myColor = lobby.color;
    this.opponent = { uid: lobby.host, name: lobby.hostName, ava: lobby.hostAva };
    this.lobbySettings = { mode: lobby.mode || 'classic', ranked: !!lobby.ranked, timeSec: lobby.timeSec != null ? lobby.timeSec : 300, timeInc: lobby.timeInc != null ? lobby.timeInc : 0 };
    this._isHost = false;
    this._listenGame();
    return true;
  },

  /* --- Пригласить друга --- */
  async inviteFriend(friendUid) {
    if(!firebaseRtdb || !ChesAuth.user) return false;
    const uid = ChesAuth.getUid();
    const name = ChesAuth.profile ? ChesAuth.profile.name : 'Игрок';
    const invRef = firebaseRtdb.ref('invites/' + friendUid).push();
    await invRef.set({
      from: uid,
      fromName: name,
      fromAva: ChesAuth.profile ? ChesAuth.profile.ava : '👽',
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

      if(data.status === 'playing' && !this._started) {
        this._started = true;
        if(!this.opponent && data.guest) {
          this.opponent = { uid: data.guest, name: data.guestName, ava: data.guestAva };
        }
        if(this._startCallback) this._startCallback(this.opponent);
      }

      if(data.winner) {
        if(this._endCallback) this._endCallback(data.winner, data.reason);
        this.cleanup();
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

  /* --- Отправить ход --- */
  async sendMove(from, to, fen, notation, promo) {
    if(!firebaseRtdb || !this.lobbyId) return;
    const uid = ChesAuth.getUid();
    const ref = firebaseRtdb.ref('lobbies/' + this.lobbyId);
    await ref.update({ fen, turn: fen.split(' ')[1] });
    await ref.child('moves').push({
      by: uid,
      from,
      to,
      fen,
      notation,
      promo: promo || null,
      timestamp: Date.now()
    });
  },

  /* --- Завершить игру --- */
  async endGame(winner, reason) {
    if(!firebaseRtdb || !this.lobbyId) return;
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
    await ref.update({ status: 'playing' });
  },

  /* --- Колбэки --- */
  onMove(fn) { this._moveCallback = fn; },
  onEnd(fn) { this._endCallback = fn; },
  onStart(fn) { this._startCallback = fn; },
  onLobbyUpdate(fn) { this._lobbyUpdateCallback = fn; },
  onDraw(fn) { this._drawCallback = fn; },
  onDrawResp(fn) { this._drawRespCallback = fn; }
};
