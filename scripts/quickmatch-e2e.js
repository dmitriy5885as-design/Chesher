#!/usr/bin/env node
/**
 * ЧЕШЕР — живой двухстраничный тест «Быстрый матч»
 * Два независимых браузерных контекста ищут друг друга через реальный
 * RTDB, создают лобби, готовятся и начинают партию; проверяется синхронизация
 * FEN и хода между страницами.
 *
 * Запуск:  node scripts/quickmatch-e2e.js
 *          BASE_URL=https://dmitriy5885as-design.github.io/Chesher/ node scripts/quickmatch-e2e.js (прод)
 * Нужно:   интернет (реальный Firebase SDK) + выкаченные правила
 *          database.rules.json (узел matchmaking) и вход firebase login.
 *          localhost:8000 поднимется автоматически, если не запущен.
 */
'use strict';

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const { chromium } = require('@playwright/test');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8000/';
const ROOT = path.resolve(__dirname, '..');
const T = ms => new Date(ms).toISOString().slice(11, 23);
const log = (...a) => console.log('[' + T(Date.now()) + ']', ...a);
let spawnedServer = null;

function serverUp() {
  return new Promise(res => {
    const req = http.get(BASE, r => { r.resume(); res(true); });
    req.on('error', () => res(false));
    req.setTimeout(1500, () => { req.destroy(); res(false); });
  });
}

async function ensureServer() {
  if(await serverUp()) { log('сервер уже запущен'); return; }
  log('запускаю python -m http.server 8000...');
  spawnedServer = spawn('python', ['-m', 'http.server', '8000'], { cwd: ROOT, detached: true, stdio: 'ignore' });
  spawnedServer.unref();
  for(let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 500));
    if(await serverUp()) { log('сервер готов'); return; }
  }
  throw new Error('localhost:8000 не поднялся');
}

async function bootPage(ctx, name) {
  const page = await ctx.newPage();
  page.on('pageerror', e => log(`[${name}] pageerror:`, String(e && e.message || e).slice(0, 200)));
  await page.addInitScript(() => { try { localStorage.setItem('chesher_visited', '1'); } catch(e) {} });
  await page.goto(BASE);
  await page.waitForFunction(
    () => typeof cfg !== 'undefined' && typeof ChesMM !== 'undefined' && typeof ChesAuth !== 'undefined',
    null, { timeout: 25000 });
  return page;
}

async function diagnostics(page, name) {
  try {
    return await page.evaluate(() => ({
      screen: [...document.querySelectorAll('.screen.show')].map(s => s.id).join(','),
      mpStatus: (document.getElementById('mpStatus') || {}).textContent || '',
      toast: (document.getElementById('toast') || {}).textContent || '',
      mmActive: typeof ChesMM !== 'undefined' ? ChesMM.active : null,
      mmPhase: typeof ChesMM !== 'undefined' ? ChesMM.phase : null,
      auth: !!(typeof ChesAuth !== 'undefined' && ChesAuth.user)
    }));
  } catch(e) { return { name, err: e.message }; }
}

async function quickMatch(page, name) {
  await page.click('#mPlay');
  await page.waitForSelector('#scrMulti', { state: 'visible', timeout: 10000 });
  // Ждём анонимный вход (auto-login в showMultiplayerMenu)
  try {
    await page.waitForFunction(() => !!(typeof ChesAuth !== 'undefined' && ChesAuth.user), null, { timeout: 15000 });
  } catch(e) {
    const d = await diagnostics(page, name);
    throw new Error(`${name}: нет анонимного входа в Firebase. ${JSON.stringify(d)}`);
  }
  await page.click('#mpRandomBtn');
}

async function waitScreen(page, sel, timeout, name) {
  try {
    await page.waitForSelector(sel, { state: 'visible', timeout });
  } catch(e) {
    const d = await diagnostics(page, name);
    throw new Error(`${name}: не дождались «${sel}» за ${timeout}ms. ${JSON.stringify(d)}` +
      (d.toast && d.toast.includes('временно недоступен')
        ? ' → похоже, правила database.rules.json (узел matchmaking) не выкачены: firebase deploy --only database'
        : ''));
  }
}

