const { test, expect } = require('@playwright/test');
test('opponent name is displayed as text', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => typeof appendChat === 'function' && typeof cfg !== 'undefined');
  const result = await page.evaluate(() => {
    isMpGame = () => true;
    ChesMP.opponent = {name: '<img src=x onerror="window.injected=1">', ava: ''};
    opponentMuted = false;
    appendChat('opp', 'hello');
    const message = document.querySelector('#chatMsgs .chatMsg:last-child');
    return {name: message.querySelector('.author').textContent, images: message.querySelectorAll('img').length, injected: !!window.injected};
  });
  expect(result.name).toContain('<img');
  expect(result.images).toBe(0);
  expect(result.injected).toBe(false);
});
test('offline reload retains engine and local puzzle modules', async ({ page, context }) => {
  await page.goto('/');
  await page.waitForFunction(() => typeof Puzzles !== 'undefined');
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('./sw.js');
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, {once: true}));
  });
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => typeof ChessEngine !== 'undefined' && typeof Puzzles !== 'undefined' && typeof Progress !== 'undefined');
  expect(await page.evaluate(() => {const engine = new ChessEngine();engine.newGame();return engine.allLegalMoves('w').length;})).toBe(20);
});