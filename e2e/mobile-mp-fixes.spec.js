const { test, expect } = require('@playwright/test');

/* ============================================================
   v0.25.3 — мобильный/мультиплеерный фидбек:
   1) видео жёстко привязано к клетке (%, внутри #boardBox)
   2) тап пропускает видео и разблокирует ход
   3) выбор видео детерминированный (оба игрока видят одно и то же)
   4) чат убран сверху на мобильных, есть FAB-выдвижная панель
   5) MP-чат/эмоции: отправка и получение
   6) в MP-партии метка режима — «против игрока», не бота
   7) сжатые взятые фигуры (letter-spacing) убраны
   ============================================================ */

async function boot(page, opts = {}) {
  await page.route('**://www.gstatic.com/**', r =>
    r.fulfill({ contentType: 'application/javascript', body: '/* stubbed for e2e */' }));
  await page.addInitScript(() => { try { localStorage.setItem('chesher_visited', '1'); } catch(e) {} });
  if (opts.stubVideoPlay) {
    await page.addInitScript(() => {
      // 1) autoplay в headless не должен отклоняться → элемент не удаляется сразу
      try { HTMLMediaElement.prototype.play = function() { return Promise.resolve(); }; } catch(e) {}
      // 2) В headless-Chromium нет H.264 → <video> кидает error и исчезает до assertions.
      //    Глотаем error/ended на медиа-элементах: видео живёт до safety-таймера (5с).
      try {
        const orig = HTMLMediaElement.prototype.addEventListener;
        HTMLMediaElement.prototype.addEventListener = function(type) {
          if (type === 'error' || type === 'ended') return;
          return orig.apply(this, arguments);
        };
      } catch(e) {}
    });
  }
  await page.goto('/');
  await page.waitForFunction(() => typeof cfg !== 'undefined' && typeof newGame === 'function', null, { timeout: 20000 });
  await page.waitForTimeout(250);
}

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e && e.message || e)));
  return errors;
}

