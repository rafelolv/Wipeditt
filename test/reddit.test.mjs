import test from 'node:test';
import assert from 'node:assert/strict';
import { RedditAdapter, normalizeThing } from '../src/adapters/reddit.js';
import { Engine } from '../src/engine.js';
import { Scheduler } from '../src/scheduler.js';
import { makeReport } from '../src/report.js';

const thing = (changes = {}, kind = 't1') => ({ kind, data: { name: kind + '_abc', author: 'owner', author_fullname: 't2_owner', subreddit: 'privacy', body: 'Original fixture text', selftext: 'Fixture post', created_utc: 1700000000, score: 3, edited: false, is_self: true, permalink: '/r/privacy/comments/abc/example', ...changes } });
function setup({ writeStatus = 200, missing = false } = {}) {
  let time = 0;
  let content = thing();
  let currentIdentity = { id: 'owner', name: 'owner' };
  const calls = [];
  const scheduler = new Scheduler({ now: () => time, sleeper: async ms => { time += ms; } });
  const transport = async request => {
    const url = new URL(request.url);
    calls.push({ path: url.pathname, method: request.method, time });
    let data;
    if (url.pathname === '/api/v1/me') data = currentIdentity;
    else if (url.pathname.endsWith('/comments')) data = { kind: 'Listing', data: { children: [content], after: null } };
    else if (url.pathname === '/api/info') data = { kind: 'Listing', data: { children: missing ? [] : [content] } };
    else if (url.pathname === '/api/editusertext') {
      if (writeStatus !== 200) return { status: writeStatus, text: '{}', headers: {} };
      content.data.body = new URLSearchParams(request.body).get('text');
      data = { json: { errors: [] } };
    } else throw new Error('Unexpected path: ' + url.pathname);
    return { status: 200, text: JSON.stringify(data), headers: { 'x-ratelimit-remaining': '900' } };
  };
  const adapter = new RedditAdapter({ auth: { token: () => 'fixture-token' }, scheduler, transport });
  const engine = new Engine({ adapter, scheduler, now: () => time });
  return { adapter, engine, scheduler, calls, content, identity: changes => { currentIdentity = changes; } };
}
test('real adapter normalizes comments, self-post bodies and unknown metadata accurately', () => {
  assert.equal(normalizeThing(thing()).editable, true);
  assert.equal(normalizeThing(thing({}, 't3')).text, 'Fixture post');
  assert.equal(normalizeThing(thing({ is_self: false }, 't3')).editable, false);
  for (const changes of [{ archived: true }, { locked: true }, { removed_by_category: 'moderator' }, { body: '[removed]' }]) assert.equal(normalizeThing(thing(changes)).editable, false);
  assert.equal(normalizeThing(thing({ edited: undefined })).edited, null);
  assert.equal(normalizeThing(thing({ name: 'invalid' })), null);
});
test('OAuth adapter scans, rechecks ownership and verifies anonymization through HTTP fixtures', async () => {
  const { engine, scheduler, calls, content } = setup();
  const options = { type: 'comment', replacement: 'Private now' };
  const preview = await engine.scan(options);
  assert.equal(preview.items[0].authorId, 't2_owner');
  engine.confirmationFor(options);
  const result = await engine.execute(options, { confirmed: true });
  assert.equal(result.records[0].state, 'anonymized');
  assert.equal(content.data.body, 'Private now');
  const write = calls.findIndex(call => call.method === 'POST');
  assert.deepEqual(calls.slice(write - 2, write).map(call => call.path), ['/api/v1/me', '/api/info']);
  for (let i = 1; i < calls.length; i++) assert.ok(calls[i].time - calls[i - 1].time >= 1500, 'every HTTP request is paced');
  assert.equal(makeReport(result, '0.2.0', scheduler.stats).simulation, false);
});
test('real adapter refuses content whose author identity changed', async () => {
  const { engine, content, calls } = setup();
  await engine.scan({ type: 'comment' }); engine.confirmationFor({ type: 'comment' });
  content.data.author_fullname = 't2_other';
  const result = await engine.execute({ type: 'comment' }, { confirmed: true });
  assert.equal(result.records[0].state, 'skipped');
  assert.ok(!calls.some(call => call.method === 'POST'));
});
test('OAuth permission errors stop writes; failed write responses are uncertain', async () => {
  for (const status of [401, 403, 500]) {
    const { engine, calls } = setup({ writeStatus: status });
    await engine.scan({ type: 'comment' }); engine.confirmationFor({ type: 'comment' });
    const result = await engine.execute({ type: 'comment' }, { confirmed: true });
    assert.equal(calls.filter(call => call.method === 'POST').length, 1);
    assert.equal(result.records[0].state, status === 500 || status === 401 ? 'uncertain' : 'failed');
  }
});
test('missing verification content stays missing; live deletion remains unavailable', async () => {
  const { adapter } = setup({ missing: true });
  assert.equal(await adapter.get('t1_abc'), null);
  assert.throws(() => adapter.delete('t1_abc'), { code: 'DELETION_UNVERIFIED' });
});
test('account is rechecked before every throttled write retry', async () => {
  const { adapter, scheduler, identity, calls } = setup();
  const original = adapter.transport;
  let writes = 0;
  adapter.transport = async request => {
    if (request.method === 'POST' && ++writes === 1) {
      identity({ id: 'other', name: 'other' });
      return { status: 429, text: '{}', headers: { 'retry-after': '60' } };
    }
    return original(request);
  };
  await assert.rejects(adapter.edit('t1_abc', 'Private', { id: 't2_owner', name: 'owner' }), { code: 'ACCOUNT_CHANGED' });
  assert.equal(writes, 1);
  assert.equal(scheduler.stats.throttles, 1);
  assert.ok(calls.filter(call => call.path === '/api/v1/me').length >= 2);
});
