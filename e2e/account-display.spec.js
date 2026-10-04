const {test, expect} = require('@playwright/test');
test.beforeEach(async ({page}) => {
  await page.route(/https:\/\/www\.gstatic\.com\/firebasejs\//, route => route.fulfill({contentType:'application/javascript',body:''}));
  await page.goto('/');
  await page.waitForFunction(() => typeof NetUI !== 'undefined' && typeof renderProfBar === 'function');
  await page.evaluate(() => showScreen('scrMenu'));
  await expect(page.locator('#scrMenu')).toBeVisible();
});
test('admin badge survives both profile renderers and login button is hidden', async ({page}) => {
  await page.evaluate(() => {
    ChesAuth.user={uid:'test-admin',isAnonymous:false};
    ChesAuth.profile={name:'Admin',admin:true,playerId:'CHS-TEST'};
    NetUI._syncFirebaseProfile(ChesAuth.user);
    NetUI._updateProfileBar(ChesAuth.user);
  });
  await expect(page.locator('#pbName [title="Администратор"]')).toHaveCount(1);
  await expect(page.locator('#mAuth')).toBeHidden();
});
test('role does not leak from previous admin to another account or guest', async ({page}) => {
  const result=await page.evaluate(() => {
    ChesAuth.user={uid:'regular',isAnonymous:false};
    ProfilesManager.getCurrent().admin=true;
    ChesAuth.profile={name:'Regular',admin:false};
    NetUI._syncFirebaseProfile(ChesAuth.user);
    NetUI._updateProfileBar(ChesAuth.user);
    const admin=ProfilesManager.getCurrent().admin;
    const stars=document.querySelectorAll('#pbName [title="Администратор"]').length;
    ChesAuth.user=null;ChesAuth.profile=null;renderProfBar();
    return {admin,stars,login:document.getElementById('mAuth').style.display};
  });
  expect(result).toEqual({admin:false,stars:0,login:''});
});
test('restored login hides login button before slow cloud profile resolves', async ({page}) => {
  await page.evaluate(() => {
    firebaseAuth={onAuthStateChanged:fn=>window.authCallback=fn};
    firebaseDB={collection:()=>({doc:()=>({get:()=>new Promise(resolve=>window.resolveProfile=resolve)})})};
    ChesAuth.flushPending=()=>{};
    ChesAuth.listeners=[];
    ChesAuth.init();
    window.authPromise=window.authCallback({uid:'test-admin',isAnonymous:false});
  });
  await expect(page.locator('#mAuth')).toBeHidden();
  await page.evaluate(async () => {
    await window.authCallback(null);
    window.resolveProfile({exists:true,data:()=>({admin:true})});
    await window.authPromise;
  });
  expect(await page.evaluate(()=>ChesAuth.user===null && ChesAuth.profile===null)).toBe(true);
});
test('server admin claim is rendered without profile admin field', async ({page}) => {
  await page.evaluate(async () => {
    firebaseAuth={onAuthStateChanged:fn=>window.authCallback=fn};
    firebaseDB={collection:()=>({doc:()=>({get:async()=>({exists:true,data:()=>({name:'Claim Admin'})})})})};
    ChesAuth.flushPending=()=>{};
    ChesAuth.listeners=[user=>{NetUI._syncFirebaseProfile(user);NetUI._updateProfileBar(user);}];
    ChesAuth.init();
    await window.authCallback({uid:'claim-admin',isAnonymous:false,getIdTokenResult:async()=>({claims:{admin:true}})});
  });
  await expect(page.locator('#pbName [title="Администратор"]')).toHaveCount(1);
  await expect(page.locator('#mAuth')).toBeHidden();
});