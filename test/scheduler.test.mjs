import test from 'node:test';
import assert from 'node:assert/strict';
import { Scheduler } from '../src/scheduler.js';
import { AppError } from '../src/errors.js';
function setup() {
  let time = 0;
  const waits = [];
  const scheduler = new Scheduler({ now: () => time, sleeper: async ms => { waits.push(ms); time += ms; } });
  return { scheduler, waits, now: () => time };
}
test('central scheduler serializes callers and respects minimum interval', async () => {
  const { scheduler, now } = setup();
  const times = [];
  await Promise.all(Array.from({ length: 3 }, () => scheduler.request(async () => { times.push(now()); return true; })));
  assert.deepEqual(times, [0, 1500, 3000]);
});
test('rate-limit headers and Retry-After dates impose stricter waits', async () => {
  const { scheduler, now } = setup();
  scheduler.observe(new Headers({ 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '20' }));
  await scheduler.request(async () => true);
  assert.equal(now(), 20000);
  scheduler.observe(new Headers({ 'retry-after': new Date(40000).toUTCString() }));
  await scheduler.request(async () => true);
  assert.equal(now(), 40000);
});
test('429 uses bounded retries and Retry-After, including explicit body cooldown', async () => {
  const { scheduler, now } = setup();
  let attempts = 0;
  await scheduler.request(async () => { if (attempts++ < 1) throw new AppError('HTTP', 'Throttled', { status: 429, headers: new Headers({ 'retry-after': '120' }) }); return true; });
  assert.equal(now(), 120000);
  assert.equal(scheduler.stats.throttles, 1);
  assert.equal(attempts, 2);
  await assert.rejects(scheduler.request(async () => { throw new AppError('RATELIMIT', 'Slow down'); }));
  assert.equal(scheduler.stats.retries, 4);
});
test('401 and 403 are fatal without retry', async () => {
  for (const status of [401, 403]) {
    const { scheduler } = setup();
    await assert.rejects(scheduler.request(async () => { throw new AppError('HTTP', 'Denied', { status }); }), { code: status === 401 ? 'AUTH' : 'PERMISSION', fatal: true });
    assert.equal(scheduler.stats.requests, 1);
  }
});
test('read server errors and network timeouts back off then stop', async () => {
  for (const error of [new AppError('HTTP', 'Server', { status: 503 }), new AppError('TIMEOUT', 'Timed out')]) {
    const { scheduler } = setup();
    await assert.rejects(scheduler.request(async () => { throw error; }));
    assert.equal(scheduler.stats.requests, 4);
  }
});
test('write errors never replay uncertain requests; semantic guards remain intact', async () => {
  for (const error of [new AppError('NETWORK', 'Offline'), new AppError('HTTP', 'Server', { status: 500 }), new AppError('OWNERSHIP', 'Wrong owner')]) {
    const { scheduler } = setup();
    await assert.rejects(scheduler.request(async () => { throw error; }, { write: true }), { code: error.code === 'OWNERSHIP' ? 'OWNERSHIP' : 'UNCERTAIN' });
    assert.equal(scheduler.stats.requests, 1);
  }
});
test('pause prevents scheduling until resume; stop aborts queued request', async () => {
  let calls = 0;
  const scheduler = new Scheduler({ interval: 0 });
  scheduler.pause();
  const result = scheduler.request(async () => { calls++; });
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(calls, 0);
  scheduler.resume(); await result;
  assert.equal(calls, 1);
  scheduler.pause();
  const controller = new AbortController();
  const stopped = scheduler.request(async () => { calls++; }, { signal: controller.signal });
  controller.abort();
  await assert.rejects(stopped, { code: 'STOPPED' });
  assert.equal(calls, 1);
});
test('API body cooldown can exceed generic throttling wait', async () => {
  const { scheduler, now } = setup();
  let calls = 0;
  await scheduler.request(async () => { if (!calls++) throw new AppError('RATELIMIT', 'Cooldown', { retryAfterMs: 180000 }); return true; });
  assert.equal(now(), 180000);
});


test('local checks stay serial without spending or extending network cooldown', async () => {
  const { scheduler, now } = setup();
  const order = [];
  scheduler.observe(new Headers({ 'retry-after': '20' }));
  await Promise.all([
    scheduler.request(async () => { order.push('local'); assert.equal(now(), 0); }, { local: true }),
    scheduler.request(async () => { order.push('network'); assert.equal(now(), 20000); })
  ]);
  assert.deepEqual(order, ['local', 'network']);
  assert.equal(scheduler.stats.requests, 1);
});

test('temporary offline reads recover with bounded backoff; prolonged outage is fatal', async () => {
  const { scheduler, now } = setup();
  let attempts = 0;
  await scheduler.request(async () => { if (++attempts < 4) throw new AppError('NETWORK', 'Offline'); return true; });
  assert.equal(attempts, 4); assert.ok(now() >= 35000);
  attempts = 0;
  await assert.rejects(scheduler.request(async () => { attempts++; throw new AppError('NETWORK', 'Offline'); }), { code: 'NETWORK', fatal: true });
  assert.equal(attempts, 7);
});