async function main() {
  const t0 = Date.now();
  if(process.env.BASE_URL) log('боевой URL:', BASE);
  else await ensureServer();

  const browser = await chromium.launch({ headless: true });
  try {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const A = await bootPage(ctxA, 'A');
    const B = await bootPage(ctxB, 'B');
    log('обе страницы загружены');

    // Оба ищут друг друга одновременно: лобби создаётся только при паре в очереди
    await Promise.all([quickMatch(A, 'A'), quickMatch(B, 'B')]);
    log('оба в поиске');

    await waitScreen(A, '#scrLobby', 40000, 'A');
    log(`A: лобби создано (+${Date.now() - t0}ms)`);
    await waitScreen(B, '#scrLobby', 40000, 'B');
    log(`B: подключился к лобби (+${Date.now() - t0}ms)`);

    // Оба видят кнопку «Готов» (значит, состав показан)
    await A.waitForSelector('#lobbyReadyBtn', { state: 'visible', timeout: 20000 });
    await B.waitForSelector('#lobbyReadyBtn', { state: 'visible', timeout: 20000 });
    await A.click('#lobbyReadyBtn');
    await B.click('#lobbyReadyBtn');
    log('оба нажали «Готов»');

    // Хост: оба готовы → «Начать партию» активна
    const hostPage = await A.evaluate(() => typeof ChesMP !== 'undefined' && ChesMP._isHost) ? A : B;
    const guestPage = hostPage === A ? B : A;
    await hostPage.waitForFunction(() => {
      const d = (typeof NetUI !== 'undefined' && NetUI._lastLobbyData) || null;
      return d && d.hostReady && d.guestReady;
    }, null, { timeout: 20000 });
    await hostPage.click('#lobbyStartBtn');
    log('хост нажал «🚀 Начать партию»');

    // Обе страницы в игре
    for(const [pg, nm] of [[A, 'A'], [B, 'B']]) {
      await pg.waitForFunction(
        () => typeof cfg !== 'undefined' && cfg.gameMode === 'multiplayer' &&
              typeof S !== 'undefined' && S && document.getElementById('boardBox') &&
              document.getElementById('boardBox').offsetParent !== null,
        null, { timeout: 40000 });
    }
    log(`партия началась (+${Date.now() - t0}ms)`);

    // Синхронизация: одинаковый FEN, цвета разные
    const st = await Promise.all([A, B].map(p => p.evaluate(() => ({
      fen: S.toFen(), color: S.humanColor, turn: S.turn
    }))));
    if(st[0].fen !== st[1].fen) throw new Error('FEN не совпадает: ' + JSON.stringify(st));
    const colors = [st[0].color, st[1].color].sort().join('');
    if(colors !== 'bw') throw new Error('цвета не разные: ' + JSON.stringify(st));
    log('FEN синхронизирован, цвета w/b:', JSON.stringify(st));

    // Ход белых (e2-e4) на странице белых → виден чёрным
    const white = st[0].color === 'w' ? A : B;
    const black = white === A ? B : A;
    await white.click('#grid .sq[data-r="6"][data-c="4"]');
    await white.waitForTimeout(150);
    await white.click('#grid .sq[data-r="4"][data-c="4"]');
    await black.waitForFunction(
      () => typeof S !== 'undefined' && S && S.board[4][4] === 'P' && S.turn === 'b',
      null, { timeout: 15000 });
    log(`ход e2-e4 дошёл до чёрных (+${Date.now() - t0}ms)`);

    console.log('\n✅ QUICKMATCH PASS — поиск, лобби, готовность, старт и синхронизация хода');
  } finally {
    await browser.close().catch(() => {});
    if(spawnedServer) { try { process.kill(-spawnedServer.pid); } catch(e) {} }
  }
}

main().then(() => process.exit(0)).catch(e => {
  console.error('\n❌ QUICKMATCH FAIL:', e.message);
  process.exit(1);
});
