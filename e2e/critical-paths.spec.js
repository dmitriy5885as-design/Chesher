const { test, expect } = require('@playwright/test');

test.describe('CHESHER — Критические пути', () => {

  test.beforeEach(async ({ page }) => {
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
    await expect(page.locator('#mFriends')).toBeVisible();
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

    // Кликаем «Против бота»
    await page.click('.modeCard:has-text("Против бота")');
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
    expect(tabCount).toBe(5);

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
    expect(count).toBe(3);

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

});
