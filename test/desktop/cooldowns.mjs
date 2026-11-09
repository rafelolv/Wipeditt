import assert from 'node:assert/strict';

export async function verifyCooldownRecovery(application, page) {
  const initialWrites = await application.evaluate(() => globalThis.fixture.writes.length);
  await application.evaluate(() => {
    const realNow = Date.now;
    const clock = { offset: 0, realNow };
    globalThis.cooldownClock = clock;
    Date.now = () => realNow() + clock.offset;
    globalThis.fixture.username = 'fixture_user';
  });
  try {
    await page.locator('#connect').click();
    await page.locator('#verify').waitFor();
    await application.evaluate(async ({ webContents, session }) => {
      const remote = webContents.getAllWebContents().find(contents => contents.session === session.fromPartition('wipeditt-reddit'));
      await remote.executeJavaScript('document.querySelector("#fixture-login").click()');
    });
    await page.locator('#account').filter({ hasText: 'fixture_user' }).waitFor({ timeout: 20000 });
    await page.locator('#filters').evaluate(node => { node.open = true; });
    await page.locator('#contains').fill('');
    await page.locator('#type').selectOption('comment');
    const pagesBefore = await application.evaluate(() => { globalThis.fixture.cooldownNextProfile = true; return globalThis.fixture.historyPages.length; });
    await page.locator('#scan').click();
    await page.locator('#cooldown').filter({ hasText: 'Resuming automatically' }).waitFor({ timeout: 10000 });
    assert.equal(await page.locator('#stop').isEnabled(), true);
    await application.evaluate(async ({ webContents, session }) => {
      globalThis.cooldownClock.offset += 100000;
      const remote = webContents.getAllWebContents().find(contents => contents.session === session.fromPartition('wipeditt-reddit'));
      await remote.executeJavaScript(`(async()=>{
        await new Promise(resolve=>{const image=new Image();image.onload=image.onerror=resolve;image.src='https://old.reddit.com/fixture-background-limit?image';});
        await fetch('https://old.reddit.com/fixture-background-limit?xhr');
      })()`);
    });
    await page.waitForFunction(() => {
      const seconds = Number(document.getElementById('cooldown').textContent.match(/·\s*(\d+)s/)?.[1]);
      return seconds > 0 && seconds < 550;
    }, null, { timeout: 5000 });
    await page.locator('#stop').click();
    await page.waitForFunction(() => !document.getElementById('scan').disabled);
    assert.equal(await application.evaluate(() => globalThis.fixture.historyPages.length), pagesBefore + 1, 'Stop must not dispatch the next navigation');
    await page.locator('#scan').click();
    await page.locator('#cooldown').filter({ hasText: 'Resuming automatically' }).waitFor({ timeout: 10000 });
    assert.equal(await application.evaluate(() => globalThis.fixture.historyPages.length), pagesBefore + 1, 'Stop does not bypass the remaining cooldown');
    await application.evaluate(() => { globalThis.cooldownClock.offset += 600000; });
    await page.locator('#review-section').waitFor({ timeout: 20000 });
    assert.equal(await application.evaluate(() => globalThis.fixture.writes.length), initialWrites);
    await page.locator('#disconnect').click();
    console.log('Cooldown recovery passed: native quota response, ignored image/XHR 429 noise, decreasing countdown, responsive Stop, preserved deadline and automatic continuation after expiry. No writes submitted.');
  } finally {
    await application.evaluate(() => { Date.now = globalThis.cooldownClock.realNow; globalThis.cooldownClock.offset = 0; });
  }
}
