const { test, expect } = require('@playwright/test');

test.describe('Мобильный UI: без горизонтального переполнения', () => {
  test.beforeEach(async ({ page }) => {
    // Не зависаем на внешнем CDN firebase в тестах: приложение работает без него
    await page.route('**://www.gstatic.com/**', route =>
      route.fulfill({ contentType: 'application/javascript', body: '/* stubbed for e2e */' }));
    await page.addInitScript(() => { try { localStorage.setItem('chesher_visited', '1'); } catch(e) {} });
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('/');
    await page.waitForFunction(() => typeof cfg !== 'undefined' && typeof newGame === 'function', null, { timeout: 20000 });
    await page.waitForTimeout(300);
  });

  async function expectNoScreenOverflow(page, label) {
    const r = await page.evaluate(() => {
      const s = document.querySelector('.screen.show');
      return s ? { sw: s.scrollWidth, cw: s.clientWidth } : null;
    });
    expect(r, label + ': должен быть открыт экран').not.toBeNull();
    expect(r.sw, label + ': горизонтальное переполнение ' + r.sw + ' > ' + r.cw).toBeLessThanOrEqual(r.cw + 1);
  }

  async function gotoBots(page) {
    await page.click('#mModes'); await page.waitForTimeout(400);
    await page.locator('.modeCard').filter({ has: page.locator('.nm', { hasText: /^Против бота$/ }) }).click();
    await page.waitForTimeout(700);
  }

  async function backToMenu(page) {
    for(let i = 0; i < 5; i++) {
      if(await page.locator('#scrMenu.show').count()) return;
      const back = page.locator('.screen.show .backBtn');
      if(!await back.count()) return;
      await back.click(); await page.waitForTimeout(300);
    }
  }

  test('экраны меню, режимов, магазина, профиля, ботов и рейтинга без горизонтального скролла', async ({ page }) => {
    await expectNoScreenOverflow(page, 'Главное меню');

    await page.click('#mModes'); await page.waitForTimeout(300);
    await expectNoScreenOverflow(page, 'Режимы');
    await page.click('#scrModes .backBtn'); await page.waitForTimeout(300);

    await page.click('#mShop'); await page.waitForTimeout(300);
    await expectNoScreenOverflow(page, 'Магазин (скины)');
    await page.click('#shopTabs .shopTab[data-tab="boards"]'); await page.waitForTimeout(200);
    await expectNoScreenOverflow(page, 'Магазин (доски)');
    await page.click('#scrShop .backBtn'); await page.waitForTimeout(300);

    await page.click('#profBar'); await page.waitForTimeout(300);
    await expectNoScreenOverflow(page, 'Профиль (карточка)');
    await page.click('#profTabs .shopTab[data-tab="history"]'); await page.waitForTimeout(300);
    await expectNoScreenOverflow(page, 'Профиль (история и достижения)');
    await page.click('#profTabs .shopTab[data-tab="settings"]'); await page.waitForTimeout(300);
    await expectNoScreenOverflow(page, 'Профиль (настройки)');
    await backToMenu(page);

    await gotoBots(page);
    await expectNoScreenOverflow(page, 'Экран ботов');
    const infoPanel = page.locator('#botsInfo, .botInfoCard');
    await expect(infoPanel.first()).toBeVisible();
    await backToMenu(page);

    await page.click('#mLeaderboard'); await page.waitForTimeout(500);
    await expectNoScreenOverflow(page, 'Рейтинг');
    await backToMenu(page);
  });

  test('320px: узкий экран без горизонтального скролла на всех ключевых экранах', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.waitForTimeout(300);

    const expectNoPageOverflow = async (label) => {
      const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
      expect(r.sw, label + ': страница переполняется ' + r.sw + ' > ' + r.iw).toBeLessThanOrEqual(r.iw + 1);
      await expectNoScreenOverflow(page, label);
    };

    await expectNoPageOverflow('Главное меню (320)');

    // Табы профиля переносятся, а не вылезают за экран
    await page.click('#profBar'); await page.waitForTimeout(400);
    await expectNoPageOverflow('Профиль (320)');
    const tabsBox = await page.evaluate(() => {
      const t = document.getElementById('profTabs');
      const last = t.lastElementChild.getBoundingClientRect();
      const tb = t.getBoundingClientRect();
      return { lastRight: last.right, tabsRight: tb.right, scrollW: t.scrollWidth, clientW: t.clientWidth };
    });
    expect(tabsBox.lastRight, 'Табы профиля вылезают за контейнер').toBeLessThanOrEqual(tabsBox.tabsRight + 1);
    await backToMenu(page);

    await page.click('#mShop'); await page.waitForTimeout(400);
    await expectNoPageOverflow('Магазин (320)');
    await backToMenu(page);

    await page.click('#mModes'); await page.waitForTimeout(400);
    await expectNoPageOverflow('Режимы (320)');
    await backToMenu(page);

    await gotoBots(page);
    await expectNoPageOverflow('Экран ботов (320)');
    await backToMenu(page);

    await page.click('#mLeaderboard'); await page.waitForTimeout(500);
    await expectNoPageOverflow('Рейтинг (320)');
    await backToMenu(page);

    await page.click('#mSettings'); await page.waitForTimeout(400);
    await expectNoPageOverflow('Настройки (320)');
  });

  test('игровой экран в мобильном режиме без горизонтального скролла', async ({ page }) => {
    await page.evaluate(() => {
      document.body.classList.add('mobile-mode');
      cfg.gameMode = 'bot'; cfg.modeId = 'chess'; cfg.bot = 'easy'; cfg.human = 'w'; cfg.memes = false; cfg.timeSec = 0;
      botMove = function() {};
      newGame();
      hideAllScreens();
    });
    await page.waitForTimeout(300);
    expect(await page.locator('#boardBox').isVisible()).toBe(true);

    const r = await page.evaluate(() => ({ sw: document.body.scrollWidth, iw: window.innerWidth }));
    expect(r.sw, 'Игра: горизонтальное переполнение ' + r.sw + ' > ' + r.iw).toBeLessThanOrEqual(r.iw + 1);

    const side = await page.evaluate(() => {
      const s = document.getElementById('side');
      return s ? { sw: s.scrollWidth, cw: s.clientWidth } : null;
    });
    expect(side).not.toBeNull();
    expect(side.sw, 'Боковая панель: ' + side.sw + ' > ' + side.cw).toBeLessThanOrEqual(side.cw + 1);
  });
});
