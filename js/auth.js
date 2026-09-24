/**
 * ЧЕШЕР — Аутентификация (Firebase Auth)
 * Регистрация, вход, выход, анонимные аккаунты
 */
"use strict";

const ChesAuth = {
  user: null,
  profile: null,
  listeners: [],
  guestPlayerId: null,

  /* --- Генерация уникального ID игрока --- */
  _genPlayerId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let id = 'CHS-';
    for(let i = 0; i < 4; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return id;
  },

  /* --- Генерация гостевого ID --- */
  _genGuestPlayerId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let id = 'CHSg-';
    for(let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return id;
  },

  /* --- Проверка уникальности ID --- */
  async _isPlayerIdUnique(id) {
    if(!firebaseDB) return true;
    const snap = await firebaseDB.collection('users')
      .where('playerId', '==', id).limit(1).get();
    return snap.empty;
  },

  /* --- Создать уникальный ID --- */
  async _createUniquePlayerId() {
    for(let attempt = 0; attempt < 20; attempt++) {
      const id = this._genPlayerId();
      if(await this._isPlayerIdUnique(id)) return id;
    }
    return this._genPlayerId() + Date.now().toString(36).slice(-2);
  },

  /* --- Инициализация --- */
  init() {
    if(!firebaseAuth) return;
    firebaseAuth.onAuthStateChanged(async user => {
      this.user = user;
      if(user) {
        await this._loadProfile(user.uid);
        this.flushPending();
      } else {
        this.profile = null;
      }
      this.listeners.forEach(fn => fn(user));
    });
    if(typeof window !== 'undefined') {
      window.addEventListener('online', () => this.flushPending());
    }
  },

  onAuthChange(fn) {
    this.listeners.push(fn);
  },

  /* --- Регистрация email/password --- */
  async register(email, password, name) {
    if(!firebaseAuth) throw new Error('Firebase not initialized');
    const cred = await firebaseAuth.createUserWithEmailAndPassword(email, password);
    this.user = cred.user;
    await cred.user.updateProfile({ displayName: name });
    await this._createProfile(cred.user.uid, name);
    return cred.user;
  },

  /* --- Вход email/password --- */
  async login(email, password) {
    if(!firebaseAuth) throw new Error('Firebase not initialized');
    const cred = await firebaseAuth.signInWithEmailAndPassword(email, password);
    this.user = cred.user;
    return cred.user;
  },

  /* --- Сброс пароля (письмо на email) --- */
  async resetPassword(email) {
    if(!firebaseAuth) throw new Error('Firebase not initialized');
    await firebaseAuth.sendPasswordResetEmail(email.trim());
  },

  /* --- Вход через Google --- */
  async loginGoogle() {
    if(!firebaseAuth) throw new Error('Firebase not initialized');
    const provider = new firebase.auth.GoogleAuthProvider();
    const cred = await firebaseAuth.signInWithPopup(provider);
    this.user = cred.user;
    if(cred.additionalUserInfo && cred.additionalUserInfo.isNewUser) {
      await this._createProfile(cred.user.uid, cred.user.displayName || 'Игрок');
    }
    return cred.user;
  },

  /* --- Анонимный вход --- */
  async loginAnon() {
    if(!firebaseAuth) throw new Error('Firebase not initialized');
    const cred = await firebaseAuth.signInAnonymously();
    this.user = cred.user;
    try {
      await this._createProfile(cred.user.uid, 'Аноним #' + Math.floor(Math.random() * 9999));
    } catch(e) {
      console.warn('Firestore profile create skipped:', e.message);
    }
    return cred.user;
  },

  /* --- Выход --- */
  async logout() {
    if(!firebaseAuth) return;
    await firebaseAuth.signOut();
    this.user = null;
    this.profile = null;
  },

  /* --- Получить UID --- */
  getUid() {
    return this.user ? this.user.uid : null;
  },

  /* --- Создать профиль в Firestore --- */
  async _createProfile(uid, name) {
    if(!firebaseDB) return;
    const ref = firebaseDB.collection('users').doc(uid);
    const snap = await ref.get();
    if(!snap.exists) {
      const isAnon = this.user && this.user.isAnonymous;
      const playerId = isAnon ? null : await this._createUniquePlayerId();
      const data = {
        name: name,
        ava: '👽',
        coins: 50,
        gems: 0,
        elo: 0,
        ratings: { classic: 0, bot: 0, fischer: 0, meme: 0, ranked: 0 },
        friends: [],
        friendRequests: [],
        owned: ['classic', 'board_classic'],
        createdAt: Date.now(),
        playerId: playerId
      };
      await ref.set(data);
    }
    this.profile = (await ref.get()).data();
  },

  /* --- Загрузить профиль --- */
  async _loadProfile(uid) {
    if(!firebaseDB) return;
    try {
      const ref = firebaseDB.collection('users').doc(uid);
      const snap = await ref.get();
      if(snap.exists) {
        this.profile = snap.data();
      }
    } catch(e) {
      console.error('Profile load error:', e);
    }
  },

  /* --- Обновить профиль --- */
  async updateProfile(data) {
    if(!firebaseDB || !this.user) return;
    const ref = firebaseDB.collection('users').doc(this.user.uid);
    await ref.update(data);
    Object.assign(this.profile, data);
  },

  /* --- Cloud Functions: вызов --- */
  async callFn(name, payload) {
    if(typeof firebase === 'undefined' || !firebase.functions || !this.user) return null;
    try {
      const res = await firebase.functions().httpsCallable(name)(payload || {});
      return res.data || null;
    } catch(e) {
      console.warn('callFn ' + name + ' failed:', e.message);
      return null;
    }
  },

  /* --- Применить серверный баланс монет (сервер авторитетен) --- */
  applyServerCoins(data) {
    if(!data || typeof data.coins !== 'number') return;
    if(typeof ProfilesManager === 'undefined') return;
    const cu = ProfilesManager.getCurrent();
    if(!cu) return;
    cu.coins = data.coins;
    saveProfiles();
    if(typeof renderCoins === 'function') renderCoins();
  },

  /* --- Результат партии -> submitResult (античит, серверные лимиты) --- */
  async submitGameResult(payload) {
    const data = await this.callFn('submitResult', payload);
    if(data) this.applyServerCoins(data);
    else if(this.user) this._queuePending({ type: 'result', payload: payload, ts: Date.now() });
    return data;
  },

  /* --- Выдача монет за событие -> awardCoins (серверные капы) --- */
  async awardCoins(reason, amount) {
    const data = await this.callFn('awardCoins', { reason: reason, amount: amount });
    if(data) this.applyServerCoins(data);
    else if(this.user && amount > 0) this._queuePending({ type: 'award', payload: { reason: reason, amount: amount }, ts: Date.now() });
    return data;
  },

  /* --- Очередь неотправленных наград (офлайн) --- */
  _queuePending(item) {
    try {
      const raw = localStorage.getItem('chesher_pending_fns') || '[]';
      const q = JSON.parse(raw);
      if(!Array.isArray(q)) return;
      q.push(item);
      localStorage.setItem('chesher_pending_fns', JSON.stringify(q.slice(-50)));
    } catch(e) {}
  },

  async flushPending() {
    if(!this.user) return;
    let q = [];
    try { q = JSON.parse(localStorage.getItem('chesher_pending_fns') || '[]'); } catch(e) { return; }
    if(!Array.isArray(q) || !q.length) return;
    const remain = [];
    for(let i = 0; i < q.length; i++) {
      const item = q[i];
      let ok = null;
      if(item && item.type === 'result') ok = await this.callFn('submitResult', item.payload);
      else if(item && item.type === 'award') ok = await this.callFn('awardCoins', item.payload);
      if(!ok && item) remain.push(item);
      else if(ok) this.applyServerCoins(ok);
    }
    try { localStorage.setItem('chesher_pending_fns', JSON.stringify(remain)); } catch(e) {}
  },

  /* --- Синхронизировать локальный профиль с Firebase ---
     Сервер-авторитетная модель:
     - 💎 gems: всегда из облака (клиент не запушивает)
     - 🪙 coins: клиент может только уменьшить (трата); прирост уходит в awardCoins
     - ratings/wins/games: пишет только сервер (создание документа — исключение) */
  async syncLocalToCloud(localProfile) {
    if(!firebaseDB || !this.user) return;
    const ref = firebaseDB.collection('users').doc(this.user.uid);
    const snap = await ref.get();
    const payload = {
      name: localProfile.name || 'Игрок',
      ava: localProfile.ava || '🐣',
      elo: localProfile.elo || 0,
      friends: localProfile.friends || [],
      friendRequests: localProfile.friendRequests || [],
      owned: localProfile.owned || ['classic'],
      lastNickChange: localProfile.lastNickChange || 0,
      customAva: localProfile.customAva || null,
      playerId: localProfile.playerId || null
    };
    if(!snap.exists) {
      // Создание документа: полная инициализация (create разрешает всё кроме gems > 0)
      payload.coins = localProfile.coins || 0;
      payload.gems = 0;
      payload.ratings = localProfile.ratings || { classic: 0, bot: 0, fischer: 0, meme: 0, ranked: 0 };
      payload.wins = (localProfile.st || {}).wins || 0;
      payload.games = (localProfile.st || {}).games || 0;
    } else {
      const cloud = snap.data();
      if(typeof cloud.gems === 'number') {
        localProfile.gems = cloud.gems;
      }
      const cloudCoins = typeof cloud.coins === 'number' ? cloud.coins : 0;
      if((localProfile.coins || 0) <= cloudCoins) {
        payload.coins = localProfile.coins || 0; // трата — разрешена правилами
      }
      // local > cloud: прирост (напр. офлайн) не пишем — его делает submitResult/awardCoins
      if(cloud.ratings && typeof cloud.ratings === 'object') {
        localProfile.ratings = cloud.ratings;
      }
    }
    await ref.set(payload, { merge: true });
  }
};
