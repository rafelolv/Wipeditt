import assert from 'node:assert/strict';

export async function verifyProfileHistory(application, page) {
  const before = await application.evaluate(() => {
    const f = globalThis.fixture;
    f.profileHistory = true;
    f.items.t1_archive = { ...f.items.t1_abc, id: 't1_archive', text: 'Older owned history from 2020.', createdAt: '2020-01-01T12:00:00Z' };
    f.items.t1_oldest = { ...f.items.t1_abc, id: 't1_oldest', text: 'Oldest owned history from 2018.', createdAt: '2018-01-01T12:00:00Z' };
    return { pages: f.historyPages.length, writes: f.writes.length };
  });
  try {
    await page.locator('#scan').click();
    await page.locator('#review-section').waitFor({ timeout: 20000 });
    assert.match(await page.locator('#counts').textContent(), /3 found · 3 selected/);
    for (const id of ['t1_abc', 't1_archive', 't1_oldest']) assert.equal(await page.locator(`.item[data-id="${id}"] input`).isChecked(), true);
    const observed = await application.evaluate(start => ({ pages: globalThis.fixture.historyPages.slice(start), writes: globalThis.fixture.writes.length }), before.pages);
    assert.deepEqual(observed.pages.map(value => { const url = new URL(value); return url.pathname + url.search; }).filter(value => value.startsWith('/user/fixture_user/')), [
      '/user/fixture_user/comments/?sort=new&limit=100',
      '/user/fixture_user/',
      '/user/fixture_user/?count=25&after=t1_abc',
      '/user/fixture_user/?count=50&after=t1_archive'
    ]);
    assert.equal(observed.writes, before.writes);
    await page.locator('#change-search').click();
    console.log('Profile history passed: exhausted comments tab, automatic overview continuation, native root URLs, unlabelled next links, previous-link rejection, duplicate/post exclusion and selected 2018/2020 comments. No writes submitted.');
  } finally {
    await application.evaluate(() => { const f = globalThis.fixture; f.profileHistory = false; delete f.items.t1_archive; delete f.items.t1_oldest; });
  }
}
