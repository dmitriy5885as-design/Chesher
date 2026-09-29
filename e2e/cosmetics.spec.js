const { test, expect } = require('@playwright/test');

/* ============================================================
   ЧЕШЕР v0.25.0 — премиум-косметика за кристаллы 💎
   ============================================================ */

async function boot(page) {
  await page.route('**://www.gstatic.com/**', r =>
    r.fulfill({ contentType: 'application/javascript', body: '/* stubbed for e2e */' }));
  await page.addInitScript(() => { try { localStorage.setItem('chesher_visited', '1'); } catch(e) {} });
  await page.goto('/');
  await page.waitForFunction(() => typeof cfg !== 'undefined' && typeof Store !== 'undefined', null, { timeout: 20000 });
  await page.waitForTimeout(250);
}

async function openPremium(page) {
  await page.click('#mShop');
  await expect(page.locator('#scrShop')).toBeVisible();
  await page.click('#shopTabs .shopTab[data-tab="premium"]');
  await expect(page.locator('#shopGrid')).toBeVisible();
}

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e && e.message || e)));
  return errors;
}

test.describe('v0.25.0 — премиум-косметика', () => {

  test('вкладка «💎 Премиум»: секции косметики и покупка цвета ника', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);
    await openPremium(page);

    // Три секции помимо скинов
    const titles = await page.locator('#shopGrid .shopSectionTitle').allTextContents();
    expect(titles).toEqual(['✨ Цвет ника', '🖼 Рамка профиля', '🎉 Эффект победы']);
    expect(await page.locator('#shopGrid .buyBtn[data-type="nick"]').count()).toBe(5);

    // Покупка: хватает кристаллов → списаны, предмет получен и экипирован
    const bought = await page.evaluate(() => {
      const cu = ProfilesManager.getCurrent();
      cu.gems = 100; saveProfiles(); renderCoins();
      return cu.gems;
    });
    expect(bought).toBe(100);

    await page.click('#shopGrid .buyBtn[data-type="nick"][data-id="nick_gold"]');
    const st = await page.evaluate(() => {
      const cu = ProfilesManager.getCurrent();
      return {
        gems: cu.gems,
        owned: cu.owned.includes('nick_gold'),
        nickColor: cu.nickColor,
        css: document.documentElement.style.getPropertyValue('--nick-cos')
      };
    });
    expect(st.gems).toBe(80);
    expect(st.owned).toBe(true);
    expect(st.nickColor).toBe('nick_gold');
    expect(st.css).toBe('#f7c531');
    expect(errors).toEqual([]);
  });

  test('покупка при нехватке 💎 блокируется; повторный клик — экипировка', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);
    await openPremium(page);

    await page.evaluate(() => { const cu = ProfilesManager.getCurrent(); cu.gems = 0; saveProfiles(); renderCoins(); });
    await page.click('#shopGrid .buyBtn[data-type="nick"][data-id="nick_amber"]');
    const denied = await page.evaluate(() => {
      const cu = ProfilesManager.getCurrent();
      return { gems: cu.gems, owned: cu.owned.includes('nick_amber') };
    });
    expect(denied.gems).toBe(0);
    expect(denied.owned).toBe(false);
    await expect(page.locator('#toast')).toContainText('Не хватает');

    // Хватает → покупка; клик по уже купленному — экипировка без списания
    await page.evaluate(() => { const cu = ProfilesManager.getCurrent(); cu.gems = 100; saveProfiles(); renderCoins(); });
    await page.click('#shopGrid .buyBtn[data-type="nick"][data-id="nick_amber"]'); // −20, экипирован
    await page.click('#shopGrid .buyBtn[data-type="nick"][data-id="nick_violet"]'); // −30, экипирован
    await page.click('#shopGrid .buyBtn[data-type="nick"][data-id="nick_amber"]');  // уже куплен → только экипировка
    const switched = await page.evaluate(() => {
      const cu = ProfilesManager.getCurrent();
      return { gems: cu.gems, nickColor: cu.nickColor };
    });
    expect(switched.nickColor).toBe('nick_amber');
    expect(switched.gems, 'экипировка не списывает').toBe(50); // 100 − 20 − 30
    expect(errors).toEqual([]);
  });

  test('рамка профиля и вкладка «Стилизация»: экипировка из профиля', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);
    await openPremium(page);

    await page.evaluate(() => { const cu = ProfilesManager.getCurrent(); cu.gems = 200; saveProfiles(); renderCoins(); });
    await page.click('#shopGrid .buyBtn[data-type="frame"][data-id="frame_violet"]');
    await page.click('#shopGrid .buyBtn[data-type="nick"][data-id="nick_violet"]');
    await page.click('#shopGrid .buyBtn[data-type="nick"][data-id="nick_gold"]');
    const st = await page.evaluate(() => {
      const cu = ProfilesManager.getCurrent();
      return { frame: cu.profileFrame, nick: cu.nickColor, dataset: document.body.dataset.frame };
    });
    expect(st.frame).toBe('frame_violet');
    expect(st.dataset).toBe('frame_violet');
    expect(st.nick, 'последняя купленная — золотой (автоэкипировка)').toBe('nick_gold');

    // Экипировка из профиля: «🎨 Стилизация» переключает с купленного золотого на фиолетовый
    await page.click('#scrShop .backBtn');
    await expect(page.locator('#scrMenu')).toBeVisible();
    await page.click('#profBar');
    await expect(page.locator('#scrProf')).toBeVisible();
    await page.click('#profTabs .shopTab[data-tab="style"]');
    await expect(page.locator('#segNickCos')).toBeVisible();
    await page.click('#segNickCos button:has-text("Фиолетовый")');
    const eq = await page.evaluate(() => {
      const cu = ProfilesManager.getCurrent();
      return { nick: cu.nickColor, css: document.documentElement.style.getPropertyValue('--nick-cos') };
    });
    expect(eq.nick).toBe('nick_violet');
    expect(eq.css).toBe('#b48ee8');
    expect(errors).toEqual([]);
  });

  test('эффект победы: конфетти на оверлее при выигрыше', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);

    await page.evaluate(() => {
      const cu = ProfilesManager.getCurrent();
      cu.gems = 100; saveProfiles();
      cfg.gameMode = 'bot'; cfg.modeId = 'bot'; cfg.bot = 'easy'; cfg.human = 'w'; cfg.timeSec = 0;
      botMove = function() {};
      newGame();
      hideAllScreens();
    });

    // Без эффекта — конфетти нет
    await page.evaluate(() => endGame('checkmate', S.humanColor));
    await expect(page.locator('#ovOver')).toBeVisible();
    let conf = await page.locator('#ovOver .modal .confetti').count();
    expect(conf).toBe(0);

    // Купили и экипировали конфетти → выигрыш → частицы на оверлее
    await page.evaluate(() => {
      const cu = ProfilesManager.getCurrent();
      cu.owned.push('fx_confetti');
      cu.winFx = 'fx_confetti';
      saveProfiles();
      S.gameOver = false;
      endGame('checkmate', S.humanColor);
    });
    await expect(page.locator('#ovOver')).toBeVisible();
    conf = await page.locator('#ovOver .modal .confetti').count();
    expect(conf).toBe(26);
    expect(errors).toEqual([]);
  });
});
