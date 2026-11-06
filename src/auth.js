import { AppError, checkAbort, fail } from './errors.js';
import { send } from './network.js';
import { Scheduler } from './scheduler.js';
export const REDIRECT_URI = 'https://www.reddit.com/';
export const REQUIRED_SCOPES = ['identity', 'history', 'read', 'edit'];
export function clientId(value) {
  const id = String(value || '').trim();
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(id)) fail('CLIENT_ID', 'Enter the public Client ID of a Reddit installed app.');
  return id;
}
export function authorizationUrl(id, state) {
  const url = new URL('https://www.reddit.com/api/v1/authorize');
  url.search = new URLSearchParams({ client_id: clientId(id), response_type: 'code', state, redirect_uri: REDIRECT_URI, duration: 'temporary', scope: REQUIRED_SCOPES.join(' ') });
  return url.href;
}
export function handleOAuthCallback(win = window) {
  const url = new URL(win.location.href);
  const state = url.searchParams.get('state') || '';
  const match = /^wipeditt\.(www|old)\.[a-f0-9]{64}$/.exec(state);
  if (!match || url.origin !== 'https://www.reddit.com' || url.pathname !== '/') return false;
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  if (!code && !error) return false;
  for (const key of ['code', 'state', 'error', 'error_description']) url.searchParams.delete(key);
  win.history.replaceState(null, '', url.href);
  const message = { type: 'wipeditt.oauth', state, code, error };
  win.opener?.postMessage(message, `https://${match[1]}.reddit.com`);
  if (match[1] === 'www' && typeof win.BroadcastChannel === 'function') {
    const channel = new win.BroadcastChannel('wipeditt.oauth.v1');
    channel.postMessage(message);
    channel.close();
  }
  win.close();
  return true;
}
export class RedditAuth {
  #token = null;
  #expires = 0;
  #pending = null;
  constructor({ transport = send, now = Date.now, win = globalThis.window, scheduler = new Scheduler() } = {}) { Object.assign(this, { transport, now, win, scheduler }); }
  token() {
    if (!this.#token || this.now() >= this.#expires) { this.#token = null; this.#expires = 0; fail('AUTH', 'Your Reddit connection expired. Connect again to continue.'); }
    return this.#token;
  }
  disconnect() { this.#token = null; this.#expires = 0; this.#pending?.(); }
  async exchange(id, code, signal) {
    const response = await this.scheduler.request(async () => {
      const result = await this.transport({ url: 'https://www.reddit.com/api/v1/access_token', method: 'POST', headers: { Authorization: `Basic ${btoa(`${clientId(id)}:`)}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI }).toString() }, { signal });
      return { data: result, headers: new Headers(result.headers || {}) };
    }, { signal, write: true });
    checkAbort(signal);
    let data;
    try { data = JSON.parse(response.text); } catch { fail('AUTH', 'Reddit did not return a valid authorization response.'); }
    if (response.status !== 200 || data.error || typeof data.access_token !== 'string' || data.token_type?.toLowerCase() !== 'bearer') fail('AUTH', 'Reddit refused this app or authorization code. Check the installed-app Client ID, redirect URI and Reddit API access.');
    const scopes = String(data.scope || '').split(/[\s,]+/);
    if (!REQUIRED_SCOPES.every(scope => scopes.includes(scope))) fail('AUTH', 'Reddit did not grant all required permissions. Connect again and approve identity, history, read and edit.');
    const seconds = Number(data.expires_in);
    if (!Number.isFinite(seconds) || seconds <= 0) fail('AUTH', 'Reddit returned an expired authorization.');
    this.#token = data.access_token;
    this.#expires = this.now() + Math.min(seconds, 3600) * 1000;
  }
  connect(id) {
    this.disconnect();
    const origin = new URL(this.win.location.href);
    const host = origin.hostname.split('.')[0];
    if (!['https://www.reddit.com', 'https://old.reddit.com'].includes(origin.origin)) fail('AUTH', 'Open Wipeditt on Reddit to connect your account.');
    const random = [...crypto.getRandomValues(new Uint8Array(32))].map(n => n.toString(16).padStart(2, '0')).join('');
    const state = `wipeditt.${host}.${random}`;
    // Open synchronously in the click handler so browser popup controls allow the consent page.
    const popup = this.win.open(authorizationUrl(id, state), '_blank', 'popup,width=620,height=760');
    if (!popup) fail('POPUP', 'Allow the Reddit sign-in popup, then try again.');
    return new Promise((resolve, reject) => {
      const controller = new AbortController();
      let settled = false, exchanging = false;
      const channel = host === 'www' && typeof this.win.BroadcastChannel === 'function' ? new this.win.BroadcastChannel('wipeditt.oauth.v1') : null;
      const cleanup = () => { this.win.removeEventListener('message', receive); channel?.close(); clearTimeout(timer); this.#pending = null; };
      const finish = error => { if (settled) return; settled = true; cleanup(); popup.close(); error ? reject(error) : resolve(); };
      const accept = async data => {
        if (settled || exchanging) return;
        if (data.state !== state) return finish(new AppError('AUTH_STATE', 'Reddit authorization could not be verified. Connect again.'));
        if (data.error || typeof data.code !== 'string' || !data.code) return finish(new AppError('AUTH_DENIED', 'Reddit sign-in was canceled or refused.'));
        exchanging = true;
        this.win.removeEventListener('message', receive);
        try { await this.exchange(id, data.code, controller.signal); finish(); }
        catch (error) { finish(error); }
      };
      const receive = event => {
        if (event.origin !== 'https://www.reddit.com' || event.source !== popup || event.data?.type !== 'wipeditt.oauth') return;
        return accept(event.data);
      };
      if (channel) channel.onmessage = event => {
        if (event.data?.type === 'wipeditt.oauth' && event.data.state === state) accept(event.data);
      };
      const timer = setTimeout(() => { controller.abort(); finish(new AppError('AUTH_TIMEOUT', 'Reddit sign-in timed out. Try again.')); }, 10 * 60 * 1000);
      this.#pending = () => { controller.abort(); finish(new AppError('AUTH_CANCELED', 'Reddit sign-in canceled.')); };
      this.win.addEventListener('message', receive);
    });
  }
}
