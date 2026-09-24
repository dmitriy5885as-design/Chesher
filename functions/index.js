/**
 * CHESHER — Cloud Functions
 * - submitResult: серверная запись результата партии (античит: лимиты, капы, ELO)
 * - awardCoins:   серверная выдача монет за события (ежедневный бонус, подарок и т.д.)
 * - grantGems:     выдача донатных кристаллов (только сервер: admin-claim / верификация платежа)
 *
 * Правила: клиент НЕ может увеличить coins/ratings/wins/games/gems в Firestore (firestore.rules).
 * Все приросты идут только через эти функции (Admin SDK обходит правила).
 */
'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

/* --- Константы экономики --- */
const RESULT_COINS = { win: 10, draw: 3, loss: 0 };
const MODES = ['classic', 'bot', 'fischer', 'meme', 'ranked'];
const RESULTS = ['win', 'loss', 'draw'];

const RESULT_HOURLY_LIMIT = 20;   // не более 20 завершений партий в час
const MATCH_DAILY_COIN_CAP = 300; // не более 300 монет/сутки с партий
const AWARD_HOURLY_LIMIT = 60;    // не более 60 выдач наград в час

// Капы на reason: сколько максимум можно получить по причине за сутки
const AWARD_CAPS = {
  daily: { max: 25, perDay: 25 },
  gift: { max: 50, perDay: 50 },
  puzzle: { max: 10, perDay: 10 },
  tournament: { max: 100, perDay: 100 },
  achievement: { max: 150, perDay: 300 }
};

function todayKey(ms) {
  return new Date(ms || Date.now()).toISOString().slice(0, 10);
}

function eloAfter(elo, opponentElo, result) {
  const K = 32;
  const expected = 1 / (1 + Math.pow(10, (opponentElo - elo) / 400));
  const actual = result === 'win' ? 1 : result === 'draw' ? 0.5 : 0;
  return Math.round(elo + K * (actual - expected));
}

function requireAuth(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');
  return request.auth.uid;
}

function cleanRecent(list, now, windowMs) {
  return (Array.isArray(list) ? list : []).filter(t => typeof t === 'number' && now - t < windowMs);
}

/**
 * Результат партии. Клиент шлёт { result, mode, opponentElo, vsBot }.
 * Сервер: валидация, hourly-лимит, дневной кап монет, ELO по той же формуле,
 * что и клиент. Возвращает авторитетные { reward, coins, rating }.
 */
exports.submitResult = onCall(async (request) => {
  const uid = requireAuth(request);
  const data = request.data || {};

  const result = data.result;
  const mode = data.mode;
  if (!RESULTS.includes(result)) throw new HttpsError('invalid-argument', 'bad result');
  if (!MODES.includes(mode)) throw new HttpsError('invalid-argument', 'bad mode');

  let opponentElo = Number(data.opponentElo);
  if (!Number.isFinite(opponentElo)) opponentElo = 1000;
  opponentElo = Math.max(0, Math.min(4000, opponentElo));

  const now = Date.now();
  const userRef = db.collection('users').doc(uid);
  const limRef = userRef.collection('meta').doc('limits');

  return db.runTransaction(async (tx) => {
    const [userSnap, limSnap] = await Promise.all([tx.get(userRef), tx.get(limRef)]);
    if (!userSnap.exists) throw new HttpsError('failed-precondition', 'profile not found');
    const user = userSnap.data();
    const lim = limSnap.exists ? limSnap.data() : {};

    const resultAts = cleanRecent(lim.resultAts, now, 3600000);
    if (resultAts.length >= RESULT_HOURLY_LIMIT) {
      throw new HttpsError('resource-exhausted', 'result rate limit');
    }
    resultAts.push(now);

    const day = todayKey(now);
    const matchCoinsToday = lim.matchCoinsDay === day ? (lim.matchCoins || 0) : 0;
    const base = RESULT_COINS[result];
    const reward = Math.max(0, Math.min(base, MATCH_DAILY_COIN_CAP - matchCoinsToday));

    const ratings = user.ratings || {};
    const elo = typeof ratings[mode] === 'number' ? ratings[mode] : 1000;
    const newElo = eloAfter(elo, opponentElo, result);

    tx.update(userRef, {
      coins: admin.firestore.FieldValue.increment(reward),
      ['ratings.' + mode]: newElo,
      games: admin.firestore.FieldValue.increment(1),
      wins: admin.firestore.FieldValue.increment(result === 'win' ? 1 : 0),
      losses: admin.firestore.FieldValue.increment(result === 'loss' ? 1 : 0),
      draws: admin.firestore.FieldValue.increment(result === 'draw' ? 1 : 0),
      lastResultAt: now
    });
    tx.set(limRef, {
      resultAts,
      matchCoins: matchCoinsToday + reward,
      matchCoinsDay: day
    }, { merge: true });

    return { reward, coins: (user.coins || 0) + reward, rating: newElo };
  });
});

