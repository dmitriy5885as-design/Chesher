const { test, expect } = require('@playwright/test');

test.describe('Мобильный UI: без горизонтального переполнения (360px)', () => {
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

  test('экраны меню, режимов, магазина и профиля без горизонтального скролла', async ({ page }) => {
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
