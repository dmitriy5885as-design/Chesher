const { test, expect } = require('@playwright/test');

/* ============================================================
   ЧЕШЕР v0.24.1 — сценарное тестирование по директиве QA
   ============================================================ */

async function boot(page) {
  await page.route('**://www.gstatic.com/**', r =>
    r.fulfill({ contentType: 'application/javascript', body: '/* stubbed for e2e */' }));
  await page.addInitScript(() => { try { localStorage.setItem('chesher_visited', '1'); } catch(e) {} });
  await page.goto('/');
  await page.waitForFunction(() => typeof cfg !== 'undefined' && typeof newGame === 'function', null, { timeout: 20000 });
  await page.waitForTimeout(250);
}

async function startGame(page, opts = {}) {
  const { human = 'w', timeSec = 0, stubBot = true } = opts;
  await page.evaluate(({ human, timeSec, stubBot }) => {
    cfg.gameMode = 'bot'; cfg.modeId = 'bot'; cfg.bot = 'easy';
    cfg.human = human; cfg.timeSec = timeSec;
    if (stubBot) botMove = function() { window.__botStub = (window.__botStub || 0) + 1; };
    newGame();
    hideAllScreens();
    if (window.ACHS && ProfilesManager.getCurrent()) {
      const cu = ProfilesManager.getCurrent();
      ACHS.forEach(a => { if (!cu.ach[a.id]) cu.ach[a.id] = 1; });
      saveProfiles();
    }
  }, { human, timeSec, stubBot });
  await page.waitForTimeout(250);
}

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e && e.message || e)));
  return errors;
}

