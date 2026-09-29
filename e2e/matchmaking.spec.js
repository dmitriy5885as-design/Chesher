const { test, expect } = require('@playwright/test');

/* ============================================================
   ЧЕШЕР v0.25.0 — быстрый матч (мэтчмейкинг)
   ============================================================ */

async function boot(page) {
  await page.route('**://www.gstatic.com/**', r =>
    r.fulfill({ contentType: 'application/javascript', body: '/* stubbed for e2e */' }));
  await page.addInitScript(() => { try { localStorage.setItem('chesher_visited', '1'); } catch(e) {} });
  await page.goto('/');
  await page.waitForFunction(() => typeof cfg !== 'undefined' && typeof ChesMM !== 'undefined', null, { timeout: 20000 });
  await page.waitForTimeout(250);
}

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e && e.message || e)));
  return errors;
}

test.describe('v0.25.0 — быстрый матч', () => {

  test('pickPair: детерминированный выбор пары', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);

    const res = await page.evaluate(() => {
      const out = {};
      // два участника → пара по ts
      const two = {
        a: { uid: 'u1', sid: 'sA', ts: 100 },
        b: { uid: 'u2', sid: 'sB', ts: 200 }
      };
      const p1 = ChesMM.pickPair(two, 'sA');
      const p2 = ChesMM.pickPair(two, 'sB');
      out.hostFirst = p1.host.sid === 'sA' && p1.guest.sid === 'sB';
      out.sameFromBoth = JSON.stringify({ h: p1.host.sid, g: p1.guest.sid }) ===
                         JSON.stringify({ h: p2.host.sid, g: p2.guest.sid });
      // ничья по ts → хост по ключу; порядок ключей не влияет
      const tie1 = { aaa: { uid: 'u1', sid: 's1', ts: 50 }, zzz: { uid: 'u2', sid: 's2', ts: 50 } };
      const tie2 = { zzz: { uid: 'u2', sid: 's2', ts: 50 }, aaa: { uid: 'u1', sid: 's1', ts: 50 } };
      out.tieByKey = ChesMM.pickPair(tie1, 's1').host.key === 'aaa' &&
                     ChesMM.pickPair(tie2, 's1').host.key === 'aaa';
      // мой sid не в паре → null
      out.notMine = ChesMM.pickPair(two, 'sX') === null;
      // один участник → null
      out.single = ChesMM.pickPair({ a: { uid: 'u1', sid: 'sA', ts: 100 } }, 'sA') === null;
      // мусорные записи игнорируются
      const dirty = {
        x: { uid: 'u1' },
        y: { uid: 'u2', sid: 's2' },
        a: { uid: 'u1', sid: 'sA', ts: 10 },
        b: { uid: 'u2', sid: 'sB', ts: 20 },
        c: { uid: 'u3', sid: 'sC', ts: 'NaN' }
      };
      const p3 = ChesMM.pickPair(dirty, 'sA');
      out.filtered = p3 && p3.host.sid === 'sA' && p3.guest.sid === 'sB';
      out.empty = ChesMM.pickPair(null, 's') === null && ChesMM.pickPair({}, 's') === null;
      return out;
    });

    expect(res).toEqual({
      hostFirst: true,
      sameFromBoth: true,
      tieByKey: true,
      notMine: true,
      single: true,
      filtered: true,
      empty: true
    });
    expect(errors).toEqual([]);
  });

  test('я старший в очереди → становлюсь хостом: createLobby + scrLobby', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);

    const r = await page.evaluate(async () => {
      const calls = { create: 0, listen: 0, showLobby: null, updated: null };
      ChesMP.createLobby = async () => { calls.create++; return '-NfakeLobbyId1'; };
      ChesMP._listenGame = () => { calls.listen++; };
      NetUI._showLobby = (id, status) => { calls.showLobby = { id: id, status: status }; };
      ChesMM._sid = 'mine';
      ChesMM.active = true;
      ChesMM.phase = 'searching';
      ChesMM._joinTried = {};
      ChesMM._startedAt = Date.now();
      ChesMM._myRef = { update: async d => { calls.updated = d; }, remove: async () => {} };

      ChesMM._reeval({
        a: { uid: 'u1', sid: 'mine', ts: 100 },
        b: { uid: 'u2', sid: 'other', ts: 200 }
      });
      // ждём асинхронный _doHost
      for(let i = 0; i < 40 && calls.create === 0; i++) await new Promise(r => setTimeout(r, 25));
      await new Promise(r => setTimeout(r, 50));
      return { calls: calls, phase: ChesMM.phase, active: ChesMM.active };
    });

    expect(r.calls.create).toBe(1);
    expect(r.calls.listen, '_listenGame хоста').toBe(1);
    expect(r.calls.showLobby).toEqual({ id: '-NfakeLobbyId1', status: 'Ищем соперника…' });
    expect(r.calls.updated).toEqual({ lobby: '-NfakeLobbyId1' });
    expect(r.phase).toBe('hosting');
    expect(r.active).toBe(true);
    await expect(page.locator('#scrLobby')).toBeVisible();

    // отмена сбрасывает очередь и возвращает в сетевое меню
    await page.evaluate(() => { ChesMP.lobbyId = null; ChesMM.cancel('Отменено'); });
    const after = await page.evaluate(() => ({ active: ChesMM.active, phase: ChesMM.phase }));
    expect(after).toEqual({ active: false, phase: 'idle' });
    await expect(page.locator('#scrMulti')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('чужой хост с лобби → joinLobby, успех: scrLobby и очистка очереди', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);

    const r = await page.evaluate(async () => {
      const calls = { joined: [], showLobby: null, removed: false };
      ChesMP.joinLobby = async id => { calls.joined.push(id); return true; };
      NetUI._showLobby = (id, status) => { calls.showLobby = { id: id, status: status }; };
      ChesMM._sid = 'mine';
      ChesMM.active = true;
      ChesMM.phase = 'searching';
      ChesMM._joinTried = {};
      ChesMM._startedAt = Date.now();
      ChesMM._myRef = { update: async () => {}, remove: async () => { calls.removed = true; } };
      ChesMM._queueRef = { off: () => {} };
      ChesMM._cb = () => {};

      // у хоста уже есть lobby → я подключаюсь, а не сам становлюсь хостом
      ChesMM._reeval({
        h: { uid: 'u1', sid: 'host1', ts: 50, lobby: '-NhostLobby1' },
        m: { uid: 'u2', sid: 'mine', ts: 100 }
      });
      for(let i = 0; i < 40 && calls.joined.length === 0; i++) await new Promise(r => setTimeout(r, 25));
      await new Promise(r => setTimeout(r, 50));
      return {
        calls: calls,
        phase: ChesMM.phase,
        active: ChesMM.active,
        tried: Object.keys(ChesMM._joinTried || {})
      };
    });

    expect(r.calls.joined).toEqual(['-NhostLobby1']);
    expect(r.calls.showLobby).toEqual({ id: '-NhostLobby1', status: 'Подключено! Готовьтесь...' });
    expect(r.calls.removed, 'запись в очереди удалена').toBe(true);
    expect(r.phase).toBe('joined');
    expect(r.active, 'поиск завершён').toBe(false);
    expect(r.tried).toEqual(['-NhostLobby1']);
    await expect(page.locator('#scrLobby')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('joinLobby не удался → без повторов по тому же лобби', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);

    const r = await page.evaluate(async () => {
      const calls = { joined: [] };
      ChesMP.joinLobby = async id => { calls.joined.push(id); return false; }; // занято/снято
      ChesMM._sid = 'mine';
      ChesMM.active = true;
      ChesMM.phase = 'searching';
      ChesMM._joinTried = {};
      ChesMM._startedAt = Date.now();
      ChesMM._myRef = { update: async () => {}, remove: async () => {} };

      const list = {
        h: { uid: 'u1', sid: 'host1', ts: 50, lobby: '-NhostLobby1' },
        m: { uid: 'u2', sid: 'mine', ts: 100 }
      };
      ChesMM._reeval(list);
      await new Promise(r => setTimeout(r, 100));
      const phaseAfterFail = ChesMM.phase;
      // повторный ревал той же очереди — попытки нет (запомнена)
      ChesMM._reeval(list);
      await new Promise(r => setTimeout(r, 100));
      return {
        joined: calls.joined,
        phaseAfterFail: phaseAfterFail,
        phaseFinal: ChesMM.phase,
        active: ChesMM.active,
        tried: Object.keys(ChesMM._joinTried || {})
      };
    });

    expect(r.joined, 'ровно одна попытка').toEqual(['-NhostLobby1']);
    expect(r.phaseAfterFail).toBe('searching');
    expect(r.phaseFinal).toBe('searching');
    expect(r.active).toBe(true); // поиск продолжается
    expect(r.tried).toEqual(['-NhostLobby1']);
    expect(errors).toEqual([]);
  });

  test('деградация: start() без Firebase и кнопка «🎲 Случайный матч»', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);

    // Прямой вызов: нет firebaseRtdb → аккуратно отказываемся
    const direct = await page.evaluate(async () => {
      const ok = await ChesMM.start();
      return { ok: ok, active: ChesMM.active, phase: ChesMM.phase };
    });
    expect(direct.ok).toBe(false);
    expect(direct.active).toBe(false);
    expect(direct.phase).toBe('idle');
    await expect(page.locator('#toast')).toContainText('временно недоступен');

    // Кнопка в сетевом меню: нет авторизации → тост, без pageerror
    await page.click('#mPlay');
    await expect(page.locator('#scrMulti')).toBeVisible();
    await page.click('#mpRandomBtn');
    await expect(page.locator('#toast')).toContainText('Нужна авторизация');
    const st = await page.evaluate(() => ({ active: ChesMM.active, status: document.getElementById('mpStatus').textContent }));
    expect(st.active).toBe(false);
    expect(errors).toEqual([]);
  });
});
