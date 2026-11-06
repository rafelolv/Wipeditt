import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRequest, browserRequest, send } from '../src/network.js';
const request = { url: 'https://oauth.reddit.com/api/v1/me', headers: { Authorization: 'Bearer fixture-token' } };

test('transport restricts origin, paths, methods, credentials and headers', () => {
  assert.equal(validateRequest(request).method, 'GET');
  for (const changes of [{ url: 'https://evil.test/api/v1/me' }, { url: 'http://oauth.reddit.com/api/v1/me' }, { url: 'https://oauth.reddit.com/api/unknown' }, { method: 'DELETE' }, { headers: { Cookie: 'private' } }, { url: request.url + '?access_token=private' }, { url: 'https://user@oauth.reddit.com/api/v1/me' }]) assert.throws(() => validateRequest({ ...request, ...changes }));
});
test('fetch transport omits cookies, refuses redirects and only returns quota headers', async () => {
  const result = await browserRequest(request, { fetcher: async (url, options) => {
    assert.equal(options.credentials, 'omit');
    assert.equal(options.redirect, 'error');
    assert.equal(options.referrerPolicy, 'no-referrer');
    return new Response('{}', { headers: { 'retry-after': '30', 'set-cookie': 'private' } });
  } });
  assert.deepEqual(result.headers, { 'retry-after': '30' });
});
test('privileged userscript transport preserves body, quota headers and anonymous mode', async () => {
  globalThis.GM_xmlhttpRequest = options => {
    assert.equal(options.anonymous, true);
    assert.equal(options.redirect, 'error');
    assert.equal(options.data, 'thing_id=t1_abc&text=Private');
    queueMicrotask(() => options.onload({ status: 200, responseText: '{}', responseHeaders: 'X-Ratelimit-Remaining: 1\r\nRetry-After: 60\r\nSet-Cookie: private' }));
    return { abort() {} };
  };
  try {
    const result = await send({ url: 'https://oauth.reddit.com/api/editusertext', method: 'POST', headers: request.headers, body: 'thing_id=t1_abc&text=Private' });
    assert.deepEqual(result.headers, { 'x-ratelimit-remaining': '1', 'retry-after': '60' });
  } finally { delete globalThis.GM_xmlhttpRequest; }
});
