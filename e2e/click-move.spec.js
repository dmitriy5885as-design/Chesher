const { test, expect } = require('@playwright/test');

test.describe('Клик-клик и драг', () => {
  test.beforeEach(async ({ page }) => {
    // Не зависаем на внешнем CDN firebase в тестах: приложение работает без него
    await page.route('**://www.gstatic.com/**', route =>
      route.fulfill({ contentType: 'application/javascript', body: '/* stubbed for e2e */' }));
    await page.addInitScript(() => { try { localStorage.setItem('chesher_visited', '1'); } catch(e) {} });
    await page.goto('/');
    await page.waitForFunction(() => typeof cfg !== 'undefined' && typeof newGame === 'function', null, { timeout: 20000 });
    await page.waitForTimeout(300);
  });

  async function startGame(page, human) {
    await page.evaluate((h) => {
      cfg.gameMode = 'bot'; cfg.modeId = 'chess'; cfg.bot = 'easy'; cfg.human = h; cfg.memes = false; cfg.timeSec = 0;
      botMove = function() { window.__botSkipped = true; };
      newGame();
      hideAllScreens();
    }, human);
    await page.waitForTimeout(300);
    expect(await page.locator('#boardBox').isVisible()).toBe(true);
  }

  test('тап-тап: выбрать фигуру -> ход без зажатия', async ({ page }) => {
    await startGame(page, 'w');

    await page.click('#grid .sq[data-r="6"][data-c="4"]');
    await page.waitForTimeout(150);
    const sel = await page.evaluate(() => ({
      sel: !!(typeof selected !== 'undefined' && selected && selected.r === 6 && selected.c === 4),
      paths: (typeof legalCache !== 'undefined' ? legalCache.length : 0),
      ghost: !!document.querySelector('.dragGhost'),
      suppress: (typeof _suppressClickTs !== 'undefined' ? _suppressClickTs : -1)
    }));
    expect(sel.sel).toBe(true);
    expect(sel.paths).toBeGreaterThan(0);
    expect(sel.ghost).toBe(false);
    expect(sel.suppress).toBe(0);

    await page.click('#grid .sq[data-r="4"][data-c="4"]');
    await page.waitForTimeout(150);
    const moved = await page.evaluate(() => ({
      pawn: S.board[4][4] === 'P',
      turn: S.turn
    }));
    expect(moved.pawn).toBe(true);
    expect(moved.turn).toBe('b');
    expect(await page.locator('.dragGhost').count()).toBe(0);
  });

  test('намеренный драг e2-e4 работает', async ({ page }) => {
    await startGame(page, 'w');

    const from = page.locator('#grid .sq[data-r="6"][data-c="4"]');
    const to = page.locator('#grid .sq[data-r="4"][data-c="4"]');
    const fb = await from.boundingBox();
    const tb = await to.boundingBox();
    await page.mouse.move(fb.x + fb.width / 2, fb.y + fb.height / 2);
    await page.mouse.down();
    await page.mouse.move(fb.x + fb.width / 2, tb.y + tb.height / 2, { steps: 10 });
    await page.waitForTimeout(60);
    expect(await page.locator('.dragGhost').count()).toBe(1);
    await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(150);

    const moved = await page.evaluate(() => S.board[4][4] === 'P' && S.turn === 'b');
    expect(moved).toBe(true);
    expect(await page.locator('.dragGhost').count()).toBe(0);
    expect(await page.locator('.sq.dragT').count()).toBe(0);
  });

  test('за чёрных (доска перевёрнута): клик-клик и драг без переворота призрака', async ({ page }) => {
    await startGame(page, 'b');

    // Чёрные ходят вторыми — дадим белым ход через executeMove
    await page.evaluate(() => {
      const m = S.getLegalMoves(6, 4).find(x => x.tr === 4 && x.tc === 4);
      executeMove(m);
    });
    await page.waitForTimeout(200);

    // Тап по пешке e7 (r1,c4) -> тап по e5 (r3,c4)
    await page.click('#grid .sq[data-r="1"][data-c="4"]');
    await page.waitForTimeout(150);
    const sel = await page.evaluate(() => !!(selected && selected.r === 1 && selected.c === 4));
    expect(sel).toBe(true);

    await page.click('#grid .sq[data-r="3"][data-c="4"]');
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => S.board[3][4] === 'p')).toBe(true);

    // Драг чёрной пешки d7-d5: призрак должен существовать и НЕ терять позицию
    await page.evaluate(() => {
      const m = S.getLegalMoves(6, 3).find(x => x.tr === 4 && x.tc === 3);
      executeMove(m); // белые d2-d4, чтобы потом драгнуть d7-d5
    });
    await page.waitForTimeout(200);

    const from = page.locator('#grid .sq[data-r="1"][data-c="3"]');
    const to = page.locator('#grid .sq[data-r="3"][data-c="3"]');
    const fb = await from.boundingBox();
    const tb = await to.boundingBox();
    await page.mouse.move(fb.x + fb.width / 2, fb.y + fb.height / 2);
    await page.mouse.down();
    await page.mouse.move(fb.x + fb.width / 2, tb.y + tb.height / 2, { steps: 10 });
    await page.waitForTimeout(60);
    await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2, { steps: 5 });
    await page.waitForTimeout(80);

    const ghost = await page.evaluate((pt) => {
      const g = document.querySelector('.dragGhost');
      if(!g) return null;
      const r = g.getBoundingClientRect();
      const dm = new DOMMatrix(getComputedStyle(g).transform);
      const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
      return {
        a: dm.a, d: dm.d,
        centered: Math.abs(cx - pt.x) < 3 && Math.abs(cy - pt.y) < 3,
        w: r.width
      };
    }, { x: tb.x + tb.width / 2, y: tb.y + tb.height / 2 });
    expect(ghost).not.toBeNull();
    // поворот 180 сохранён (отрицательные a/d) — призрак не «перевернулся» насильно
    expect(ghost.a).toBeLessThan(0);
    expect(ghost.d).toBeLessThan(0);
    // позиция/масштаб не потеряны: призрак отцентрован под курсором, ширина клетки
    expect(ghost.centered).toBe(true);
    expect(ghost.w).toBeGreaterThan(10);

    await page.mouse.up();
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => S.board[3][3] === 'p')).toBe(true);
    expect(await page.locator('.dragGhost').count()).toBe(0);
  });
});
