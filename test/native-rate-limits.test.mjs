import test from 'node:test';
import assert from 'node:assert/strict';
import { Scheduler } from '../src/scheduler.js';
import { NativeWriteTracker } from '../src/desktop/write-tracker.js';
import { observeRedditResponse } from '../src/desktop/rate-limits.js';

const response = (changes = {}) => ({ id: 1, webContentsId: 42, resourceType: 'mainFrame', method: 'GET', fromCache: false, statusCode: 200, responseHeaders: { Date: [new Date(0).toUTCString()], 'X-Ratelimit-Remaining': ['0'], 'X-Ratelimit-Reset': ['600'] }, ...changes });

test('only own uncached navigations and active native write responses impose cooldowns', () => {
  let time = 0;
  const scheduler = new Scheduler({ now: () => time });
  const writeTracker = new NativeWriteTracker({ contentsId: 42 });
  const context = { contentsId: 42, scheduler, writeTracker };
  for (const changes of [{ webContentsId: 99 }, { fromCache: true }, ...['image','script','stylesheet','xhr','ping','subFrame'].map(resourceType => ({ resourceType, statusCode: 429 }))]) {
    assert.equal(observeRedditResponse(response(changes), context), false);
    assert.equal(scheduler.next, 0);
  }
  observeRedditResponse(response(), context);
  assert.equal(scheduler.next, 600000);
  for (time = 1000; time <= 600000; time += 1000) {
    observeRedditResponse(response({ resourceType: 'xhr', statusCode: 429 }), context);
    observeRedditResponse(response({ fromCache: true }), context);
  }
  assert.equal(scheduler.next, 600000, 'background traffic cannot restart the window');
  const ticket = writeTracker.begin();
  writeTracker.before({ id: 7, webContentsId: 42, resourceType: 'xhr', method: 'POST' });
  observeRedditResponse(response({ id: 7, method: 'POST', resourceType: 'xhr', statusCode: 429, responseHeaders: { 'Retry-After': ['900'] } }), context);
  assert.equal(scheduler.next, time + 900000);
  writeTracker.end(ticket);
});

test('an actual headerless 429 keeps a minimum cooldown while background 429 cannot extend it', () => {
  const scheduler = new Scheduler({ now: () => 1000 });
  const context = { contentsId: 42, scheduler };
  observeRedditResponse(response({ statusCode: 429, responseHeaders: {} }), context);
  assert.equal(scheduler.next, 61000);
  assert.equal(scheduler.stats.throttles, 1);
  observeRedditResponse(response({ resourceType: 'image', statusCode: 429, responseHeaders: {} }), context);
  assert.equal(scheduler.stats.throttles, 1);
});
