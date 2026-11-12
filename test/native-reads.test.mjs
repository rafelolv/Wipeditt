import test from 'node:test';
import assert from 'node:assert/strict';
import { RedditBrowser } from '../src/desktop/reddit-browser.js';
import { AppError } from '../src/errors.js';
import { Engine } from '../src/engine.js';
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

test('native scans supplement the comments tab with profile pages, deduplicate and retain older matches', async () => {
  const { scheduler, now } = setup();
  const account = { id: 'reddit:owner', name: 'owner' };
  const root = 'https://old.reddit.com/user/owner/';
  const visited = [];
  const owned = (id, created) => item({ id, created, type: id.startsWith('t3_') ? 'post' : 'comment', author: account.name, authorId: account.id, permalink: `https://old.reddit.com/r/privacy/comments/post/title/${id.slice(3)}/` });
  const recent = owned('t1_recent', Date.parse('2025-01-01'));
  const older = owned('t1_older', Date.parse('2018-01-01'));
  const browser = new RedditBrowser({ scheduler, contents: {} });
  let current;
  browser.navigate = async url => { visited.push(url); current = url; };
  browser.account = async () => account;
  browser.dom = async () => {
    if (current.includes('/comments/')) return { items: [recent], after: null };
    if (current === root) return { items: [recent, owned('t3_post', recent.created)], after: `${root}?count=25&after=t1_recent` };
    return { items: [older], after: null };
  };
  const engine = new Engine({ adapter: browser, scheduler, now });
  const preview = await engine.scan({ type: 'comment', limit: 0 });
  assert.deepEqual(visited, [`${root}comments/?sort=new&limit=100`, root, `${root}?count=25&after=t1_recent`]);
  assert.deepEqual(preview.items.map(row => row.id), ['t1_recent', 't1_older']);
  assert.equal(preview.stats.eligible, 2);
  assert.equal(preview.completeHistory, false);
  visited.length = 0;
  const filtered = await engine.scan({ type: 'comment', before: '2020-01-01' });
  assert.deepEqual(filtered.items.map(row => row.id), ['t1_older']);
  assert.equal(visited.length, 3, 'an unmatched first tab must still discover older overview matches');
  visited.length = 0;
  await engine.scan({ type: 'comment', limit: 1 });
  assert.equal(visited.length, 1, 'an explicit user item cap must still stop scanning');
});

test('a newest comment listing near Reddit\'s per-ordering cap adds top, controversial and hot orderings', async () => {
  const { scheduler, now } = setup();
  const account = { id: 'reddit:owner', name: 'owner' };
  const root = 'https://old.reddit.com/user/owner';
  const visited = [];
  const owned = (id, created) => item({ id, created, type: 'comment', author: account.name, authorId: account.id, permalink: `https://old.reddit.com/r/privacy/comments/post/title/${id.slice(3)}/` });
  const recent = Array.from({ length: 950 }, (_, index) => owned(`t1_recent${index}`, Date.parse('2025-01-01') + index));
  const older = owned('t1_topolder', Date.parse('2018-01-01'));
  const controversial = owned('t1_controversial', Date.parse('2017-01-01'));
  const hot = owned('t1_hot', Date.parse('2016-01-01'));
  let current;
  const browser = new RedditBrowser({ scheduler, contents: {} });
  browser.navigate = async url => { visited.push(url); current = url; };
  browser.account = async () => account;
  browser.dom = async () => {
    if (current.includes('sort=new')) return { items: recent, after: null };
    if (current.includes('sort=top')) return { items: [recent[0], older], after: null };
    if (current.includes('sort=controversial')) return { items: [controversial], after: null };
    if (current.includes('sort=hot')) return { items: [hot], after: null };
    throw new Error(`Unexpected profile URL: ${current}`);
  };
  const engine = new Engine({ adapter: browser, scheduler, now });
  const preview = await engine.scan({ type: 'comment', limit: 0 });
  assert.deepEqual(visited, [
    `${root}/comments/?sort=new&limit=100`,
    `${root}/comments/?sort=top&t=all&limit=100`,
    `${root}/comments/?sort=controversial&t=all&limit=100`,
    `${root}/comments/?sort=hot&limit=100`
  ]);
  assert.equal(preview.stats.unique, 953);
  assert.equal(preview.stats.matched, 953);
  for (const id of ['t1_topolder', 't1_controversial', 't1_hot']) assert.ok(preview.items.some(row => row.id === id));
  assert.equal(preview.items.filter(row => row.id === 't1_recent0').length, 1, 'duplicate entries from another ordering stay de-duplicated');
});