test.describe('Мобильный/MP фидбек v0.25.3', () => {

  /* ---------- 1+2: видео на клетке, тап пропускает ---------- */
  test('мем-видео: привязано к клетке (% внутри boardBox), тап пропускает и открывает ход', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page, { stubVideoPlay: true });

    // Я — чёрные, «входящий» ход белых: Ra1-a8+ (шах без взятия → сразу видео, без пистолетов)
    await page.evaluate(() => {
      cfg.gameMode = 'meme'; cfg.modeId = 'meme'; cfg.bot = 'easy'; cfg.human = 'b'; cfg.timeSec = 0; cfg.memes = true;
      MemeConfig.set('enabled', true);
      botMove = function() {};
      newGame();
      hideAllScreens();
      S.loadFen('6k1/8/8/8/8/8/8/R6K w - - 0 1');
      S.humanColor = 'b';
      document.getElementById('boardBox').classList.add('flipped');
      fullRender();
      const m = S.getLegalMoves(7, 0).find(x => x.tr === 0 && x.tc === 0);
      executeMove(m);
    });
    // Шах всегда даёт взятие-кандидат → сначала фаза пистолетов (~3.4с), потом видео
    await page.waitForFunction(() => document.querySelectorAll('.memeCheckVideo').length > 0, null, { timeout: 8000 });
    await page.waitForTimeout(100);

    const v = await page.evaluate(() => {
      const el = document.querySelector('.memeCheckVideo');
      if(!el) return null;
      const st = el.style;
      return {
        locked: MemeThreatHandler.isVideoLocked(),
        canTouch: window._canTouchBoard ? _canTouchBoard() : null,
        parentId: el.parentNode ? el.parentNode.id : '',
        left: st.left, top: st.top, width: st.width, height: st.height,
        fixed: getComputedStyle(el).position
      };
    });
    expect(v, 'видео должно появиться после шаха').not.toBeNull();
    expect(v.locked, 'ход должен быть заблокирован на время видео').toBe(true);
    expect(v.canTouch, 'доска недоступна во время видео').toBe(false);
    expect(v.parentId, 'видео лежит ВНУТРИ #boardBox — едет вместе с доской').toBe('boardBox');
    expect(v.fixed, 'видео — absolute, не fixed').toBe('absolute');
    expect(v.width).toBe('12.5%');
    expect(v.height).toBe('12.5%');
    expect(parseFloat(v.left) / 12.5).toBeCloseTo(Math.round(parseFloat(v.left) / 12.5), 5);
    expect(parseFloat(v.top) / 12.5).toBeCloseTo(Math.round(parseFloat(v.top) / 12.5), 5);

    // Тап по видео пропускает анимацию
    await page.dispatchEvent('.memeCheckVideo', 'pointerdown');
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => ({
      locked: MemeThreatHandler.isVideoLocked(),
      n: document.querySelectorAll('.memeCheckVideo').length
    }))).toEqual({ locked: false, n: 0 });

    // После пропуска можно ходить: король g8 → h7
    await page.click('#grid .sq[data-r="0"][data-c="6"]');
    expect(await page.locator('#grid .sq.sel').count()).toBeGreaterThan(0);
    await page.click('#grid .sq[data-r="1"][data-c="7"]');
    expect(await page.evaluate(() => S.board[1][7] === 'k' && S.turn === 'w')).toBe(true);

    // Второй раунд: снова шах → тап ПО ДОСКЕ пропускает анимацию (пистолеты/видео)
    await page.evaluate(() => {
      const m = S.getLegalMoves(0, 0).find(x => x.tr === 1 && x.tc === 0);
      executeMove(m);
    });
    await page.waitForTimeout(700);
    expect(await page.evaluate(() => MemeThreatHandler.isVideoLocked()), 'блокировка активна (фаза пистолетов)').toBe(true);

    await page.click('#grid .sq[data-r="3"][data-c="3"]');
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => ({
      locked: MemeThreatHandler.isVideoLocked(),
      n: document.querySelectorAll('.memeCheckVideo').length
    }))).toEqual({ locked: false, n: 0 });

    // И снова можно ходить: король h7 → h8
    await page.click('#grid .sq[data-r="1"][data-c="7"]');
    expect(await page.locator('#grid .sq.sel').count()).toBeGreaterThan(0);
    await page.click('#grid .sq[data-r="0"][data-c="7"]');
    expect(await page.evaluate(() => S.board[0][7] === 'k' && S.turn === 'w')).toBe(true);

    expect(errors).toEqual([]);
  });

  /* ---------- 3: синхронизация выбора видео ---------- */
  test('выбор видео детерминированный: один seed — одно видео на обоих клиентах', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(() => {
      const vp = JSON.parse(JSON.stringify(MemeConfig.get('videoPresets')));
      vp.capture = { w: ['video/a.mp4', 'video/b.mp4', 'video/c.mp4'], b: ['video/d.mp4'] };
      MemeConfig.set('videoPresets', vp);
      const seed1 = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1|capture|w|';
      const seed2 = 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1|capture|w|';
      const a = MemeConfig.getVideoForEvent('capture', 'w', null, seed1);
      const b = MemeConfig.getVideoForEvent('capture', 'w', null, seed1);
      const c = MemeConfig.getVideoForEvent('capture', 'w', null, seed2);
      const d = MemeConfig.getVideoForEvent('capture', 'w', null, seed2);
      const noSeed = MemeConfig.getVideoForEvent('capture', 'w', null);
      return {
        a, b, c, d, noSeed,
        inArr: ['video/a.mp4', 'video/b.mp4', 'video/c.mp4'].includes(c),
        one: MemeConfig.getVideoForEvent('capture', 'b', null, seed1)
      };
    });
    expect(r.a, 'одинаковый seed → одинаковое видео').toBe(r.b);
    expect(r.c, 'одинаковый seed → одинаковое видео (2)').toBe(r.d);
    expect(r.inArr, 'выбранное видео из списка').toBe(true);
    expect(r.noSeed, 'без seed выбор остаётся из списка').toBeTruthy();
    expect(r.one, 'для чёрных свой список').toBe('video/d.mp4');
  });

  /* ---------- 6: MP — «против игрока», не бота ---------- */
  test('MP: метка режима и панель соперника не показывают «против бота»', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);

    const mp = await page.evaluate(() => {
      ChesMP.lobbySettings = { mode: 'classic', ranked: false, timeSec: 0, timeInc: 0 };
      ChesMP.opponent = { name: 'Тестер', ava: '🎭' };
      startMultiplayerGame('w', 'Тестер');
      return {
        label: document.getElementById('modeLabel').textContent,
        nameTop: document.getElementById('nameTop').textContent,
        gameMode: cfg.gameMode,
        bot: cfg.bot
      };
    });
    expect(mp.label).toContain('Против игрока');
    expect(mp.label, 'в MP не должно быть «против бота»').not.toContain('бот');
    expect(mp.nameTop).toContain('Тестер');
    expect(mp.nameTop, 'в имени соперника не должен быть эмодзи бота').not.toContain('🤖');
    expect(mp.gameMode).toBe('multiplayer');
    expect(mp.bot).toBe('off');

    // Рейтинговая: тоже «против игрока»
    const ranked = await page.evaluate(() => {
      ChesMP.lobbySettings = { mode: 'classic', ranked: true, timeSec: 0, timeInc: 0 };
      startMultiplayerGame('w', 'Тестер');
      return document.getElementById('modeLabel').textContent;
    });
    expect(ranked).toContain('Против игрока');
    expect(ranked).toContain('ELO');
    expect(ranked).not.toContain('бот');

    expect(errors).toEqual([]);
  });

  /* ---------- 5: MP-чат и эмоции ---------- */
  test('MP-чат: API отправки, входящие сообщения и эмоции доходят', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);

    const api = await page.evaluate(() => ({
      sendChat: typeof ChesMP.sendChat,
      sendEmote: typeof ChesMP.sendEmote,
      onChat: typeof ChesMP.onChat,
      handle: typeof Chat.handleIncomingMp
    }));
    expect(api).toEqual({ sendChat: 'function', sendEmote: 'function', onChat: 'function', handle: 'function' });

    await page.evaluate(() => {
      ChesMP.lobbySettings = { mode: 'classic', ranked: false, timeSec: 0, timeInc: 0 };
      ChesMP.opponent = { name: 'Тестер', ava: '🎭' };
      startMultiplayerGame('w', 'Тестер');
      // шпион вместо реальной записи в RTDB
      ChesMP.sendChat = t => { window.__mpSent = t; return true; };
      ChesMP.sendEmote = e => { window.__mpEmote = e; return true; };
    });

    // Отправка: своё сообщение уходит в ChesMP.sendChat
    await page.fill('#chatInput', 'gg wp');
    await page.click('#chatSend');
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => window.__mpSent)).toBe('gg wp');
    expect(await page.locator('#chatMsgs .chatMsg.me').count()).toBeGreaterThan(0);

    // Отправка эмоции: уходит как эмоция, не как сообщение
    await page.evaluate(() => Chat.sendEmoji('bot', '😎'));
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => window.__mpEmote)).toBe('😎');
    expect(await page.evaluate(() => window.__mpSent), 'эмоция не уходит текстом').toBe('gg wp');

    // Входящее сообщение отображается с именем соперника
    await page.evaluate(() => Chat.handleIncomingMp({ by: 'other', text: 'привет из лобби' }));
    const oppMsg = page.locator('#chatMsgs .chatMsg.opp').last();
    await expect(oppMsg).toContainText('привет из лобби');
    await expect(oppMsg).toContainText('Тестер');

    // Входящая эмоция — летит над доской
    await page.evaluate(() => Chat.handleIncomingMp({ by: 'other', emoji: '😂' }));
    expect(await page.locator('#boardBox div[style*="flyE"]').count()).toBeGreaterThan(0);

    // Колбэк ChesMP.onChat зарегистрирован главным стартом игры
    expect(await page.evaluate(() => typeof ChesMP._chatCallback)).toBe('function');

    expect(errors).toEqual([]);
  });

  /* ---------- 4: чат на мобильных ---------- */
  test('мобильный ≤900px: чата сверху нет, FAB открывает выдвижную панель', async ({ page }) => {
    const errors = trackErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await boot(page);
    await page.evaluate(() => {
      cfg.gameMode = 'bot'; cfg.modeId = 'bot'; cfg.bot = 'easy'; cfg.human = 'w'; cfg.timeSec = 0;
      botMove = function() {};
      newGame();
      hideAllScreens();
    });
    await page.waitForTimeout(300);

    // Чат сверху убран, FAB-кнопка видна
    expect(await page.locator('#leftCol .chatBox').isVisible(), 'чат сверху на мобильных убран').toBe(false);
    expect(await page.locator('#btnChat').isVisible(), 'FAB-кнопка чата должна быть видна').toBe(true);

    // FAB открывает выдвижную панель
    await page.click('#btnChat');
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => document.body.classList.contains('chat-open'))).toBe(true);
    expect(await page.locator('#leftCol .chatBox').isVisible(), 'панель чата открывается снизу').toBe(true);
    expect(await page.locator('#chatMsgs').isVisible()).toBe(true);

    // Повторный тап закрывает
    await page.click('#btnChat');
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => document.body.classList.contains('chat-open'))).toBe(false);
    expect(await page.locator('#leftCol .chatBox').isVisible()).toBe(false);

    expect(errors).toEqual([]);
  });

  /* ---------- 5+7: мелочи ---------- */
  test('viewport-fit=cover подключён; взятые фигуры без сжатия', async ({ page }) => {
    await boot(page);
    const vp = await page.evaluate(() => {
      const m = document.querySelector('meta[name="viewport"]');
      return m ? m.getAttribute('content') : '';
    });
    expect(vp).toContain('viewport-fit=cover');

    const spacing = await page.evaluate(() => {
      document.body.classList.add('mobile-mode');
      cfg.gameMode = 'bot'; cfg.modeId = 'bot'; cfg.bot = 'easy'; cfg.human = 'w'; cfg.timeSec = 0;
      botMove = function() {};
      newGame();
      hideAllScreens();
      const el = document.querySelector('.pbar .taken');
      return getComputedStyle(el).letterSpacing;
    });
    expect(spacing, 'letter-spacing:-1px сжимал фигуры').not.toBe('-1px');
  });
});
