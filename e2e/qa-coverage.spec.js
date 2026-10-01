const { test, expect } = require('@playwright/test');

/* ============================================================
   ЧЕШЕР — QA-волна: фичи, не покрытые предыдущими спеками
   локальный матч, турнир, чат, друзья, настройки, аккаунт,
   девблог, стилизация
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
  }, { human, timeSec, stubBot });
  await page.waitForTimeout(250);
}

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e && e.message || e)));
  return errors;
}

async function openModeCard(page, name) {
  await page.click('#mModes');
  await page.waitForTimeout(450);
  await page.locator('.modeCard').filter({ has: page.locator('.nm', { hasText: new RegExp('^' + name + '$') }) }).click();
}

test.describe('QA-волна — непокрытые фичи', () => {

  /* ---------- ЛОКАЛЬНЫЙ МАТЧ ---------- */
  test('локальный матч «На одном ПК»: обе стороны ходят, pass-оверлей, undo, исход', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);
    await openModeCard(page, 'На одном ПК');
    await expect(page.locator('#modesCfg')).toBeVisible();
    await expect(page.locator('#segSide')).toBeHidden();
    await page.click('#modesStart');
    await page.waitForTimeout(400);

    expect(await page.evaluate(() => cfg.gameMode)).toBe('local');
    await expect(page.locator('#boardBox')).toBeVisible();
    expect(await page.locator('#statusLine').textContent()).toContain('Ход белых');
    expect(await page.locator('#modeLabel').textContent()).toContain('На одном ПК');

    // Ход белых e2-e4
    await page.click('#grid .sq[data-r="6"][data-c="4"]');
    await page.click('#grid .sq[data-r="4"][data-c="4"]');
    await expect(page.locator('#passOverlay')).toBeVisible();
    const pass = await page.locator('#passOverlay').textContent();
    expect(pass).toContain('Чёрные');
    expect(pass).toContain('Игрок 2');
    expect(await page.evaluate(() => ({ t: S.turn, h: S.humanColor }))).toEqual({ t: 'b', h: 'b' });
    await expect(page.locator('#boardBox')).toHaveClass(/flipped/);
    expect(await page.locator('#statusLine').textContent()).toContain('Ход чёрных');

    // Игрок 2 закрывает pass и ходит e7-e5 (раньше клик блокировался — баг-регрессия)
    await page.click('#passOverlay');
    await expect(page.locator('#passOverlay')).toBeHidden();
    await page.click('#grid .sq[data-r="1"][data-c="4"]');
    await page.click('#grid .sq[data-r="3"][data-c="4"]');
    expect(await page.evaluate(() => ({ t: S.turn, h: S.humanColor, n: S.moveHistory.length }))).toEqual({ t: 'w', h: 'w', n: 2 });
    await expect(page.locator('#boardBox')).not.toHaveClass(/flipped/);
    expect(await page.locator('#statusLine').textContent()).toContain('Ход белых');

    // undo: очередь и переворот доски синхронизированы
    await page.evaluate(() => undoMove());
    expect(await page.evaluate(() => ({ t: S.turn, h: S.humanColor, n: S.moveHistory.length }))).toEqual({ t: 'b', h: 'b', n: 1 });
    await expect(page.locator('#boardBox')).toHaveClass(/flipped/);

    // Конец: победа белых (Игрок 1) — результат в общий профиль
    await page.evaluate(() => endGame('checkmate', 'w'));
    await expect(page.locator('#ovOver')).toBeVisible();
    expect(await page.locator('#goT').textContent()).toContain('Игрок 1 (⚪) победил');
    expect(await page.evaluate(() => {
      const h = ProfilesManager.getCurrent().matchHistory;
      return h.length ? h[h.length - 1].result : null;
    })).toBe('win');
    expect(errors).toEqual([]);
  });

  /* ---------- ТУРНИР ---------- */
  test('турнир: сдача ведёт к вылету, призу и оверлею «Выбыл», рестарт сетки', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);
    await openModeCard(page, 'Турнир');
    await expect(page.locator('#ovTour')).toBeVisible();
    await page.click('#ovTour [data-sz="4"]');
    await page.waitForTimeout(1000);

    expect(await page.locator('#statusLine').textContent()).toContain('🏆');
    expect(await page.evaluate(() => ({ r: _tournament.round, a: _tournamentActive }))).toEqual({ r: 1, a: true });

    await page.click('#btnRes');
    await expect(page.locator('#ovConf')).toBeVisible();
    await page.click('#confY');

    await expect(page.locator('#ovTourEnd')).toBeVisible();
    const endText = await page.locator('#ovTourEnd').textContent();
    expect(endText).toContain('Выбыл');
    expect(endText).toContain('Приз:');
    expect(endText).toContain('Побед:');
    await expect(page.locator('#ovOver')).toBeHidden();
    expect(await page.evaluate(() => _tournamentActive)).toBe(false);

    await page.click('#tEndAgain');
    await expect(page.locator('#ovTour')).toBeVisible();
    await expect(page.locator('#ovTourEnd')).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('турнир: быстрый проход сетки 4 → «Чемпион турнира!» и приз', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);
    const coins0 = await page.evaluate(() => ProfilesManager.getCurrent().coins);
    await openModeCard(page, 'Турнир');
    await expect(page.locator('#ovTour')).toBeVisible();
    await page.click('#ovTour [data-sz="4"]');
    await page.waitForTimeout(1000);

    // Раунд 1 (полуфинал) — быстрая победа
    await page.evaluate(() => endGame('checkmate', S.humanColor));
    await page.waitForFunction(() => _tournament && _tournament.round === 2, null, { timeout: 6000 });
    await page.waitForFunction(() => typeof S !== 'undefined' && S && !S.gameOver, null, { timeout: 6000 });
    await page.waitForTimeout(300);

    // Финал
    await page.evaluate(() => endGame('checkmate', S.humanColor));
    await expect(page.locator('#ovTourEnd')).toBeVisible();
    const endText = await page.locator('#ovTourEnd').textContent();
    expect(endText).toContain('Чемпион');
    expect(await page.evaluate(() => _tournamentActive)).toBe(false);

    const coins1 = await page.evaluate(() => ProfilesManager.getCurrent().coins);
    expect(coins1 - coins0).toBeGreaterThanOrEqual(25);
    expect(errors).toEqual([]);
  });

  test('турнир: F5 полностью сбрасывает сетку (состояние не в localStorage)', async ({ page }) => {
    await boot(page);
    await openModeCard(page, 'Турнир');
    await expect(page.locator('#ovTour')).toBeVisible();
    await page.click('#ovTour [data-sz="8"]');
    await page.waitForTimeout(900);
    expect(await page.evaluate(() => _tournamentActive)).toBe(true);

    await page.reload();
    await page.waitForFunction(() => typeof cfg !== 'undefined' && typeof newGame === 'function', null, { timeout: 20000 });
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => _tournamentActive)).toBe(false);
    await expect(page.locator('#ovTour')).toHaveCount(0);
    await expect(page.locator('#scrMenu')).toBeVisible();
  });

  /* ---------- ЧАТ ---------- */
  test('чат: отправка сообщения, ответ бота, мьют глушит соперника', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);
    await startGame(page);
    await expect(page.locator('#chatBox')).toBeVisible();

    await page.fill('#chatInput', 'привет');
    await page.click('#chatSend');
    await expect(page.locator('#chatMsgs .chatMsg.me')).toHaveCount(1);
    expect(await page.locator('#chatMsgs .chatMsg.me .text').textContent()).toContain('привет');
    expect(await page.inputValue('#chatInput')).toBe('');

    await page.waitForSelector('#chatMsgs .chatMsg.opp', { timeout: 5000 });
    await expect(page.locator('#chatMsgs .chatMsg.opp')).toHaveCount(1);

    // Мьют: ответы соперника больше не приходят
    await page.click('#muteBtn');
    await page.fill('#chatInput', 'ещё раз');
    await page.click('#chatSend');
    await expect(page.locator('#chatMsgs .chatMsg.me')).toHaveCount(2);
    await page.waitForTimeout(2500);
    await expect(page.locator('#chatMsgs .chatMsg.opp')).toHaveCount(1);
    expect(errors).toEqual([]);
  });

  /* ---------- ДРУЗЬЯ ---------- */
  test('друзья: панель, пустые состояния и guard «Войдите» без облака', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);
    await expect(page.locator('#friendsFloatBtn')).toBeVisible();
    await page.click('#friendsFloatBtn');
    await expect(page.locator('#friendsPanel')).toHaveClass(/open/);
    await expect(page.locator('#fpList')).toContainText('Войдите, чтобы видеть друзей');

    await page.fill('#fpSearchInput', 'Иван');
    await page.click('#fpSearchBtn');
    await expect(page.locator('#fpSearchResults')).toContainText('Войдите, чтобы искать игроков');

    // Меньше 2 символов — поиск не выполняется, результаты очищаются
    await page.fill('#fpSearchInput', 'a');
    await page.click('#fpSearchBtn');
    await expect(page.locator('#fpSearchResults')).toHaveText('');

    await page.click('#fpClose');
    await expect(page.locator('#friendsPanel')).not.toHaveClass(/open/);
    expect(errors).toEqual([]);
  });

  test('друзья: экран из мультиплеера открывается и не падает без Firebase', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);
    await page.click('#mPlay');
    await expect(page.locator('#scrMulti')).toBeVisible();
    await page.click('#mpFriendsBtn');
    await expect(page.locator('#scrFriends')).toBeVisible();
    await expect(page.locator('#friendSearch')).toBeVisible();

    await page.fill('#friendSearch', 'ab');
    await page.click('#friendSearchBtn');
    await page.waitForTimeout(300);
    await page.evaluate(() => { if (typeof NetUI !== 'undefined' && NetUI._loadFriends) NetUI._loadFriends(); });
    await page.waitForTimeout(300);
    expect(errors).toEqual([]);

    await page.click('#scrFriends .backBtn');
    await expect(page.locator('#scrMulti')).toBeVisible();
  });

  /* ---------- НАСТРОЙКИ ---------- */
  test('настройки: тумблер звука переживает F5 (chesher_cfg)', async ({ page }) => {
    await boot(page);
    await page.click('#mSettings');
    await expect(page.locator('#scrSet')).toBeVisible();

    const toggle = page.locator('#sndSliders .toggle');
    const box = toggle.locator('input[type=checkbox]');
    await expect(box).toHaveCount(1);
    const before = await box.isChecked();
    await toggle.click();
    expect(await box.isChecked()).toBe(!before);
    expect(await page.evaluate(() => cfg.sound)).toBe(!before);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('chesher_cfg')).sound)).toBe(!before);

    await page.reload();
    await page.waitForFunction(() => typeof cfg !== 'undefined' && typeof newGame === 'function', null, { timeout: 20000 });
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => cfg.sound)).toBe(!before);
    await page.click('#mSettings');
    await expect(box).toHaveCount(1);
    expect(await box.isChecked()).toBe(!before);
  });

  test('настройки: «Применить и начать заново» перезапускает партию', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);
    await startGame(page);
    await page.click('#grid .sq[data-r="6"][data-c="4"]');
    await page.click('#grid .sq[data-r="4"][data-c="4"]');
    expect(await page.evaluate(() => S.moveHistory.length)).toBe(1);

    await page.click('#btnSet');
    await expect(page.locator('#scrSet')).toBeVisible();
    await page.click('#setApply');
    await page.waitForTimeout(400);

    await expect(page.locator('#scrSet')).toBeHidden();
    await expect(page.locator('#boardBox')).toBeVisible();
    expect(await page.evaluate(() => S.moveHistory.length)).toBe(0);
    expect(errors).toEqual([]);
  });

  /* ---------- АККАУНТ ---------- */
  test('аккаунт: смена имени гостя — валидация, подтверждение, одноразовость', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);
    await page.click('#profBar');
    await expect(page.locator('#scrProf')).toBeVisible();
    await expect(page.locator('#nickInput')).toBeVisible();

    await page.fill('#nickInput', 'а');
    await page.click('#nickChangeBtn');
    await expect(page.locator('#toast')).toContainText('Минимум 2 символа');

    await page.fill('#nickInput', 'Тест');
    await page.click('#nickChangeBtn');
    await expect(page.locator('#ovConf')).toBeVisible();
    await page.click('#confY');
    await expect(page.locator('#toast')).toContainText('Имя задано');
    await expect(page.locator('#nickChangeBtn')).toBeDisabled();
    expect(await page.locator('#nickChangeBtn').textContent()).toContain('Задано');
    expect(await page.evaluate(() => localStorage.getItem('chesher_guest_name_changed'))).toBe('1');
    expect(await page.locator('#pbName').textContent()).toContain('Тест');
    expect(errors).toEqual([]);
  });

  test('аккаунт: выход из аккаунта — подтверждение и возврат в меню', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);
    await page.click('#profBar');
    await expect(page.locator('#scrProf')).toBeVisible();
    await page.click('#profTabs .shopTab[data-tab="settings"]');
    await expect(page.locator('#profLogoutBtn2')).toBeVisible();
    await expect(page.locator('#profSettingsInfo')).toContainText('Монеты');

    await page.click('#profLogoutBtn2');
    await expect(page.locator('#ovConf')).toBeVisible();
    await page.click('#confY');
    await expect(page.locator('#scrMenu')).toBeVisible();
    await expect(page.locator('#toast')).toContainText('Вы вышли из аккаунта');
    expect(errors).toEqual([]);
  });

  /* ---------- ДЕВБЛОГ ---------- */
  test('девблог: рендер записей совпадает с version.json', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);
    await expect(page.locator('#scrMenu .menuFoot')).toContainText(/CHESHER v\d+\.\d+\.\d+ alpha/);

    const resp = await page.request.get('/version.json');
    const data = await resp.json();

    await page.click('#devblogBtn');
    await expect(page.locator('#scrDevblog')).toBeVisible();
    await expect(page.locator('#dbWrap .dbEntry')).toHaveCount(data.length);
    expect(await page.locator('#dbWrap .dbEntry').first().locator('.dbVer').textContent()).toBe(data[0].ver);
    expect(await page.locator('#dbWrap .dbEntry').first().locator('.dbDate').textContent()).toBe(data[0].date);
    expect(await page.locator('#dbWrap .dbEntry').first().locator('.dbList li').count()).toBeGreaterThan(0);
    await expect(page.locator('#scrMenu .menuFoot')).toContainText(data[0].ver);

    await page.click('#scrDevblog .backBtn');
    await expect(page.locator('#scrMenu')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('девблог: ошибка загрузки → «Повторить» восстанавливает рендер', async ({ page }) => {
    const errors = trackErrors(page);
    await page.route('**://www.gstatic.com/**', r =>
      r.fulfill({ contentType: 'application/javascript', body: '/* stubbed for e2e */' }));
    await page.route('**/version.json*', r => r.abort());
    await page.addInitScript(() => { try { localStorage.setItem('chesher_visited', '1'); } catch(e) {} });
    await page.goto('/');
    await page.waitForFunction(() => typeof cfg !== 'undefined' && typeof newGame === 'function', null, { timeout: 20000 });
    await page.waitForTimeout(300);

    await page.click('#devblogBtn');
    await expect(page.locator('#dbWrap')).toContainText('Не удалось загрузить девблог');
    await expect(page.locator('#dbRetry')).toBeVisible();

    await page.unroute('**/version.json*');
    await page.click('#dbRetry');
    await page.waitForSelector('#dbWrap .dbEntry', { timeout: 8000 });
    expect(await page.locator('#dbWrap .dbEntry').count()).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  /* ---------- СТИЛИЗАЦИЯ ---------- */
  test('стилизация: смена доски применяет тему; некупленная — тост и отказ', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);
    await page.evaluate(() => {
      const cu = ProfilesManager.getCurrent();
      if (!cu.owned.includes('board_blue')) cu.owned.push('board_blue');
      saveProfiles();
    });
    await page.click('#profBar');
    await page.click('#profTabs .shopTab[data-tab="style"]');
    await expect(page.locator('#themeRow .swatch').first()).toBeVisible();

    // Некупленная «Неон» — отказ
    await page.locator('#themeRow .swatch').filter({ hasText: 'Неон' }).click();
    await expect(page.locator('#toast')).toContainText('Купите доску в магазине');
    expect(await page.evaluate(() => cfg.board)).not.toBe('neon');

    // Купленная «Синева» — применяется
    await page.locator('#themeRow .swatch').filter({ hasText: 'Синева' }).click();
    expect(await page.evaluate(() => cfg.board)).toBe('blue');
    expect(await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--sq-l').trim()
    )).toBe('#dee3e6');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('chesher_cfg')).board)).toBe('blue');
    await expect(page.locator('#themeRow .swatch').filter({ hasText: 'Синева' })).toHaveClass(/sel/);
    expect(errors).toEqual([]);
  });

});
