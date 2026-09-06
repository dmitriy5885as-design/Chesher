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
    if(!firebaseRtdb || !ChesAuth.user) return null;
    const uid = ChesAuth.getUid();
    const name = ChesAuth.profile ? ChesAuth.profile.name : 'Игрок';
    const lobbyRef = firebaseRtdb.ref('lobbies').push();
    const lobbyId = lobbyRef.key;

    const cfg = settings || {};
    const timeSec = cfg.timeSec != null ? cfg.timeSec : 300;
    const mode = cfg.mode || 'classic';
    const colorPref = cfg.color || 'random';
    const isWhite = colorPref === 'w' ? true : colorPref === 'b' ? false : Math.random() < 0.5;

    await lobbyRef.set({
      host: uid,
      hostName: name,
      hostAva: ChesAuth.profile ? ChesAuth.profile.ava : '🐣',
      guest: null,
      guestName: null,
      guestAva: null,
      status: 'waiting',
      mode: mode,
      timeSec: timeSec,
      color: isWhite ? 'b' : 'w',
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      moves: [],
      turn: 'w',
      createdAt: Date.now()
    });

    this.lobbyId = lobbyId;
    this.myColor = isWhite ? 'b' : 'w';
    return lobbyId;
  },

  /* --- Присоединиться к лобби (гость) --- */
  async joinLobby(lobbyId) {
    if(!firebaseRtdb || !ChesAuth.user) return false;
    const uid = ChesAuth.getUid();
    const name = ChesAuth.profile ? ChesAuth.profile.name : 'Игрок';
    const lobbyRef = firebaseRtdb.ref('lobbies/' + lobbyId);
    const snap = await lobbyRef.once('value');
    const lobby = snap.val();

    if(!lobby || lobby.status !== 'waiting') return false;
    if(lobby.host === uid) return false;

    await lobbyRef.update({
      guest: uid,
      guestName: name,
      guestAva: ChesAuth.profile ? ChesAuth.profile.ava : '🐣',
      status: 'playing'
    });

    this.lobbyId = lobbyId;
    this.myColor = lobby.color;
    this.opponent = { uid: lobby.host, name: lobby.hostName, ava: lobby.hostAva };
    this.lobbySettings = { mode: lobby.mode || 'classic', timeSec: lobby.timeSec != null ? lobby.timeSec : 300 };
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
      fromAva: ChesAuth.profile ? ChesAuth.profile.ava : '🐣',
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

    ref.on('value', snap => {
      const data = snap.val();
      if(!data) return;

      if(data.status === 'playing' && data.guest && !this.opponent) {
        this.opponent = { uid: data.guest, name: data.guestName, ava: data.guestAva };
        if(this._startCallback) this._startCallback(this.opponent);
      }

      if(data.winner) {
        if(this._endCallback) this._endCallback(data.winner, data.reason);
        this.cleanup();
      }
    });

    ref.child('moves').on('child_added', snap => {
      const move = snap.val();
      if(move.by !== ChesAuth.getUid() && this._moveCallback) {
        this._moveCallback(move);
      }
    });
  },

  /* --- Отправить ход --- */
  async sendMove(from, to, fen, notation) {
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

  /* --- Отмена/выход --- */
  async cancelLobby() {
    if(!firebaseRtdb || !this.lobbyId) return;
    await firebaseRtdb.ref('lobbies/' + this.lobbyId).update({ status: 'cancelled' });
    this.cleanup();
  },

  /* --- Очистка --- */
  cleanup() {
    if(this._gameRef) this._gameRef.off();
    this.lobbyId = null;
    this.myColor = null;
    this.opponent = null;
    this._gameRef = null;
  },

  /* --- Колбэки --- */
  onMove(fn) { this._moveCallback = fn; },
  onEnd(fn) { this._endCallback = fn; },
  onStart(fn) { this._startCallback = fn; }
};
