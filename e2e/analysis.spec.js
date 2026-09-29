const { test, expect } = require('@playwright/test');

/* ============================================================
   ЧЕШЕР v0.25.0 — разбор партии после поражения
   ============================================================ */

async function boot(page) {
  await page.route('**://www.gstatic.com/**', r =>
    r.fulfill({ contentType: 'application/javascript', body: '/* stubbed for e2e */' }));
  await page.addInitScript(() => { try { localStorage.setItem('chesher_visited', '1'); } catch(e) {} });
  await page.goto('/');
  await page.waitForFunction(() => typeof cfg !== 'undefined' && typeof ChesAnalysis !== 'undefined', null, { timeout: 20000 });
  await page.waitForTimeout(250);
}

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e && e.message || e)));
  return errors;
}

/* Синтетическая партия: белые потеряли коня на 1-м ходу,
   чёрные на 2-м — потеряли пешку (для human='b') */
function syntheticEntry() {
  return {
    startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    moves: [
      { fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKB1R b KQkq - 0 1', notation: 'Nf3?' },
      { fen: 'rnbqkbnr/pppppp1p/8/8/4P3/8/PPPP1PPP/RNBQKB1R w KQkq - 0 2', notation: 'h6??' }
    ]
  };
}

test.describe('v0.25.0 — разбор партии', () => {

  test('анализ находит ходы игрока с просадкой, чужие — игнорирует', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);

    const res = await page.evaluate((entry) => {
      const w = ChesAnalysis.analyze(entry, 'w');
      const b = ChesAnalysis.analyze(entry, 'b');
      return { w: w, b: b };
    }, syntheticEntry());

    // human='w': только 0-й ход (потеря коня, −3), чёрный ход не трогает
    expect(res.w.length).toBe(1);
    expect(res.w[0].idx).toBe(0);
    expect(res.w[0].delta).toBe(-3);
    expect(res.w[0].notation).toBe('Nf3?');

    // human='b': только 1-й ход (потеря пешки)
    expect(res.b.length).toBe(1);
    expect(res.b[0].idx).toBe(1);

    // Пустые входы безопасны
    const empty = await page.evaluate(() => ({
      a: ChesAnalysis.analyze(null, 'w'),
      b: ChesAnalysis.analyze({}, 'w'),
      c: ChesAnalysis.analyze({ moves: [] }, 'w')
    }));
    expect(empty.a).toEqual([]);
    expect(empty.b).toEqual([]);
    expect(empty.c).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('секция в оверлее: строка просадки и переход в реплей на нужный ход', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);

    const ui = await page.evaluate((entry) => {
      const cu = ProfilesManager.getCurrent();
      cu.matchHistory.push(entry);
      saveProfiles();
      const found = ChesAnalysis.analyze(entry, 'w');
      renderGameAnalysis(found, entry);
      openOv('ovOver'); // как в реальном конце партии
      return { found: found.length, display: document.getElementById('goAnalysis').style.display };
    }, syntheticEntry());
    expect(ui.found).toBe(1);
    expect(ui.display, 'секция видима').toBe('');

    await expect(page.locator('#goAnalysis .goAnTitle')).toContainText('Где всё пошло не так');
    await expect(page.locator('#goAnalysis .goAnRow')).toHaveCount(1);
    await expect(page.locator('#goAnalysis .goAnTx')).toContainText('Ход 1. Nf3?');

    // «Смотреть» → реплей открыт на позиции ПОСЛЕ хода (rvIdx = 1)
    await page.click('#goAnalysis .goAnBtn');
    await expect(page.locator('#ovReplay')).toBeVisible();
    await expect(page.locator('#rvInfo')).toContainText('Ход 1 из 3');

    expect(errors).toEqual([]);
  });

  test('конец партии без просадок: секция скрыта, ошибок нет', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);

    // Партия: один ход e4 (просадки нет) и сдача
    await page.evaluate(() => {
      cfg.gameMode = 'bot'; cfg.modeId = 'bot'; cfg.bot = 'easy'; cfg.human = 'w'; cfg.timeSec = 0;
      botMove = function() {};
      newGame();
      hideAllScreens();
    });
    await page.waitForTimeout(200);
    await page.click('#grid .sq[data-r="6"][data-c="4"]');
    await page.click('#grid .sq[data-r="4"][data-c="4"]');
    await page.click('#btnRes');
    await page.click('#confY');
    await expect(page.locator('#ovOver')).toBeVisible();

    // Анализ асинхронный (350мс) — ждём и проверяем, что секция не появилась
    await page.waitForTimeout(700);
    const st = await page.evaluate(() => {
      const box = document.getElementById('goAnalysis');
      return { display: box.style.display, rows: box.querySelectorAll('.goAnRow').length };
    });
    expect(st.rows, 'e4 без ответа — просадки нет').toBe(0);
    expect(st.display).toBe('none');
    expect(errors).toEqual([]);
  });
});