/**
 * Выдача монет за событие. Клиент шлёт { reason, amount }.
 * amount обрезается до per-reason дневного капа. Возвращает { granted, coins }.
 */
exports.awardCoins = onCall(async (request) => {
  const uid = requireAuth(request);
  const data = request.data || {};

  const reason = data.reason;
  const capCfg = AWARD_CAPS[reason];
  if (!capCfg) throw new HttpsError('invalid-argument', 'bad reason');

  let amount = Math.floor(Number(data.amount));
  if (!Number.isFinite(amount) || amount <= 0) throw new HttpsError('invalid-argument', 'bad amount');
  amount = Math.min(amount, capCfg.max);

  const now = Date.now();
  const day = todayKey(now);
  const userRef = db.collection('users').doc(uid);
  const limRef = userRef.collection('meta').doc('limits');

  return db.runTransaction(async (tx) => {
    const [userSnap, limSnap] = await Promise.all([tx.get(userRef), tx.get(limRef)]);
    if (!userSnap.exists) throw new HttpsError('failed-precondition', 'profile not found');
    const user = userSnap.data();
    const lim = limSnap.exists ? limSnap.data() : {};

    const awardAts = cleanRecent(lim.awardAts, now, 3600000);
    if (awardAts.length >= AWARD_HOURLY_LIMIT) {
      throw new HttpsError('resource-exhausted', 'award rate limit');
    }
    awardAts.push(now);

    const used = (lim.awardDay === day && lim.awardByReason && typeof lim.awardByReason === 'object')
      ? { ...lim.awardByReason }
      : {};
    const usedToday = used[reason] || 0;
    const grant = Math.max(0, Math.min(amount, capCfg.perDay - usedToday));
    used[reason] = usedToday + grant;

    if (grant > 0) {
      tx.update(userRef, {
        coins: admin.firestore.FieldValue.increment(grant),
        lastAwardAt: now
      });
    }
    tx.set(limRef, {
      awardAts,
      awardDay: day,
      awardByReason: used
    }, { merge: true });

    return { granted: grant, coins: (user.coins || 0) + grant };
  });
});

/**
 * Выдача донатных кристаллов 💎. Только сервер.
 * Сейчас: admin custom-claim (ручные начисления через Admin SDK).
 * TODO: верификация платежа (ЮKassa / Telegram Stars) по paymentId — когда подключим провайдер.
 */
exports.grantGems = onCall(async (request) => {
  const uid = requireAuth(request);
  const data = request.data || {};

  const amount = Math.floor(Number(data.amount));
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10000) {
    throw new HttpsError('invalid-argument', 'bad amount');
  }

  const isAdmin = !!(request.auth.token && request.auth.token.admin === true);
  if (!isAdmin) {
    throw new HttpsError('permission-denied', 'payments not connected; admin only');
  }

  const target = data.targetUid ? String(data.targetUid) : uid;
  await db.collection('users').doc(target).update({
    gems: admin.firestore.FieldValue.increment(amount)
  });
  return { granted: amount, uid: target };
});