test.describe('v0.24.1 — сценарии директивы', () => {

  /* ---------- СМОУК (§5) ---------- */
  test('смоук: меню → партия → ход → сдача → результат → новая → меню → F5', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);
    await startGame(page);

    // ход кликами
    await page.click('#grid .sq[data-r="6"][data-c="4"]');
    await page.click('#grid .sq[data-r="4"][data-c="4"]');
    expect(await page.evaluate(() => S.board[4][4] === 'P' && S.turn === 'b')).toBe(true);

    const before = await page.evaluate(() => {
      const cu = ProfilesManager.getCurrent();
      return { coins: cu.coins, elo: cu.ratings.bot, hist: cu.matchHistory.length };
    });

    // сдача через UI
    await page.click('#btnRes');
    await expect(page.locator('#ovConf')).toBeVisible();
    await page.click('#confY');
    await page.waitForTimeout(700);

    await expect(page.locator('#ovOver')).toBeVisible();
    await expect(page.locator('#goT')).toContainText('Поражение');
    await expect(page.locator('#goS')).toContainText('Сдача');

    const after = await page.evaluate(() => {
      const cu = ProfilesManager.getCurrent();
      return { coins: cu.coins, elo: cu.ratings.bot, hist: cu.matchHistory.length, res: cu.matchHistory[cu.matchHistory.length - 1] };
    });
    expect(after.coins).toBe(before.coins);           // за поражение монет нет
    expect(after.elo).toBeLessThan(before.elo);       // ELO упал
    expect(after.hist).toBe(before.hist + 1);         // история записана
    expect(after.res.result).toBe('loss');
    expect(after.res.reason).toBe('Сдача');

    // новая партия
    await page.click('#overNew');
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => !S.gameOver && S.moveHistory.length === 0)).toBe(true);
    expect(await page.locator('#ovOver').isVisible()).toBe(false);

    // в меню
    await page.click('#btnGoMenu');
    await expect(page.locator('#scrMenu')).toBeVisible();

    // F5
    await page.reload();
    await page.waitForFunction(() => typeof cfg !== 'undefined' && typeof newGame === 'function', null, { timeout: 20000 });
    await page.waitForTimeout(300);
    await expect(page.locator('#scrMenu')).toBeVisible();
    expect(errors).toEqual([]);
  });

  /* ---------- ИСХОДЫ ПАРТИИ (§10) ---------- */
  test('исход: мат — «Мат» и «Поражение»', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);
    await startGame(page);
    await page.evaluate(() => {
      S.loadFen('rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq g3 0 2');
      S.humanColor = 'w'; fullRender();
      const m = S.getLegalMoves(0, 3).find(x => x.tr === 4 && x.tc === 7);
      executeMove(m); // Qd8-h4#
    });
    await page.waitForTimeout(800);
    await expect(page.locator('#ovOver')).toBeVisible();
    await expect(page.locator('#goT')).toContainText('Поражение');
    await expect(page.locator('#goS')).toContainText('Мат');
    expect(errors).toEqual([]);
  });

  test('исход: пат — «Пат» и «Ничья»', async ({ page }) => {
    await boot(page);
    await startGame(page);
    await page.evaluate(() => {
      S.loadFen('7k/5P2/8/6K1/8/8/8/8 w - - 0 1');
      S.humanColor = 'w'; fullRender();
      const m = S.getLegalMoves(3, 6).find(x => x.tr === 2 && x.tc === 6);
      executeMove(m); // Kg5-g6 → пат
    });
    await page.waitForTimeout(800);
    await expect(page.locator('#ovOver')).toBeVisible();
    await expect(page.locator('#goT')).toContainText('Ничья');
    await expect(page.locator('#goS')).toContainText('Пат');
  });

  test('исход: недостаток материала (K+B vs K+B) — без ошибки движка', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);
    await startGame(page);
    await page.evaluate(() => {
      S.loadFen('7k/8/8/8/6B1/8/8/K6b w - - 0 1');
      S.humanColor = 'w'; fullRender();
      const m = S.getLegalMoves(7, 0).find(x => x.tr === 7 && x.tc === 1);
      executeMove(m); // Ka1-b1 → ничья по материалу
    });
    await page.waitForTimeout(800);
    await expect(page.locator('#ovOver')).toBeVisible();
    await expect(page.locator('#goS')).toContainText('Недостаток материала');
    expect(errors, 'в консоли не должно быть необработанных исключений').toEqual([]);
  });

  test('исход: таймер — «Время вышло», часы останавливаются после конца', async ({ page }) => {
    await boot(page);
    await startGame(page, { timeSec: 5 });
    const clockRunning = await page.evaluate(() => S.clockOn === true);
    expect(clockRunning).toBe(true);
    await page.waitForTimeout(6500);
    await expect(page.locator('#ovOver')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#goS')).toContainText('Время вышло');
    const t1 = await page.locator('#clkTop').textContent();
    await page.waitForTimeout(1600);
    const t2 = await page.locator('#clkTop').textContent();
    expect(t2, 'часы должны стоять после конца партии').toBe(t1);
  });

  /* ---------- ELO-КОНСИСТЕНТНОСТЬ (§11) ---------- */
  test('ELO: чип на экране конца == профиль == меню == запись истории', async ({ page }) => {
    await boot(page);
    await startGame(page);
    const before = await page.evaluate(() => {
      const cu = ProfilesManager.getCurrent();
      cu.botId = 11; // «Капитан Шах» rating 1000 — иначе прирост против бота-100 округляется в 0
      cu.ratings.bot = 1000; cu.ratings.classic = 1000; cu.elo = 1000;
      saveProfiles();
      return { elo: cu.ratings.bot };
    });

    await page.evaluate(() => { endGame('checkmate', S.humanColor); });
    await page.waitForTimeout(500);
    await expect(page.locator('#ovOver')).toBeVisible();

    const data = await page.evaluate(() => {
      const cu = ProfilesManager.getCurrent();
      return {
        chip: document.getElementById('goStats') ? document.getElementById('goStats').textContent : '',
        after: cu.ratings.bot,
        classic: cu.ratings.classic,
        legacyElo: cu.elo,
        hist: cu.matchHistory[cu.matchHistory.length - 1],
        st: { games: cu.st.games, wins: cu.st.wins }
      };
    });
    const delta = data.after - 1000;
    expect(delta).toBeGreaterThan(0);
    expect(data.chip, 'чип ELO на оверлее').toContain('+' + delta);
    expect(data.chip, 'чип монет').toContain('🪙 +10');
    expect(data.hist.eloChange).toBe(delta);
    expect(data.st.wins).toBe(1);
    expect(data.legacyElo, 'legacy cu.elo == ratings.classic (единый источник для профиля)').toBe(data.classic);

    // профиль (открывается из меню): карточка показывает тот же рейтинг
    await page.click('#overMenu');
    await expect(page.locator('#scrMenu')).toBeVisible();
    await page.click('#profBar');
    await expect(page.locator('#scrProf')).toBeVisible();
    await page.waitForTimeout(300);
    const menuElo = await page.evaluate(() => {
      const el = document.querySelector('#plCard .plElo');
      return el ? el.textContent : '';
    });
    expect(menuElo, 'карточка профиля').toContain(String(data.classic));
    expect(menuElo, 'профиль == cu.elo (legacy)').toContain(String(data.legacyElo));
  });

  /* ---------- МАГАЗИН (§13) ---------- */
  test('магазин: покупка списывает монеты один раз, переживает F5, нехватка монет', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
      const cu = ProfilesManager.getCurrent();
      ACHS.forEach(a => { cu.ach[a.id] = 1; });
      cu.addCoins(500);
      saveProfiles();
    });
    await page.click('#mShop');
    await page.waitForTimeout(400);
    await page.click('#shopTabs .shopTab[data-tab="boards"]');
    await page.waitForTimeout(400);

    // ищем купленную доску с ценой > 0
    const target = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('.buyBtn[data-type="board"]')];
      for (const b of btns) {
        const id = b.dataset.id;
        const board = BOARDS[id];
        if (board && board.price > 0 && !ProfilesManager.getCurrent().owned.includes('board_' + id)) {
          return { id, price: board.price };
        }
      }
      return null;
    });
    expect(target, 'в магазине должна быть платная доска').not.toBeNull();

    const coinsBefore = await page.evaluate(() => ProfilesManager.getCurrent().coins);
    const btn = page.locator('.buyBtn[data-type="board"][data-id="' + target.id + '"]');
    await btn.click();
    await page.waitForTimeout(300);
    await btn.click({ force: true }); // повторный клик по уже купленному
    await page.waitForTimeout(300);

    const bought = await page.evaluate((id) => {
      const cu = ProfilesManager.getCurrent();
      return {
        coins: cu.coins,
        times: cu.owned.filter(o => o === 'board_' + id).length,
        board: cfg.board
      };
    }, target.id);
    expect(bought.coins, 'списана ровно одна цена').toBe(coinsBefore - target.price);
    expect(bought.times, 'в owned ровно один раз').toBe(1);
    expect(bought.board, 'доска экипирована сразу').toBe(target.id);

    // F5: покупка и экипировка сохраняются
    await page.reload();
    await page.waitForFunction(() => typeof cfg !== 'undefined' && typeof newGame === 'function', null, { timeout: 20000 });
    await page.waitForTimeout(300);
    const persisted = await page.evaluate((id) => ({
      owned: ProfilesManager.getCurrent().owned.includes('board_' + id),
      board: cfg.board
    }), target.id);
    expect(persisted.owned).toBe(true);
    expect(persisted.board).toBe(target.id);

    // нехватка монет: обнуляем и пробуем купить другую доску
    await page.click('#mShop');
    await page.waitForTimeout(300);
    await page.click('#shopTabs .shopTab[data-tab="boards"]');
    await page.waitForTimeout(300);
    const poor = await page.evaluate(() => {
      const cu = ProfilesManager.getCurrent();
      cu.coins = 0; saveProfiles(); renderCoins();
      const btns = [...document.querySelectorAll('.buyBtn[data-type="board"]')];
      for (const b of btns) {
        const id = b.dataset.id;
        if (BOARDS[id] && BOARDS[id].price > 0 && !cu.owned.includes('board_' + id)) return id;
      }
      return null;
    });
    if (poor) {
      await page.locator('.buyBtn[data-type="board"][data-id="' + poor + '"]').click();
      await page.waitForTimeout(300);
      const res = await page.evaluate((id) => ({
        coins: ProfilesManager.getCurrent().coins,
        owned: ProfilesManager.getCurrent().owned.includes('board_' + id)
      }), poor);
      expect(res.coins).toBe(0);
      expect(res.owned).toBe(false);
      const toastTxt = await page.locator('#toast').textContent();
      expect(toastTxt).toContain('Не хватает');
    }
  });

  /* ---------- ПРОФИЛЬ (§12) ---------- */
  test('профиль: карточка стабильна после F5, история партии на месте', async ({ page }) => {
    await boot(page);
    await startGame(page);
    await page.evaluate(() => endGame('checkmate', S.humanColor));
    await page.waitForTimeout(500);
    await page.click('#overMenu');
    await expect(page.locator('#scrMenu')).toBeVisible();

    await page.click('#profBar');
    await page.waitForTimeout(400);
    const card1 = await page.evaluate(() => {
      const el = document.getElementById('plCard');
      return el ? el.textContent.replace(/\s+/g, ' ') : null;
    });
    expect(card1).not.toBeNull();
    expect(card1).toContain('1');

    await page.reload();
    await page.waitForFunction(() => typeof cfg !== 'undefined' && typeof newGame === 'function', null, { timeout: 20000 });
    await page.waitForTimeout(300);
    await page.click('#profBar');
    await page.waitForTimeout(400);
    await page.click('#profTabs .shopTab[data-tab="history"]');
    await page.waitForTimeout(300);
    const hist = await page.evaluate(() => {
      const cu = ProfilesManager.getCurrent();
      return { n: cu.matchHistory.length, rows: document.querySelectorAll('#profTabHistory .histRow, #matchHistory > div').length };
    });
    expect(hist.n).toBeGreaterThanOrEqual(1);
    expect(hist.rows).toBeGreaterThanOrEqual(1);
  });

  /* ---------- ПОДАРОК (§15) ---------- */
  test('ежедневный подарок: гостю кнопка неактивна (без повторной выдачи)', async ({ page }) => {
    await boot(page);
    const st = await page.evaluate(() => ({
      disabled: document.getElementById('giftBtn').classList.contains('disabled'),
      title: document.getElementById('giftBtn').title
    }));
    expect(st.disabled, 'гость не может забрать подарок').toBe(true);
    expect(st.title).toContain('Войдите');
    const coins = await page.evaluate(() => ProfilesManager.getCurrent().coins);
    await page.click('#giftBtn', { force: true });
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => ProfilesManager.getCurrent().coins)).toBe(coins);
  });

  /* ---------- ДОСТИЖЕНИЯ (§15) ---------- */
  test('достижения: выдаются один раз, награда не дублируется после F5', async ({ page }) => {
    await boot(page);
    await startGame(page);
    const b = await page.evaluate(() => {
      const cu = ProfilesManager.getCurrent();
      cu.ach = {}; cu.coins = 100; saveProfiles();
      return { coins: 100 };
    });
    await page.evaluate(() => endGame('checkmate', S.humanColor));
    await page.waitForTimeout(1500); // тосты наград идут с задержкой 650мс
    const a1 = await page.evaluate(() => {
      const cu = ProfilesManager.getCurrent();
      return { coins: cu.coins, ach: Object.keys(cu.ach).length };
    });
    expect(a1.ach).toBeGreaterThanOrEqual(1);
    expect(a1.coins).toBeGreaterThan(b.coins);

    await page.reload();
    await page.waitForFunction(() => typeof cfg !== 'undefined' && typeof newGame === 'function', null, { timeout: 20000 });
    await page.waitForTimeout(400);
    const a2 = await page.evaluate(() => {
      const cu = ProfilesManager.getCurrent();
      return { coins: cu.coins, ach: Object.keys(cu.ach).length };
    });
    expect(a2.ach).toBe(a1.ach);
    expect(a2.coins, 'F5 не должен дописывать награды').toBe(a1.coins);
  });

  /* ---------- ОТМЕНА/ПОДСКАЗКА (§7) ---------- */
  test('отмена хода после 2 полных ходов возвращает ход человеку (без зависания)', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);
    await startGame(page, { stubBot: false });
    // бот отвечает первым допустимым ходом — детерминированно достаточно
    await page.evaluate(() => {
      botMove = function() {
        const ms = S.allLegalMoves(S.turn);
        if (ms.length) executeMove(ms[0]);
      };
    });
    // ход 1
    await page.click('#grid .sq[data-r="6"][data-c="4"]');
    await page.click('#grid .sq[data-r="4"][data-c="4"]');
    await page.waitForFunction(() => S.moveHistory.length >= 2 && S.turn === 'w', null, { timeout: 5000 });
    // ход 2
    await page.click('#grid .sq[data-r="7"][data-c="6"]');
    await page.click('#grid .sq[data-r="5"][data-c="5"]');
    await page.waitForFunction(() => S.moveHistory.length >= 4 && S.turn === 'w', null, { timeout: 5000 });

    await page.click('#btnUndo');
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => ({
      hist: S.moveHistory.length,
      turn: S.turn,
      undos: document.getElementById('undoN').textContent
    }));
    expect(r.turn, 'после отмены ходит человек').toBe('w');
    expect(r.hist, 'отменены только свои 2 хода (4 → 2)').toBe(2);
    expect(r.undos).toContain('(2)');
    // доска живая: можно выделить свою фигуру (после отмены конь вернулся на g1)
    await page.click('#grid .sq[data-r="7"][data-c="6"]');
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => !!(selected && selected.r === 7)), 'конь на g1 выделяется').toBe(true);
    expect(errors).toEqual([]);
  });

  test('подсказка: работает и не ломает состояние', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);
    await startGame(page);
    await page.click('#btnHint');
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => ({
      hint: !!hintMove,
      left: document.getElementById('hintN').textContent
    }));
    expect(r.left).toContain('(1)');
    expect(errors).toEqual([]);
    // после подсказки ход возможен
    await page.click('#grid .sq[data-r="6"][data-c="4"]');
    await page.click('#grid .sq[data-r="4"][data-c="4"]');
    expect(await page.evaluate(() => S.board[4][4] === 'P')).toBe(true);
  });

  /* ---------- БЫСТРЫЕ КЛИКИ (§28) ---------- */
  test('быстрые клики: двойное нажатие отмены и хаотичные тапы не роняют игру', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);
    await startGame(page);
    await page.click('#grid .sq[data-r="6"][data-c="4"]');
    await page.click('#grid .sq[data-r="4"][data-c="4"]');
    await page.waitForTimeout(300);
    await page.click('#btnUndo');
    await page.click('#btnUndo', { force: true });
    for (let r = 0; r < 8; r++) {
      await page.click('#grid .sq[data-r="' + r + '"][data-c="' + r + '"]', { force: true });
    }
    await page.waitForTimeout(400);
    const ok = await page.evaluate(() => ({ alive: typeof S !== 'undefined' && !S.gameOver, turn: S.turn }));
    expect(ok.alive).toBe(true);
    expect(errors).toEqual([]);
  });

  /* ---------- ТАЙМЕРЫ (§8) ---------- */
  test('таймеры: часы идут в игре и тикают по 1 сек', async ({ page }) => {
    await boot(page);
    await startGame(page, { timeSec: 60 });
    const t0 = await page.evaluate(() => ({ ...S.time }));
    await page.waitForTimeout(2300);
    const t1 = await page.evaluate(() => ({ ...S.time }));
    expect(t1.w).toBeLessThanOrEqual(t0.w - 1);
    expect(t1.w).toBeGreaterThanOrEqual(t0.w - 3);
  });

  /* ---------- РЕЖИМ ВОССТАНОВЛЕНИЯ (§23) ---------- */
  test('resume: если сохранён ход бота — бот отвечает после восстановления', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
      cfg.gameMode = 'bot'; cfg.modeId = 'bot'; cfg.bot = 'easy';
      cfg.human = 'w'; cfg.timeSec = 0;
      window.__origBot = botMove;
      botMove = function() { window.__stubbed = (window.__stubbed || 0) + 1; };
      newGame();
      const m = S.getLegalMoves(6, 4).find(x => x.tr === 4 && x.tc === 4);
      executeMove(m);          // ход белых; авто-таймер бота — заглушка
      S.saveToStorage();       // сохранение: ход бота
      botMove = window.__origBot; // возвращаем настоящего бота
    });
    await page.waitForTimeout(1600); // даём заглушке-таймеру отработать
    await page.evaluate(() => resumeGame());
    await page.waitForTimeout(2500);
    const turn = await page.evaluate(() => S.turn);
    expect(turn, 'после resume бот должен был ответить').toBe('w');
  });

  test('resume: из меню плавающие кнопки (🎁 ?) скрыты в игре', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
      cfg.gameMode = 'bot'; cfg.modeId = 'bot'; cfg.bot = 'easy';
      cfg.human = 'w'; cfg.timeSec = 0;
      botMove = function() {};
      newGame();       // прямой вызов из меню — как при resume-пути
      hideAllScreens();
    });
    await page.waitForTimeout(300);
    const floats = await page.evaluate(() => {
      const ids = ['helpBtn', 'giftBtn', 'friendsFloatBtn', 'cornerFloat', 'phoneBtn', 'qrBtn'];
      return ids.map(id => {
        const el = document.getElementById(id);
        return { id, disp: el ? el.style.display : 'gone' };
      });
    });
    for (const f of floats) {
      expect(f.disp, f.id + ' должен быть скрыт в игре').toBe('none');
    }
  });

  /* ---------- МОДАЛКИ (§29) ---------- */
  test('askConfirm: отмена не оставляет «висящий» обработчик', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(() => {
      window.__c = 0;
      askConfirm('T1', 'x', () => { window.__c += 1; });
      document.querySelector('[data-close="ovConf"]').click(); // «Нет»
      askConfirm('T2', 'x', () => { window.__c += 10; });
      document.getElementById('confY').click();
      return { c: window.__c, open: document.getElementById('ovConf').classList.contains('show') };
    });
    expect(r.c, 'сработал только подтверждённый обработчик').toBe(10);
    expect(r.open).toBe(false);
  });

  test('ESC закрывает обычную модалку (помощь)', async ({ page }) => {
    await boot(page);
    await page.click('#helpBtn');
    await expect(page.locator('#ovHelp')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await expect(page.locator('#ovHelp')).toBeHidden();
  });

  test('промо-модалка: обязательна, фон/ESC не закрывают, выбор применяется', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);
    await startGame(page);
    await page.evaluate(() => {
      S.loadFen('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
      S.humanColor = 'w'; fullRender();
    });
    await page.click('#grid .sq[data-r="1"][data-c="0"]');
    await page.click('#grid .sq[data-r="0"][data-c="0"]');
    await expect(page.locator('#ovPr')).toBeVisible();

    // клик по фону (вне модалки)
    await page.mouse.click(8, 8);
    await page.waitForTimeout(200);
    await expect(page.locator('#ovPr'), 'промо нельзя закрыть фоном').toBeVisible();

    // ESC тоже не должен закрывать
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await expect(page.locator('#ovPr'), 'промо нельзя закрыть ESC').toBeVisible();

    // выбор ферзя
    await page.click('.promoP[data-p="q"]');
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => ({ q: S.board[0][0], pawn: S.board[1][0], open: document.getElementById('ovPr').classList.contains('show') }));
    expect(r.q).toBe('Q');
    expect(r.pawn).toBe(null);
    expect(r.open).toBe(false);
    expect(errors).toEqual([]);
  });

  /* ---------- НАВИГАЦИЯ (§21) ---------- */
  test('назад: Настройка лобби → Мультиплеер (не в главное меню)', async ({ page }) => {
    await boot(page);
    await page.click('#mPlay');
    await page.waitForTimeout(400);
    await expect(page.locator('#scrMulti')).toBeVisible();
    await page.click('#mpCreateBtn');
    await page.waitForTimeout(400);
    await expect(page.locator('#scrLobbySetup')).toBeVisible();
    await page.click('#scrLobbySetup .backBtn');
    await page.waitForTimeout(300);
    await expect(page.locator('#scrMulti'), 'назад из настройки лобби ведёт в мультиплеер').toBeVisible();
  });

  test('назад: Рейтинговая → Режимы', async ({ page }) => {
    await boot(page);
    await page.click('#mModes');
    await page.waitForTimeout(400);
    await page.locator('.modeCard').filter({ has: page.locator('.nm', { hasText: /^Рейтинговая$/ }) }).click();
    await page.waitForTimeout(400);
    await expect(page.locator('#scrRanked')).toBeVisible();
    await page.click('#scrRanked .backBtn');
    await page.waitForTimeout(300);
    await expect(page.locator('#scrModes'), 'назад из рейтинговой ведёт в режимы').toBeVisible();
  });

  test('назад: Настройки → девблог → назад в настройки (мобильный вьюпорт)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await boot(page);
    await page.click('#mSettings');
    await page.waitForTimeout(400);
    await expect(page.locator('#scrSet')).toBeVisible();
    const link = page.locator('#devblogBtnMob');
    if (await link.isVisible()) {
      await link.click();
      await page.waitForTimeout(400);
      await expect(page.locator('#scrDevblog')).toBeVisible();
      await page.click('#scrDevblog .backBtn');
      await page.waitForTimeout(300);
      await expect(page.locator('#scrSet'), 'назад из девблога пришёл в настройки').toBeVisible();
    }
  });

  /* ---------- F5 НА ЭКРАНАХ (§23) ---------- */
  test('F5: после перезагрузки на любом экране приложение восстанавливается в меню', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);
    const entries = ['#mShop', '#profBar', '#mSettings', '#mModes', '#mPlay'];
    for (const sel of entries) {
      await page.click(sel);
      await page.waitForTimeout(400);
      await page.reload();
      await page.waitForFunction(() => typeof cfg !== 'undefined' && typeof newGame === 'function', null, { timeout: 20000 });
      await page.waitForTimeout(350);
      await expect(page.locator('#scrMenu'), 'после F5 (' + sel + ') — меню').toBeVisible();
    }
    expect(errors).toEqual([]);
  });

  /* ---------- ЧАТ (§18) ---------- */
  test('чат: панель открывается, класс chat-open снимается при выходе в меню', async ({ page }) => {
    // #btnChat — мобильный FAB: включаем мобильный режим (phoneBtn / chesher_mobile)
    await page.addInitScript(() => { try { localStorage.setItem('chesher_mobile', 'on'); } catch(e) {} });
    await page.setViewportSize({ width: 390, height: 844 });
    await boot(page);
    await startGame(page);
    await page.click('#btnChat');
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => document.body.classList.contains('chat-open'))).toBe(true);
    // панель чата (z:1300, fixed) по дизайну перекрывает кнопки игры — переход в меню вызываем напрямую;
    // фикс: showScreen снимает chat-open с любого экрана
    await page.evaluate(() => showScreen('scrMenu'));
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => document.body.classList.contains('chat-open')), 'chat-open должен сниматься при смене экрана').toBe(false);
  });

  /* ---------- РЕЖИМЫ: ФИШЕР (§20) ---------- */
  test('Фишер 960: стартует с валидной неклассической расстановкой', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);
    await page.evaluate(() => {
      cfg.variant = 'fischer960'; cfg.modeId = 'fischer'; cfg.gameMode = 'fischer';
      cfg.bot = 'easy'; cfg.human = 'w'; cfg.timeSec = 0;
      botMove = function() {};
      newGame();
      hideAllScreens();
    });
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => {
      const back = S.board[7].join('');
      const bi = S.board[7].map((p, i) => p === 'B' ? i : -1).filter(i => i >= 0);
      return {
        variant: S.variant,
        multiset: back.split('').sort().join(''),
        bishops: bi.length === 2 && (bi[0] % 2) !== (bi[1] % 2),
        kingBetweenRooks: back.indexOf('K') > back.indexOf('R') && back.lastIndexOf('K') < back.lastIndexOf('R'),
        standard: back === 'RNBQKBNR'
      };
    });
    expect(r.variant).toBe('fischer960');
    expect(r.multiset).toBe('BBKNNQRR');
    expect(r.bishops, 'слоны на разных цветах').toBe(true);
    expect(r.kingBetweenRooks).toBe(true);
    expect(r.standard, 'расстановка должна отличаться от классической').toBe(false);
    // ход возможен
    const m = await page.evaluate(() => {
      const ms = S.allLegalMoves('w');
      if (ms.length) executeMove(ms[0]);
      return ms.length;
    });
    expect(m).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  /* ---------- РЕПЛЕЙ (§17) ---------- */
  test('история → просмотр партии: реплей открывается и закрывается', async ({ page }) => {
    await boot(page);
    await startGame(page);
    await page.evaluate(() => {
      const m = S.getLegalMoves(6, 4).find(x => x.tr === 4 && x.tc === 4);
      executeMove(m);
      endGame('resign', S.humanColor === 'w' ? 'b' : 'w');
    });
    await page.waitForTimeout(500);
    await page.click('#overMenu');
    await expect(page.locator('#scrMenu')).toBeVisible();
    const opened = await page.evaluate(() => {
      openReplay(0);
      return document.getElementById('ovReplay') && document.getElementById('ovReplay').classList.contains('show');
    });
    expect(opened).toBe(true);
    const hasMove = await page.evaluate(() => document.getElementById('ovReplay').textContent.includes('e4'));
    expect(hasMove, 'в реплее есть ход e4').toBe(true);
    await page.evaluate(() => closeOv('ovReplay'));
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => document.getElementById('ovReplay').classList.contains('show'))).toBe(false);
  });

  /* ---------- МЕМАСИЯ: ПИСТОЛЕТЫ (§6) ---------- */
  test('мемасия: пистолет появляется при взятии и исчезает после конца партии', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);
    await page.evaluate(() => {
      cfg.modeId = 'meme'; cfg.gameMode = 'meme'; cfg.bot = 'easy'; cfg.human = 'w'; cfg.timeSec = 0;
      MemeConfig.set('enabled', true);
      botMove = function() {};
      newGame();
      hideAllScreens();
      // N d4xe6 — после взятия конь на e6 атакует только ферзя c7 (слева) → один пистолет guns_left
      S.loadFen('6k1/2q5/4p3/8/3N4/8/8/4K3 w - - 0 1');
      S.humanColor = 'w';
      fullRender();
    });
    await page.waitForTimeout(300);

    await page.evaluate(() => {
      const m = S.getLegalMoves(4, 3).find(x => x.tr === 2 && x.tc === 4);
      executeMove(m);
    });
    await page.waitForTimeout(600);
    const gunsInfo = await page.evaluate(() => {
      const guns = [...document.querySelectorAll('.memeGun')];
      return {
        n: guns.length,
        srcs: guns.map(g => { const i = g.querySelector('img'); return i ? i.getAttribute('src') : ''; }),
        locked: MemeThreatHandler.isVideoLocked()
      };
    });
    expect(gunsInfo.n, 'пистолет должен появиться при взятии').toBeGreaterThanOrEqual(1);

    // цель (ферзь c7) слева от атакующей клетки e6 → guns_left
    expect(gunsInfo.srcs[0]).toContain('guns_left');

    // фаза 2: конец партии В ТОМ ЖЕ ТИКЕ, что и ход (< 200мс) — хвостовой setTimeout(checkMove, 200)
    // не должен навесить пистолеты/блокировку уже ПОСЛЕ конца
    await page.evaluate(() => {
      S.loadFen('6k1/2q5/4p3/8/3N4/8/8/4K3 w - - 0 1');
      S.gameOver = false;
      S.humanColor = 'w';
      const m = S.getLegalMoves(4, 3).find(x => x.tr === 2 && x.tc === 4);
      executeMove(m);
      endGame('resign', 'b');
    });
    await page.waitForTimeout(800);
    const after = await page.evaluate(() => ({
      guns: document.querySelectorAll('.memeGun').length,
      videos: document.querySelectorAll('.memeCheckVideo').length,
      locked: MemeThreatHandler.isVideoLocked()
    }));
    expect(after.guns, 'пистолеты убраны после конца партии').toBe(0);
    expect(after.videos, 'видео убраны после конца партии').toBe(0);
    expect(after.locked, 'нет зависшей блокировки хода').toBe(false);

    // ещё одна проверка спустя время — «хвостовой» таймер не появился позже
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => document.querySelectorAll('.memeGun').length), 'нет пистолетов после конца (хвостовой таймер)').toBe(0);
    expect(errors).toEqual([]);
  });

  /* ---------- КОНСОЛЬ (§33) ---------- */
  test('консоль: сквозной прогон без необработанных исключений', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);
    await page.click('#mModes'); await page.waitForTimeout(250);
    await page.locator('.modeCard').filter({ has: page.locator('.nm', { hasText: /^Классика$/ }) }).click();
    await page.waitForTimeout(300);
    const cfgOpen = await page.evaluate(() => {
      const el = document.getElementById('modesCfg');
      return el && el.style.display !== 'none';
    });
    if (cfgOpen) {
      // запуск из панели настроек режима
      const startBtn = page.locator('#modesCfg button').filter({ hasText: /Играть|Начать/ }).first();
      if (await startBtn.count()) await startBtn.click();
      else await page.evaluate(() => { newGame(); hideAllScreens(); });
    } else {
      await page.evaluate(() => { newGame(); hideAllScreens(); });
    }
    await page.waitForTimeout(500);
    await page.click('#grid .sq[data-r="6"][data-c="4"]');
    await page.click('#grid .sq[data-r="4"][data-c="4"]');
    await page.waitForTimeout(800);
    await page.click('#btnGoMenu');
    await page.waitForTimeout(400);
    expect(errors).toEqual([]);
  });

  /* ---------- RESPONSIVE (§24) ---------- */
  for (const vp of [{ w: 320, h: 700 }, { w: 375, h: 812 }, { w: 390, h: 844 }, { w: 414, h: 896 }, { w: 768, h: 1024 }, { w: 1024, h: 768 }, { w: 1366, h: 768 }]) {
    test('responsive ' + vp.w + '×' + vp.h + ': меню/магазин/игра без горизонтального скролла', async ({ page }) => {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await boot(page);

      const checkScreen = async (label) => {
        const r = await page.evaluate(() => {
          const s = document.querySelector('.screen.show');
          return s ? { sw: s.scrollWidth, cw: s.clientWidth } : { sw: 0, cw: 0 };
        });
        expect(r.sw, label + ' @' + vp.w + ': ' + r.sw + ' > ' + r.cw).toBeLessThanOrEqual(r.cw + 1);
      };
      await checkScreen('меню');

      await page.click('#mShop'); await page.waitForTimeout(350);
      await checkScreen('магазин');
      await page.click('#scrShop .backBtn'); await page.waitForTimeout(250);

      await page.evaluate(() => {
        cfg.gameMode = 'bot'; cfg.modeId = 'bot'; cfg.bot = 'easy'; cfg.human = 'w'; cfg.timeSec = 0;
        botMove = function() {};
        newGame(); hideAllScreens();
      });
      await page.waitForTimeout(350);
      const body = await page.evaluate(() => ({ sw: document.body.scrollWidth, iw: window.innerWidth }));
      expect(body.sw, 'игра @' + vp.w + ': ' + body.sw + ' > ' + body.iw).toBeLessThanOrEqual(body.iw + 1);
    });
  }
});
