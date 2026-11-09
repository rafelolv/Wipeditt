import test from 'node:test';
import assert from 'node:assert/strict';
import { RedditBrowser } from '../src/desktop/reddit-browser.js';
import { AppError } from '../src/errors.js';
import { setup, item } from './helpers.mjs';

function fixture() {
  const { scheduler, now } = setup();
  const id = item().id;
  const link = `https://old.reddit.com/r/privacy/comments/post/title/${id.slice(3)}/`;
  let url = `${link}?context=0`, text = 'First source', localReads = 0, navigations = 0;
  const browser = new RedditBrowser({ scheduler, contents: { getURL: () => url, isLoadingMainFrame: () => false } });
  browser.links.set(id, link);
  browser.dom = async () => { localReads++; return item({ text }); };
  browser.getRaw = async () => { navigations++; return item({ text: 'Fresh navigation source' }); };
  return { browser, scheduler, now, id, setURL: value => { url = value; }, setText: value => { text = value; }, counts: () => ({ localReads, navigations }) };
}

test('repeated live DOM reads consume no network interval and never cache item text', async () => {
  const f = fixture();
  await f.scheduler.request(async () => true);
  assert.equal((await f.browser.get(f.id)).text, 'First source');
  f.setText('Changed live source');
  assert.equal((await f.browser.get(f.id)).text, 'Changed live source');
  assert.equal(f.now(), 1700000000000);
  assert.equal(f.scheduler.stats.requests, 1);
  assert.deepEqual(f.counts(), { localReads: 2, navigations: 0 });
});

test('queued navigation invalidates local reads and preserves network pacing', async () => {
  const f = fixture();
  await f.scheduler.request(async () => true);
  const moved = f.scheduler.request(async () => { f.setURL('https://old.reddit.com/user/other/'); }, { local: true });
  const read = f.browser.get(f.id);
  await moved;
  assert.equal((await read).text, 'Fresh navigation source');
  assert.equal(f.now(), 1700000001500);
  assert.deepEqual(f.counts(), { localReads: 0, navigations: 1 });
});

test('local reads preserve account guards and route body expansion through network pacing', async () => {
  const f = fixture();
  f.browser.dom = async () => { throw new AppError('ACCOUNT_CHANGED', 'Changed'); };
  await assert.rejects(f.browser.get(f.id), { code: 'ACCOUNT_CHANGED' });
  assert.equal(f.counts().navigations, 0);
  await f.scheduler.request(async () => true);
  f.browser.dom = async () => item({ needsBody: true });
  assert.equal((await f.browser.get(f.id)).text, 'Fresh navigation source');
  assert.equal(f.now(), 1700000001500);
});
