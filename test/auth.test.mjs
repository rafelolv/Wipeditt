import test from 'node:test';
import assert from 'node:assert/strict';
import { RedditAuth, authorizationUrl, handleOAuthCallback, REDIRECT_URI, REQUIRED_SCOPES } from '../src/auth.js';
const tokenResponse = (changes = {}) => ({ status: 200, text: JSON.stringify({ access_token: 'fixture-token', token_type: 'bearer', expires_in: 3600, scope: REQUIRED_SCOPES.join(' '), ...changes }) });

test('public installed-app flow requests documented scopes and no secret or password', () => {
  const url = new URL(authorizationUrl('fixture-client-id', 'state'));
  assert.equal(url.origin, 'https://www.reddit.com');
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('redirect_uri'), REDIRECT_URI);
  assert.equal(url.searchParams.get('duration'), 'temporary');
  assert.equal(url.searchParams.has('client_secret'), false);
  assert.throws(() => new RedditAuth({ win: { location: { href: 'https://www.evil.test/' } } }).connect('fixture-client-id'), { code: 'AUTH' });
});
test('token exchange uses a blank installed-app secret and memory-only expiry', async () => {
  let now = 0;
  const auth = new RedditAuth({ now: () => now, transport: async request => {
    assert.equal(atob(request.headers.Authorization.slice(6)), 'fixture-client-id:');
    assert.equal(new URLSearchParams(request.body).get('code'), 'fixture-code');
    assert.equal(new URL(request.url).search, '');
    return tokenResponse();
  } });
  await auth.exchange('fixture-client-id', 'fixture-code');
  assert.equal(auth.token(), 'fixture-token');
  assert.ok(!JSON.stringify(auth).includes('fixture-token'));
  now = 3600000;
  assert.throws(() => auth.token(), { code: 'AUTH' });
});
test('rejected grants, missing scopes and malformed token responses fail closed', async () => {
  for (const response of [{ status: 401, text: '{}' }, tokenResponse({ scope: 'identity' }), tokenResponse({ expires_in: 0 }), tokenResponse({ token_type: 'other' }), { status: 200, text: '<html>' }]) {
    const auth = new RedditAuth({ transport: async () => response });
    await assert.rejects(auth.exchange('fixture-client-id', 'fixture-code'), { code: 'AUTH' });
    assert.throws(() => auth.token(), { code: 'AUTH' });
  }
});
test('disconnect/abort cannot restore a token from a late exchange result', async () => {
  const controller = new AbortController();
  const auth = new RedditAuth({ transport: async () => { controller.abort(); return tokenResponse(); } });
  await assert.rejects(auth.exchange('fixture-client-id', 'fixture-code', controller.signal), { code: 'STOPPED' });
  assert.throws(() => auth.token(), { code: 'AUTH' });
});
test('callback removes authorization code from URL and uses an exact opener origin', () => {
  let message, target, cleaned, closed = false;
  const state = 'wipeditt.old.' + 'a'.repeat(64);
  const win = { location: { href: `${REDIRECT_URI}?code=fixture-code&state=${state}&keep=value` }, opener: { postMessage: (data, origin) => { message = data; target = origin; } }, history: { replaceState: (_, __, url) => { cleaned = url; } }, close: () => { closed = true; } };
  assert.equal(handleOAuthCallback(win), true);
  assert.equal(message.code, 'fixture-code');
  assert.equal(target, 'https://old.reddit.com');
  assert.equal(new URL(cleaned).search, '?keep=value');
  assert.equal(closed, true);
  assert.equal(handleOAuthCallback({ ...win, location: { href: `https://evil.test/?code=x&state=${state}` } }), false);
});
test('popup responses require matching source, origin and random state', async () => {
  const listeners = new Map();
  const popup = { closed: false, close() { this.closed = true; } };
  let url;
  const win = { location: { href: 'https://www.reddit.com/' }, open: value => { url = value; return popup; }, addEventListener: (name, handler) => listeners.set(name, handler), removeEventListener: name => listeners.delete(name) };
  const auth = new RedditAuth({ win, transport: async () => tokenResponse() });
  const connected = auth.connect('fixture-client-id');
  const state = new URL(url).searchParams.get('state');
  const receive = listeners.get('message');
  await receive({ origin: 'https://evil.test', source: popup, data: { type: 'wipeditt.oauth', state, code: 'x' } });
  assert.throws(() => auth.token(), { code: 'AUTH' });
  await receive({ origin: 'https://www.reddit.com', source: {}, data: { type: 'wipeditt.oauth', state, code: 'x' } });
  await receive({ origin: 'https://www.reddit.com', source: popup, data: { type: 'wipeditt.oauth', state: 'wrong', code: 'x' } });
  await assert.rejects(connected, { code: 'AUTH_STATE' });
});
test('same-origin callback channel survives a missing window.opener and cannot exchange twice', async () => {
  class Channel {
    static channels = [];
    constructor() { Channel.channels.push(this); }
    close() {}
    postMessage(data) { for (const other of Channel.channels) if (other !== this) other.onmessage?.({ data }); }
  }
  const listeners = new Map();
  let url, exchanges = 0;
  const popup = { closed: false, close() {} };
  const win = { BroadcastChannel: Channel, location: { href: 'https://www.reddit.com/' }, open: value => { url = value; return popup; }, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) };
  const auth = new RedditAuth({ win, transport: async () => { exchanges++; return tokenResponse(); } });
  const connected = auth.connect('fixture-client-id');
  const state = new URL(url).searchParams.get('state');
  const callback = { BroadcastChannel: Channel, opener: null, location: { href: `${REDIRECT_URI}?state=${state}&code=fixture-code` }, history: { replaceState() {} }, close() {} };
  assert.equal(handleOAuthCallback(callback), true);
  await connected;
  assert.equal(auth.token(), 'fixture-token');
  assert.equal(exchanges, 1);
});
test('canceling a pending sign-in closes its popup and clears the receiver', async () => {
  const listeners = new Map();
  const popup = { closed: false, close() { this.closed = true; } };
  const win = { location: { href: 'https://www.reddit.com/' }, open: () => popup, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) };
  const auth = new RedditAuth({ win });
  const pending = auth.connect('fixture-client-id');
  auth.disconnect();
  await assert.rejects(pending, { code: 'AUTH_CANCELED' });
  assert.equal(popup.closed, true);
  assert.equal(listeners.size, 0);
});
