const { test, expect } = require('@playwright/test');

/* ============================================================
   Магазин 2.0 — превью-панель, вкладка «🖼 Фоны»,
   переработанный отчёт о партии
   ============================================================ */

async function boot(page) {
  await page.route('**://www.gstatic.com/**', r =>
    r.fulfill({ contentType: 'application/javascript', body: '/* stubbed for e2e */' }));
  await page.addInitScript(() => { try { localStorage.setItem('chesher_visited', '1'); } catch(e) {} });
  await page.goto('/');
  await page.waitForFunction(() => typeof cfg !== 'undefined' && typeof Store !== 'undefined', null, { timeout: 20000 });
  await page.waitForTimeout(250);
}

async function openShop(page, tab) {
  await page.click('#mShop');
  await expect(page.locator('#scrShop')).toBeVisible();
  if (tab) await page.click(`#shopTabs .shopTab[data-tab="${tab}"]`);
}

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e && e.message || e)));
  return errors;
}

test.describe('Магазин 2.0 — превью и фоны', () => {

  test('7 вкладок; превью-панель скина обновляется по клику на карточку', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);
    await openShop(page);

    expect(await page.locator('#shopTabs .shopTab').count()).toBe(7);
    expect(await page.locator('#shopTabs .shopTab[data-tab="backgrounds"]').count()).toBe(1);

    // Превью скина: доска + 32 фигуры, название активного скина
    let pv = await page.evaluate(() => {
      const el = document.getElementById('shopPreview');
      return {
        visible: el.style.display !== 'none',
        cells: el.querySelectorAll('.spBoard .spSq').length,
        pieces: el.querySelectorAll('.spBoard .piece').length,
        name: el.querySelector('.spName').textContent
      };
    });
    expect(pv.visible).toBe(true);
    expect(pv.cells).toBe(64);
    expect(pv.pieces).toBe(32);
    expect(pv.name).toBe('Классика');

    // Плашка табов: без горизонтального скролла и обрезки вкладок (скроллбар не перекрывает выбор)
    const tb = await page.evaluate(() => {
      const el = document.getElementById('shopTabs');
      const btns = [...el.querySelectorAll('.shopTab')];
      const r = el.getBoundingClientRect();
      const last = btns[btns.length - 1].getBoundingClientRect();
      return { sw: el.scrollWidth, cw: el.clientWidth, stripB: r.bottom, lastB: last.bottom };
    });
    expect(tb.sw).toBeLessThanOrEqual(tb.cw);
    expect(tb.lastB).toBeLessThanOrEqual(tb.stripB);

    // Превью-поле строго квадратное, клетки равные (пропорциональность)
    const sq = await page.evaluate(() => {
      const el = document.querySelector('#shopPreview .spBoard');
      const r = el.getBoundingClientRect();
      const rs = [...el.querySelectorAll('.spSq')].map(c => { const b = c.getBoundingClientRect(); return { w: b.width, h: b.height }; });
      return {
        bw: r.width, bh: r.height,
        wSpread: Math.max(...rs.map(x => x.w)) - Math.min(...rs.map(x => x.w)),
        hSpread: Math.max(...rs.map(x => x.h)) - Math.min(...rs.map(x => x.h))
      };
    });
    expect(sq.bw).toBeCloseTo(sq.bh, 0);
    expect(sq.wSpread).toBeLessThanOrEqual(1);
    expect(sq.hSpread).toBeLessThanOrEqual(1);

    // Каталог: ровно 10 скинов
    expect(await page.locator('#shopGrid .shopItem[data-pv-type="skin"]').count()).toBe(10);

    // Клик по карточке «Киберпанк» → превью переключается
    await page.click('#shopGrid .shopItem[data-pv-type="skin"][data-pv-id="cyber"]');
    pv = await page.evaluate(() => {
      const el = document.getElementById('shopPreview');
      return { name: el.querySelector('.spName').textContent, skin: !!el.querySelector('.skin-cyber') };
    });
    expect(pv.name).toBe('Киберпанк');
    expect(pv.skin).toBe(true);

    // Пиксельный скин: превью-доска — текущая доска игрока, а не палитра Game Boy
    await page.click('#shopGrid .shopItem[data-pv-type="skin"][data-pv-id="pixel"]');
    const px = await page.evaluate(() => {
      const el = document.getElementById('shopPreview');
      const bd = BOARDS[cfg.board];
      return {
        l: getComputedStyle(el.querySelector('.spSq.l')).backgroundColor,
        d: getComputedStyle(el.querySelector('.spSq.d')).backgroundColor,
        bdL: bd.light, bdD: bd.dark
      };
    });
    const hex2rgb = h => { const n = parseInt(h.slice(1), 16); return `rgb(${n >> 16 & 255}, ${n >> 8 & 255}, ${n & 255})`; };
    expect(px.l).toBe(hex2rgb(px.bdL));
    expect(px.d).toBe(hex2rgb(px.bdD));
    expect(px.l).not.toBe('rgb(155, 188, 15)');
    expect(errors).toEqual([]);
  });

  test('вкладка досок: превью-доска 8×8; вкладка фонов: 10 карточек', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);

    await openShop(page, 'boards');
    const bd = await page.evaluate(() => {
      const el = document.getElementById('shopPreview');
      return { name: el.querySelector('.spName').textContent, cells: el.querySelectorAll('.spSq').length, dark: el.querySelectorAll('.spSq.d').length };
    });
    expect(bd.name).toBe('Классика');
    expect(bd.cells).toBe(64);
    expect(bd.dark).toBe(32);

    await page.click('#shopTabs .shopTab[data-tab="backgrounds"]');
    expect(await page.locator('#shopGrid .shopItem[data-pv-type="background"]').count()).toBe(10);
    expect(errors).toEqual([]);
  });

  test('покупка и экипировка фона: cfg/bg-класс/--bgx, превью переключается', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);
    await openShop(page, 'backgrounds');

    await page.evaluate(() => { const cu = ProfilesManager.getCurrent(); cu.addCoins(2000); saveProfiles(); renderCoins(); });
    await page.click('#shopGrid .buyBtn[data-type="background"][data-id="space"]');

    const st = await page.evaluate(() => ({
      cfgBg: cfg.bg,
      coins: ProfilesManager.getCurrent().coins,
      owned: ProfilesManager.getCurrent().owned.includes('bg_space'),
      bodyCustom: document.body.classList.contains('bg-custom'),
      varSet: document.documentElement.style.getPropertyValue('--bgx'),
      screenCustom: !!document.querySelector('.screen.bg-custom')
    }));
    expect(st.cfgBg).toBe('space');
    expect(st.owned).toBe(true);
    expect(st.bodyCustom).toBe(true);
    expect(st.varSet).toBeTruthy();
    expect(st.screenCustom).toBe(true);

    // Фон интерфейса — на всех экранах, кроме стартового (вход)
    const screens = await page.evaluate(() => {
      const o = {};
      document.querySelectorAll('.screen').forEach(s => { o[s.id] = s.classList.contains('bg-custom'); });
      return o;
    });
    expect(screens.scrAuth).toBe(false);
    Object.keys(screens).filter(id => id !== 'scrAuth')
      .forEach(id => expect(screens[id], id + ' должен иметь bg-custom').toBe(true));

    // Превью переключилось на купленный фон
    const pv = await page.evaluate(() => {
      const el = document.getElementById('shopPreview');
      return { name: el.querySelector('.spName').textContent, bg: !!el.querySelector('.spBg') };
    });
    expect(pv.name).toBe('Космос');
    expect(pv.bg).toBe(true);

    // Повторный клик — только экипировка (без списания), нехватка монет блокируется
    await page.evaluate(() => { const cu = ProfilesManager.getCurrent(); cu.coins = 0; saveProfiles(); renderCoins(); });
    await page.click('#shopGrid .buyBtn[data-type="background"][data-id="forest"]');
    const denied = await page.evaluate(() => ({
      coins: ProfilesManager.getCurrent().coins,
      owned: ProfilesManager.getCurrent().owned.includes('bg_forest'),
      cfgBg: cfg.bg
    }));
    expect(denied.coins).toBe(0);
    expect(denied.owned).toBe(false);
    expect(denied.cfgBg).toBe('space');
    expect(errors).toEqual([]);
  });

  test('отчёт о партии: бейдж, тайлы и тексты победы', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);

    await page.evaluate(() => {
      cfg.gameMode = 'bot'; cfg.modeId = 'bot'; cfg.bot = 'easy'; cfg.human = 'w'; cfg.timeSec = 0;
      botMove = function() {};
      newGame();
      hideAllScreens();
      endGame('checkmate', S.humanColor);
    });
    await expect(page.locator('#ovOver')).toBeVisible();

    const go = await page.evaluate(() => {
      const badge = document.getElementById('goBadge');
      const modal = document.querySelector('#ovOver .modal');
      return {
        badge: badge.textContent,
        badgeCls: badge.className,
        modalCls: modal.className,
        hasT: !!document.getElementById('goT'),
        hasS: !!document.getElementById('goS'),
        tiles: [...document.querySelectorAll('#goStats .goTile')].map(t => t.textContent),
        goT: document.getElementById('goT').textContent,
        scroll: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth
      };
    });
    expect(go.badge).toBe('🏆');
    expect(go.badgeCls).toContain('win');
    expect(go.modalCls).toContain('goModal');
    expect(go.hasT && go.hasS).toBe(true);
    expect(go.goT).toContain('Победа');
    // Тайлы: награда и опыт (дельта ELO может быть 0 у лёгкого бота)
    expect(go.tiles.join('|')).toContain('🪙 +10');
    expect(go.tiles.join('|')).toContain('XP');
    expect(go.scroll).toBeLessThanOrEqual(go.cw);
    expect(errors).toEqual([]);
  });

  test('мобильный 360px: вкладка «Фоны» без горизонтального переполнения', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);
    await page.setViewportSize({ width: 360, height: 740 });
    await openShop(page, 'backgrounds');

    const bad = await page.evaluate(() => {
      const cw = document.documentElement.clientWidth;
      const scrShop = document.querySelector('#scrShop');
      const overflow = [];
      document.querySelectorAll('#scrShop *').forEach(el => {
        if (el.scrollWidth > cw && getComputedStyle(el).overflowX === 'visible') {
          overflow.push((el.id ? '#' + el.id : el.className) + ' sw=' + el.scrollWidth);
        }
      });
      return { cw, doc: document.documentElement.scrollWidth, shop: scrShop.scrollWidth, overflow: overflow.slice(0, 5) };
    });
    expect(bad.doc).toBeLessThanOrEqual(bad.cw);
    expect(bad.shop).toBeLessThanOrEqual(bad.cw);
    expect(bad.overflow).toEqual([]);
    expect(errors).toEqual([]);
  });
});
