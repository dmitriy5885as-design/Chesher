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
    for(let i = 0; i < 4; i++) id += chars[Math.floor(Math.random() * chars.length)];
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
      } else {
        this.profile = null;
      }
      this.listeners.forEach(fn => fn(user));
    });
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

  /* --- Вход через Google --- */
  async loginGoogle() {
    if(!firebaseAuth) throw new Error('Firebase not initialized');
    const provider = new firebase.auth.GoogleAuthProvider();
    const cred = await firebaseAuth.signInWithPopup(provider);
    this.user = cred.user;
    if(cred.additionalUserInfo && cred.additionalUserInfo.isNewUser) {
      const allUsers = await firebaseDB.collection('users').limit(1).get();
      const isFirst = allUsers.empty;
      await this._createProfile(cred.user.uid, cred.user.displayName || 'Игрок');
      if(isFirst) {
        await firebaseDB.collection('users').doc(cred.user.uid).update({ admin: true });
      }
    }
    return cred.user;
  },

  /* --- Анонимный вход --- */
  async loginAnon() {
    if(!firebaseAuth) throw new Error('Firebase not initialized');
    const cred = await firebaseAuth.signInAnonymously();
    this.user = cred.user;
    try {
      const allUsers = await firebaseDB.collection('users').limit(1).get();
      const isFirst = allUsers.empty;
      await this._createProfile(cred.user.uid, 'Аноним #' + Math.floor(Math.random() * 9999));
      if(isFirst) {
        await firebaseDB.collection('users').doc(cred.user.uid).update({ admin: true });
      }
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
      // Check if this is the first user
      const allUsers = await firebaseDB.collection('users').limit(1).get();
      const isFirst = allUsers.empty;
      const isAnon = this.user && this.user.isAnonymous;
      const playerId = isAnon ? null : await this._createUniquePlayerId();
      const data = {
        name: name,
        ava: '👽',
        coins: 50,
        gems: 0,
        elo: 0,
        ratings: { classic: 0, bot: 0, fischer: 0, meme: 0 },
        friends: [],
        friendRequests: [],
        owned: ['classic', 'board_classic'],
        admin: isFirst,
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

  /* --- Синхронизировать локальный профиль с Firebase --- */
  async syncLocalToCloud(localProfile) {
    if(!firebaseDB || !this.user) return;
    const ref = firebaseDB.collection('users').doc(this.user.uid);
    const snap = await ref.get();
    if(snap.exists) {
      const cloud = snap.data();
      if(cloud.coins > localProfile.coins) {
        localProfile.coins = cloud.coins;
      }
      if(cloud.gems > localProfile.gems) {
        localProfile.gems = cloud.gems;
      }
    }
    await ref.set({
      name: localProfile.name || 'Игрок',
      ava: localProfile.ava || '🐣',
      coins: localProfile.coins || 0,
      gems: localProfile.gems || 0,
      elo: localProfile.elo || 0,
      ratings: localProfile.ratings || { classic: 0, bot: 0, fischer: 0, meme: 0 },
      friends: localProfile.friends || [],
      friendRequests: localProfile.friendRequests || [],
      owned: localProfile.owned || ['classic'],
      lastNickChange: localProfile.lastNickChange || 0,
      customAva: localProfile.customAva || null,
      wins: (localProfile.st || {}).wins || 0,
      games: (localProfile.st || {}).games || 0,
      playerId: localProfile.playerId || null
    }, { merge: true });
  }
};
