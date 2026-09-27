const { test, expect } = require('@playwright/test');

const LEGACY_VP = {
  check:     { w: ['video/eto-chto-takoe-a.mp4'], b: ['video/eto-chto-takoe-a.mp4'] },
  capture:   { w: ['video/eto-chto-takoe-a.mp4'], b: ['video/eto-chto-takoe-a.mp4'] },
  threat:    { w: ['video/eto-chto-takoe-a.mp4'], b: ['video/eto-chto-takoe-a.mp4'] },
  defense:   { w: [], b: [] },
  promotion: { w: ['video/eto-chto-takoe-a.mp4'], b: ['video/eto-chto-takoe-a.mp4'] },
  sacrifice: { w: ['video/eto-chto-takoe-a.mp4'], b: ['video/eto-chto-takoe-a.mp4'] },
  blunder:   { w: ['video/eto-chto-takoe-a.mp4'], b: ['video/eto-chto-takoe-a.mp4'] },
  brilliant: { w: ['video/eto-chto-takoe-a.mp4'], b: ['video/eto-chto-takoe-a.mp4'] }
};

async function boot(page, seed) {
  await page.route('**://www.gstatic.com/**', r =>
    r.fulfill({ contentType: 'application/javascript', body: '/* stub */' }));
  await page.addInitScript(() => { try { localStorage.setItem('chesher_visited', '1'); } catch(e) {} });
  if (seed) await page.addInitScript(s => { try { localStorage.setItem('chesher_meme_cfg', s); } catch(e) {} }, JSON.stringify(seed));
  await page.goto('/');
  await page.waitForFunction(() => typeof cfg !== 'undefined' && typeof MemeConfig !== 'undefined', null, { timeout: 20000 });
}

test('clean defaults are event-based and distinct', async ({ page }) => {
  await boot(page, null);
  const r = await page.evaluate(() => {
    const vp = MemeConfig.get('videoPresets');
    const one = k => vp[k].w[0];
    return { vp, check: one('check'), capture: one('capture'), threat: one('threat'),
             defense: vp.defense.w.length, promotion: one('promotion'),
             sacrifice: one('sacrifice'), blunder: one('blunder'), brilliant: one('brilliant') };
  });
  expect(r.check).toBe('video/net.mp4');
  expect(r.capture).toBe('video/this-is-sparta.mp4');
  expect(r.threat).toBe('video/why-are-you-running.mp4');
  expect(r.defense).toBe(0);
  expect(r.promotion).toBe('video/vot-eto-povorot.mp4');
  expect(r.sacrifice).toBe('video/titry-robert.mp4');
  expect(r.blunder).toBe('video/a-che-tak-mozhno.mp4');
  expect(r.brilliant).toBe('video/daaaammmmm.mp4');
  const all = [r.check, r.capture, r.threat, r.promotion, r.sacrifice, r.blunder, r.brilliant];
  expect(new Set(all).size).toBe(7);
});

test('legacy saved config (one video everywhere) migrates to event-based', async ({ page }) => {
  await boot(page, { enabled: true, reactions: true, videoPresets: LEGACY_VP });
  const r = await page.evaluate(() => {
    const vp = MemeConfig.get('videoPresets');
    return { check: vp.check.w[0], capture: vp.capture.w[0], brilliant: vp.brilliant.w[0],
             enabled: MemeConfig.get('enabled') };
  });
  expect(r.enabled).toBe(true);
  expect(r.check).toBe('video/net.mp4');
  expect(r.capture).toBe('video/this-is-sparta.mp4');
  expect(r.brilliant).toBe('video/daaaammmmm.mp4');
  // миграция сохранена
  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('chesher_meme_cfg')).videoPresets.check.w[0]);
  expect(persisted).toBe('video/net.mp4');
});

test('user-customized presets are NOT touched', async ({ page }) => {
  const custom = JSON.parse(JSON.stringify(LEGACY_VP));
  custom.check = { w: ['video/sho-opyat.mp4'], b: ['video/sho-opyat.mp4'] };
  await boot(page, { enabled: true, videoPresets: custom });
  const r = await page.evaluate(() => {
    const vp = MemeConfig.get('videoPresets');
    return { check: vp.check.w[0], capture: vp.capture.w[0] };
  });
  expect(r.check).toBe('video/sho-opyat.mp4');   // правка юзера сохранена
  expect(r.capture).toBe('video/eto-chto-takoe-a.mp4'); // чужие не тронуты (isLegacyDefault=false)
});
