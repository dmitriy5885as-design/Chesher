/**
 * ЧЕШЕР — Система друзей (Firestore)
 * Поиск, заявки, принятие/отклонение, список друзей
 */
"use strict";

const ChesFriends = {
  _cache: [],
  _listeners: [],

  /* --- Поиск пользователей --- */
  async search(query) {
    if(!firebaseDB || !query || query.length < 2) return [];
    const results = [];
    const seen = new Set();

    // Search by name
    const nameSnap = await firebaseDB.collection('users')
      .orderBy('name')
      .startAt(query)
      .endAt(query + '\uf8ff')
      .limit(10)
      .get();
    nameSnap.forEach(doc => {
      const d = doc.data();
      seen.add(doc.id);
      results.push({ uid: doc.id, name: d.name, ava: d.ava || '🐣', elo: d.elo || 0, playerId: d.playerId || null });
    });

    // Also search by UID (if query looks like a UID — at least 8 chars)
    if(query.length >= 8 && !seen.has(query)) {
      try {
        const uidDoc = await firebaseDB.collection('users').doc(query).get();
        if(uidDoc.exists) {
          const d = uidDoc.data();
          results.unshift({ uid: uidDoc.id, name: d.name, ava: d.ava || '🐣', elo: d.elo || 0 });
        }
      } catch(e) {}
    }

    return results;
  },

  /* --- Отправить заявку в друзья --- */
  async sendRequest(targetUid) {
    if(!firebaseDB || !ChesAuth.user) return false;
    const myUid = ChesAuth.getUid();
    if(myUid === targetUid) return false;

    const myRef = firebaseDB.collection('users').doc(myUid);
    const mySnap = await myRef.get();
    const myData = mySnap.data();

    if((myData.friends || []).includes(targetUid)) return false;
    if((myData.friendRequests || []).includes(targetUid)) return false;

    const targetRef = firebaseDB.collection('users').doc(targetUid);
    await targetRef.update({
      friendRequests: firebase.firestore.FieldValue.arrayUnion(myUid)
    });
    return true;
  },

  /* --- Принять заявку --- */
  async acceptRequest(fromUid) {
    if(!firebaseDB || !ChesAuth.user) return false;
    const myUid = ChesAuth.getUid();
    const myRef = firebaseDB.collection('users').doc(myUid);
    const fromRef = firebaseDB.collection('users').doc(fromUid);

    await myRef.update({
      friends: firebase.firestore.FieldValue.arrayUnion(fromUid),
      friendRequests: firebase.firestore.FieldValue.arrayRemove(fromUid)
    });
    await fromRef.update({
      friends: firebase.firestore.FieldValue.arrayUnion(myUid)
    });

    this._refreshFriends();
    return true;
  },

  /* --- Отклонить заявку --- */
  async rejectRequest(fromUid) {
    if(!firebaseDB || !ChesAuth.user) return;
    const myUid = ChesAuth.getUid();
    const myRef = firebaseDB.collection('users').doc(myUid);
    await myRef.update({
      friendRequests: firebase.firestore.FieldValue.arrayRemove(fromUid)
    });
  },

  /* --- Удалить друга --- */
  async removeFriend(uid) {
    if(!firebaseDB || !ChesAuth.user) return;
    const myUid = ChesAuth.getUid();
    const myRef = firebaseDB.collection('users').doc(myUid);
    const otherRef = firebaseDB.collection('users').doc(uid);

    await myRef.update({ friends: firebase.firestore.FieldValue.arrayRemove(uid) });
    await otherRef.update({ friends: firebase.firestore.FieldValue.arrayRemove(myUid) });
    this._refreshFriends();
  },

  /* --- Получить список друзей --- */
  async getFriends() {
    if(!firebaseDB || !ChesAuth.user) return [];
    const myUid = ChesAuth.getUid();
    const mySnap = await firebaseDB.collection('users').doc(myUid).get();
    const myData = mySnap.data();
    const friendUids = myData.friends || [];
    if(friendUids.length === 0) return [];

    const friends = [];
    for(const uid of friendUids) {
      const snap = await firebaseDB.collection('users').doc(uid).get();
      if(snap.exists) {
        const d = snap.data();
        friends.push({ uid, name: d.name, ava: d.ava || '🐣', elo: d.elo || 0, online: false });
      }
    }

    // Check online status via RTDB
    if(firebaseRtdb) {
      const statusSnap = await firebaseRtdb.ref('status').once('value');
      const statuses = statusSnap.val() || {};
      friends.forEach(f => {
        f.online = statuses[f.uid] && (Date.now() - statuses[f.uid].lastSeen < 60000);
      });
    }

    this._cache = friends;
    this._listeners.forEach(fn => fn(friends));
    return friends;
  },

  /* --- Получить заявки --- */
  async getRequests() {
    if(!firebaseDB || !ChesAuth.user) return [];
    const myUid = ChesAuth.getUid();
    const mySnap = await firebaseDB.collection('users').doc(myUid).get();
    const requestUids = (mySnap.data() || {}).friendRequests || [];
    if(requestUids.length === 0) return [];

    const requests = [];
    for(const uid of requestUids) {
      const snap = await firebaseDB.collection('users').doc(uid).get();
      if(snap.exists) {
        const d = snap.data();
        requests.push({ uid, name: d.name, ava: d.ava || '🐣', elo: d.elo || 0 });
      }
    }
    return requests;
  },

  /* --- Слушатель обновлений --- */
  onChange(fn) { this._listeners.push(fn); },

  async _refreshFriends() {
    await this.getFriends();
  }
};
