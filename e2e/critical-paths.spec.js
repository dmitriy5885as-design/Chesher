const { test, expect } = require('@playwright/test');

test.describe('CHESHER — Критические пути', () => {

  test.beforeEach(async ({ page }) => {
    // Имитируем «возвращающегося» игрока — минуем экран авторизации при первом визите
    await page.addInitScript(() => {
      try { localStorage.setItem('chesher_visited', '1'); } catch(e) {}
    });
    await page.goto('/');
    await page.waitForTimeout(1500);
  });

  // ===================== 1. Главное меню =====================
  test('Главное меню загружается', async ({ page }) => {
    await expect(page.locator('#scrMenu')).toBeVisible();
    await expect(page.locator('.logoBig h1')).toHaveText('CHESHER');
    await expect(page.locator('#mPlay')).toBeVisible();
    await expect(page.locator('#mModes')).toBeVisible();
    await expect(page.locator('#mShop')).toBeVisible();
    await expect(page.locator('#friendsFloatBtn')).toBeVisible();
  });

  // ===================== 2. Режимы =====================
  test('Экран режимов открывается и содержит карточки', async ({ page }) => {
    await page.click('#mModes');
    await page.waitForTimeout(500);

    await expect(page.locator('#scrModes')).toBeVisible();
    const cards = page.locator('.modeCard');
    await expect(cards.first()).toBeVisible();
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  // ===================== 3. Игра против бота =====================
  test('Запуск игры против бота: открывается экран выбора', async ({ page }) => {
    await page.click('#mModes');
    await page.waitForTimeout(500);

    // Кликаем «Против бота» (точное совпадение, чтобы не задеть «Классику»)
    await page.locator('.modeCard').filter({ has: page.locator('.nm', { hasText: /^Против бота$/ }) }).click();
    await page.waitForTimeout(1000);

    // Должен появиться экран выбора бота
    await expect(page.locator('#scrBots')).toBeVisible();
    await expect(page.locator('#botsGrid')).toBeVisible();

    // Должны быть карточки ботов
    const botCards = page.locator('#botsGrid .botRow, #botsGrid .botCard, #botsGrid > div');
    const count = await botCards.count();
    expect(count).toBeGreaterThanOrEqual(5);
  });

  // ===================== 4. Магазин =====================
  test('Магазин: открытие и переключение табов', async ({ page }) => {
    await page.click('#mShop');
    await page.waitForTimeout(500);

    await expect(page.locator('#scrShop')).toBeVisible();

    // Табы видны
    const tabs = page.locator('#shopTabs .shopTab');
    await expect(tabs.first()).toBeVisible();
    const tabCount = await tabs.count();
    expect(tabCount).toBe(6);

    // Кликаем «Доски»
    await page.click('#shopTabs .shopTab[data-tab="boards"]');
    await page.waitForTimeout(1000);

    // Контент обновился — карточки досок
    const items = page.locator('#shopGrid .shopItem');
    await expect(items.first()).toBeVisible({ timeout: 5000 });
  });

  // ===================== 5. Профиль =====================
  test('Профиль: открытие и вкладки', async ({ page }) => {
    await page.click('#profBar');
    await page.waitForTimeout(500);

    await expect(page.locator('#scrProf')).toBeVisible();

    // Табы профиля
    const profTabs = page.locator('#profTabs .shopTab');
    await expect(profTabs.first()).toBeVisible();
    const count = await profTabs.count();
    expect(count).toBe(4);

    // Кликаем «История»
    await page.click('#profTabs .shopTab[data-tab="history"]');
    await page.waitForTimeout(300);
    await expect(page.locator('#profTabHistory')).toBeVisible();

    // Кликаем «Настройки»
    await page.click('#profTabs .shopTab[data-tab="settings"]');
    await page.waitForTimeout(300);
    await expect(page.locator('#profTabSettings')).toBeVisible();
  });

  // ===================== 6. Настройки =====================
  test('Настройки: открытие', async ({ page }) => {
    await page.click('#mSettings');
    await page.waitForTimeout(500);

    await expect(page.locator('#scrSet')).toBeVisible();
  });

  // ===================== 7. Мультиплеер =====================
  test('Мультиплеер: кнопки создания и входа', async ({ page }) => {
    await page.click('#mPlay');
    await page.waitForTimeout(500);

    await expect(page.locator('#scrMulti')).toBeVisible();
    await expect(page.locator('#mpCreateBtn')).toBeVisible();
    await expect(page.locator('#mpJoinBtn')).toBeVisible();
    await expect(page.locator('#mpFriendsBtn')).toBeVisible();
  });

  // ===================== 8. Создание лобби (настройки) =====================
  test('Настройка лобби: экран с настройками', async ({ page }) => {
    await page.click('#mPlay');
    await page.waitForTimeout(500);

    await page.click('#mpCreateBtn');
    await page.waitForTimeout(500);

    await expect(page.locator('#scrLobbySetup')).toBeVisible();
    await expect(page.locator('#lobbyModeSeg')).toBeVisible();
    await expect(page.locator('#lobbyTimeSeg')).toBeVisible();
    await expect(page.locator('#lobbyColorSeg')).toBeVisible();
    await expect(page.locator('#lobbyConfirmBtn')).toBeVisible();
  });

  // ===================== 9. Навигация назад =====================
  test('Навигация: назад из любого экрана', async ({ page }) => {
    // Магазин → назад
    await page.click('#mShop');
    await page.waitForTimeout(500);
    await page.click('#scrShop .backBtn');
    await page.waitForTimeout(300);
    await expect(page.locator('#scrMenu')).toBeVisible();

    // Режимы → назад
    await page.click('#mModes');
    await page.waitForTimeout(500);
    await page.click('#scrModes .backBtn');
    await page.waitForTimeout(300);
    await expect(page.locator('#scrMenu')).toBeVisible();
  });

  // ===================== 10. Оверлей конца партии =====================
  test('Оверлей конца партии: кнопки включая скрытый реванш', async ({ page }) => {
    await expect(page.locator('#ovOver')).toBeAttached();
    // Кнопка «Новая партия» и меню всегда в DOM
    await expect(page.locator('#overNew')).toBeAttached();
    await expect(page.locator('#overMenu')).toBeAttached();
    // Реванш доступен только для сетевых игр — по умолчанию скрыт
    await expect(page.locator('#overRematch')).toBeHidden();
  });

  // ===================== 11. QR-код лобби =====================
  test('Лобби: отображаются QR-код и короткий код', async ({ page }) => {
    await page.evaluate(() => {
      ChesMP.lobbyCode = 'ABC234';
      showScreen('scrLobby');
      NetUI._showLobby('ABC234', 'Ожидание соперника...');
    });

    await expect(page.locator('#scrLobby')).toBeVisible();
    await expect(page.locator('#lobbyQr')).toBeVisible();
    await expect(page.locator('#lobbyIdText')).toHaveText('ABC234');
    await expect(page.locator('#lobbyCopyLink')).toBeVisible();

    const src = await page.locator('#lobbyQrImg').getAttribute('src');
    expect(src).toContain('lobby%3DABC234');
  });

  // ===================== 12. Новые карточки режимов =====================
  test('Режимы: есть карточки «Задачка дня» и «Турнир»', async ({ page }) => {
    await page.click('#mModes');
    await page.waitForTimeout(500);

    const puzzleCard = page.locator('.modeCard').filter({ has: page.locator('.nm', { hasText: /^Задачка дня$/ }) });
    const tourCard = page.locator('.modeCard').filter({ has: page.locator('.nm', { hasText: /^Турнир$/ }) });
    await expect(puzzleCard).toBeVisible();
    await expect(tourCard).toBeVisible();
  });

  // ===================== 13. Задачка дня =====================
  test('Задачка дня: запускается и решается (награда)', async ({ page }) => {
    await page.evaluate(() => { try { localStorage.removeItem('chesher_puzzle_' + _puzzleDayKey()); } catch(e) {} });
    await page.click('#mModes');
    await page.waitForTimeout(500);
    await page.locator('.modeCard').filter({ has: page.locator('.nm', { hasText: /^Задачка дня$/ }) }).click();
    await page.waitForTimeout(800);

    // Поле в игре
    await expect(page.locator('#boardBox')).toBeVisible();
    const sl = await page.locator('#statusLine').textContent();
    expect(sl).toContain('🧩');

    // Решаем: берём заготовленный ответ движка из стартовой позиции задачки
    const solved = await page.evaluate(() => {
      const eng = new ChessEngine('classic');
      eng.loadFen(_puzzle.fen);
      const m = _uciPiece(eng, _puzzle.answer);
      if(!m) return false;
      S.loadFen(_puzzle.fen);
      executeMove(m);
      return true;
    });
    expect(solved).toBe(true);

    await expect(page.locator('#ovPuzzle')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#ovPuzzle')).toContainText('Решено!');
    await page.click('#pzMenu');
    await page.waitForTimeout(300);
    await expect(page.locator('#scrMenu')).toBeVisible();
  });

  // ===================== 14. Премув в игре с ботом =====================
  test('Премув: заготовка хода во время хода бота и исполнение', async ({ page }) => {
    await page.evaluate(() => {
      cfg.gameMode = 'bot';
      cfg.modeId = 'chess';
      cfg.bot = 'easy';
      cfg.human = 'w';
      cfg.memes = false;
      cfg.timeSec = 0;
      // отключаем «думающего» бота — ходы делаем сами
      botMove = function() { window.__botSkipped = true; };
      newGame();
      hideAllScreens();
    });
    await page.waitForTimeout(400);
    await expect(page.locator('#boardBox')).toBeVisible();

    // Ходим белыми e2-e4 → теперь ход бота (чёрных)
    await page.evaluate(() => {
      const m = S.getLegalMoves(6, 5).find(x => x.tr === 4 && x.tc === 5);
      if(m) executeMove(m);
    });
    await page.waitForTimeout(300);

    // Готовим премув: пешка d2-d4, пока ход соперника
    const premoved = await page.evaluate(() => {
      if(S.turn === S.humanColor) return 'not-enemy-turn';
      const fromEl = document.querySelector('#grid .sq[data-r="6"][data-c="3"]');
      const toEl = document.querySelector('#grid .sq[data-r="4"][data-c="3"]');
      if(!fromEl || !toEl) return 'no-squares';
      _suppressClickTs = 0;
      _premoveClick({ currentTarget: fromEl });
      _premoveClick({ currentTarget: toEl });
      const set = !!(premove && premove.fr === 6 && premove.fc === 3 && premove.tr === 4 && premove.tc === 3);
      const markedFrom = fromEl.classList.contains('preF');
      const markedTo = toEl.classList.contains('preT');
      return set && markedFrom && markedTo;
    });
    expect(premoved).toBe(true);

    // Бот (мы реализуем его ход) играет e7-e5 — премув должен исполниться автоматически
    const executed = await page.evaluate(() => {
      const bt = S.getLegalMoves(1, 4).find(x => x.tr === 3 && x.tc === 4);
      if(!bt) return 'no-bot-move';
      executeMove(bt);
      return !!( !premove && S.saveState().board[4][3] );
    });
    expect(executed).toBe(true);
  });

  // ===================== 15. PGN: кнопка в истории =====================
  test('История: кнопка копирования PGN появляется для партий с записью', async ({ page }) => {
    await page.evaluate(() => {
      const cu = ProfilesManager.getCurrent();
      cu.matchHistory = [{
        result: 'win', opponent: 'Тест', mode: 'Классика', time: Date.now(),
        startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        moves: [{ notation: 'e4' }]
      }];
      saveProfiles();
      showScreen('scrProf');
      renderProfScr();
      const tab = document.querySelector('#profTabs .shopTab[data-tab="history"]');
      if(tab) tab.click();
      renderMatchHistory(cu);
    });
    await page.waitForTimeout(400);

    const btn = page.locator('#matchHistory button[onclick*="copyMatchPGN"]');
    await expect(btn.first()).toBeVisible();
  });

  // ===================== 16. Турнир: старт против бота =====================
  test('Турнир: открытие и старт первого раунда против бота', async ({ page }) => {
    await page.click('#mModes');
    await page.waitForTimeout(500);
    await page.locator('.modeCard').filter({ has: page.locator('.nm', { hasText: /^Турнир$/ }) }).click();
    await page.waitForTimeout(400);

    await expect(page.locator('#ovTour')).toBeVisible();
    await page.click('#ovTour [data-sz="4"]');
    await page.waitForTimeout(1200);

    await expect(page.locator('#boardBox')).toBeVisible();
    const sl = await page.locator('#statusLine').textContent();
    expect(sl).toContain('🏆');
  });

});
