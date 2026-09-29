const { test, expect } = require('@playwright/test');

/* ============================================================
   ЧЕШЕР v0.25.0 — цели дня и стрик ежедневного входа
   ============================================================ */

async function boot(page) {
  await page.route('**://www.gstatic.com/**', r =>
    r.fulfill({ contentType: 'application/javascript', body: '/* stubbed for e2e */' }));
  await page.addInitScript(() => { try { localStorage.setItem('chesher_visited', '1'); } catch(e) {} });
  await page.goto('/');
  await page.waitForFunction(() => typeof cfg !== 'undefined' && typeof Quests !== 'undefined', null, { timeout: 20000 });
  await page.waitForTimeout(250);
}

/* Фиксированный набор целей: подбор от даты детерминирован, но меняется
   каждый день — тесты подставляют известный состав, чтобы проверять логику */
async function seedQuests(page, ids) {
  await page.evaluate((ids) => {
    const today = new Date().toISOString().slice(0, 10);
    const cu = ProfilesManager.getCurrent();
    cu.quests = { date: today, items: ids.map(id => ({ id: id, prog: 0, claimed: false })) };
    saveProfiles();
  }, ids);
}

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e && e.message || e)));
  return errors;
}

test.describe('v0.25.0 — цели дня и стрик', () => {

  test('цели: автоподбор даёт 3 задания, прогресс и награда выдаются один раз', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);

    // Свежий автоподбор от сегодняшней даты: ровно 3 валидных задания
    const init = await page.evaluate(() => {
      const q = Quests.ensure();
      return { n: q.items.length, date: q.date, ids: q.items.map(i => i.id) };
    });
    expect(init.n).toBe(3);
    expect(init.date).toBe(new Date().toISOString().slice(0, 10));
    expect(new Set(init.ids).size, 'без дублей').toBe(3);

    // Известный набор для проверки логики событий
    await seedQuests(page, ['play2', 'win1', 'bot1']);

    // Победа боту: play2(1/2), win1 и bot1 закрываются → +40+40
    const before = await page.evaluate(() => ProfilesManager.getCurrent().coins);
    await page.evaluate(() => Quests.onEvent('game', { result: 'win', vsBot: true }));
    const after1 = await page.evaluate(() => {
      const cu = ProfilesManager.getCurrent();
      return { coins: cu.coins, prog: Quests.progress() };
    });
    const byId = (arr, id) => arr.find(p => p.id === id);
    expect(byId(after1.prog, 'play2').prog).toBe(1);
    expect(byId(after1.prog, 'play2').claimed).toBe(false);
    expect(byId(after1.prog, 'win1').claimed).toBe(true);
    expect(byId(after1.prog, 'bot1').claimed).toBe(true);
    expect(after1.coins).toBe(before + 80);

    // Вторая партия (ничья) закрывает play2 → ещё +30
    await page.evaluate(() => Quests.onEvent('game', { result: 'draw', vsBot: false }));
    const after2 = await page.evaluate(() => {
      const cu = ProfilesManager.getCurrent();
      return { coins: cu.coins, prog: Quests.progress() };
    });
    expect(byId(after2.prog, 'play2').prog).toBe(2);
    expect(byId(after2.prog, 'play2').claimed).toBe(true);
    expect(after2.coins).toBe(after1.coins + 30);

    // Повторные события не дублируют награду
    await page.evaluate(() => Quests.onEvent('game', { result: 'win', vsBot: true }));
    const after3 = await page.evaluate(() => ProfilesManager.getCurrent().coins);
    expect(after3).toBe(after2.coins);
    expect(errors).toEqual([]);
  });

  test('цели: блок «🎯 Цели дня» в профиле, сброс при смене даты', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);
    await seedQuests(page, ['play2', 'win1', 'bot1']);
    await page.evaluate(() => Quests.onEvent('game', { result: 'win', vsBot: true }));

    await page.click('#profBar');
    await expect(page.locator('#scrProf')).toBeVisible();
    await expect(page.locator('#questList .questRow')).toHaveCount(3);
    // win1/bot1 уже выполнены
    expect(await page.locator('#questList .questRow.done').count()).toBe(2);
    // прогресс play2 виден в строке (1 из 2)
    await expect(page.locator('.questRow[data-q="play2"] .qTitle')).toContainText('Сыграй 2 партии');

    // Смена даты → цели сбрасываются, монеты не дублируются
    const reset = await page.evaluate(() => {
      const cu = ProfilesManager.getCurrent();
      const coins = cu.coins;
      cu.quests.date = '2000-01-01';
      saveProfiles();
      Quests.ensure();
      return { coins: ProfilesManager.getCurrent().coins, prog: Quests.progress() };
    });
    expect(reset.prog.every(p => p.prog === 0 && !p.claimed)).toBe(true);
    expect(reset.coins).toBeGreaterThan(0); // старые награды не сгорают и не дублируются
    expect(errors).toEqual([]);
  });

  test('стрик: серия растёт за последовательные дни и переживает F5', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);
    await seedQuests(page, ['play2', 'win1', 'gift1']);

    // В e2e Firebase застаблен — подставляем вошедшего пользователя
    // и прячем dev-кнопку, которая перекрывает giftBtn только в dev-режиме
    const setup = await page.evaluate(() => {
      const cu = ProfilesManager.getCurrent();
      const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      cu.giftLast = yest; cu.giftStreak = 1; saveProfiles();
      localStorage.setItem('chesher_daily_gift', yest);
      const before = cu.coins;
      ChesAuth.user = { isAnonymous: false, uid: 'e2e' };
      updateGiftBtn();
      const cheat = document.getElementById('cheatBtn');
      if(cheat) cheat.style.display = 'none';
      const btn = document.getElementById('giftBtn');
      return { before: before, disabled: btn.classList.contains('disabled'), title: btn.title };
    });
    expect(setup.disabled, 'для вошедшего подарок доступен').toBe(false);
    expect(setup.title).toContain('серия 1');

    // Забираем → серия 2, +5 к бонусу, цель gift1 выполнена
    await page.click('#giftBtn');
    const claimed = await page.evaluate(() => {
      const cu = ProfilesManager.getCurrent();
      const btn = document.getElementById('giftBtn');
      return { streak: cu.giftStreak, last: cu.giftLast, coins: cu.coins,
               title: btn.title, claimed: btn.classList.contains('claimed'),
               gift1: Quests.progress().find(p => p.id === 'gift1') };
    });
    expect(claimed.streak).toBe(2);
    expect(claimed.last).toBe(new Date().toISOString().slice(0, 10));
    expect(claimed.coins).toBeGreaterThanOrEqual(setup.before + 30); // 25 + rand(25) + 5
    expect(claimed.title).toContain('серия 2');
    expect(claimed.claimed).toBe(true);
    expect(claimed.gift1.claimed, 'забрал подарок → цель gift1 выполнена').toBe(true);

    // Повторный клик в тот же день не выдаёт монеты
    const coinsNow = claimed.coins;
    await page.evaluate(() => {
      const btn = document.getElementById('giftBtn');
      btn.classList.remove('claimed', 'disabled');
      btn.click();
    });
    const again = await page.evaluate(() => ProfilesManager.getCurrent().coins);
    expect(again).toBe(coinsNow);

    // Персистентность: F5 сохранил серию и цели
    await page.reload();
    await page.waitForFunction(() => typeof cfg !== 'undefined' && typeof Quests !== 'undefined', null, { timeout: 20000 });
    const after = await page.evaluate(() => {
      const cu = ProfilesManager.getCurrent();
      return { streak: cu.giftStreak, quests: !!cu.quests,
               gift1: (cu.quests.items.find(i => i.id === 'gift1') || {}).claimed };
    });
    expect(after.streak).toBe(2);
    expect(after.quests).toBe(true);
    expect(after.gift1, 'цель gift1 пережила F5').toBe(true);
    expect(errors).toEqual([]);
  });
});
