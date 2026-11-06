import { AppError, checkAbort, fail } from './errors.js';

const RESPONSE_HEADERS = ['retry-after', 'x-ratelimit-remaining', 'x-ratelimit-reset', 'x-ratelimit-used'];
export function validateRequest(request) {
  const url = new URL(request.url);
  const method = request.method || 'GET';
  const apiRead = /^\/(api\/v1\/me|api\/info|user\/[A-Za-z0-9_-]+\/(comments|submitted|overview))$/.test(url.pathname);
  const apiWrite = ['/api/editusertext', '/api/del'].includes(url.pathname);
  const token = url.origin === 'https://www.reddit.com' && url.pathname === '/api/v1/access_token' && method === 'POST';
  if (url.username || url.password || url.hash || !(token || (url.origin === 'https://oauth.reddit.com' && ((apiRead && method === 'GET') || (apiWrite && method === 'POST'))))) fail('NETWORK_SCOPE', 'Request is outside the Reddit integration.');
  if (url.searchParams.has('access_token') || url.searchParams.has('code')) fail('NETWORK_SCOPE', 'Credentials must not appear in request URLs.');
  if (typeof request.body !== 'undefined' && (typeof request.body !== 'string' || request.body.length > 100000)) fail('NETWORK_SCOPE', 'Invalid request body.');
  const headers = request.headers || {};
  for (const name of Object.keys(headers)) if (!['authorization', 'content-type', 'user-agent'].includes(name.toLowerCase())) fail('NETWORK_SCOPE', 'Unexpected request header.');
  const authorization = Object.entries(headers).find(([key]) => key.toLowerCase() === 'authorization')?.[1];
  if (typeof authorization !== 'string' || !(token ? /^Basic [A-Za-z0-9+/=]+$/ : /^Bearer [^\s]+$/).test(authorization)) fail('AUTH', 'Reddit authorization is missing.');
  return { url: url.href, method, body: request.body, headers };
}
export async function browserRequest(input, { signal, fetcher = globalThis.fetch } = {}) {
  const request = validateRequest(input);
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), 30000);
  const combined = signal ? AbortSignal.any([signal, timeout.signal]) : timeout.signal;
  try {
    checkAbort(signal);
    const response = await fetcher(request.url, { method: request.method, headers: request.headers, body: request.body, credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer', cache: 'no-store', signal: combined });
    const text = await response.text();
    if (text.length > 20000000) fail('RESPONSE', 'Reddit response is too large.');
    return { status: response.status, text, headers: Object.fromEntries(RESPONSE_HEADERS.map(key => [key, response.headers.get(key)]).filter(([, value]) => value !== null)) };
  } catch (error) {
    if (error instanceof AppError) throw error;
    checkAbort(signal);
    throw new AppError(timeout.signal.aborted ? 'TIMEOUT' : 'NETWORK', 'Reddit request failed. Check your connection and try again.');
  } finally { clearTimeout(timer); }
}
export function send(input, { signal } = {}) {
  const request = validateRequest(input);
  checkAbort(signal);
  if (typeof GM_xmlhttpRequest === 'function') {
    return new Promise((resolve, reject) => {
      let handle;
      const finish = (error, data) => { signal?.removeEventListener('abort', abort); error ? reject(error) : resolve(data); };
      const abort = () => { handle?.abort(); finish(new AppError('STOPPED', 'Stopped.')); };
      handle = GM_xmlhttpRequest({ ...request, data: request.body, anonymous: true, redirect: 'error', timeout: 30000,
        onload: response => {
          const headers = {};
          for (const line of (response.responseHeaders || '').split(/\r?\n/)) {
            const split = line.indexOf(':');
            const key = line.slice(0, split).trim().toLowerCase();
            if (RESPONSE_HEADERS.includes(key)) headers[key] = line.slice(split + 1).trim();
          }
          finish(null, { status: response.status, text: response.responseText, headers });
        },
        onerror: () => finish(new AppError('NETWORK', 'Reddit request failed. Check your connection.')),
        ontimeout: () => finish(new AppError('TIMEOUT', 'Reddit did not respond in time.')),
        onabort: () => finish(new AppError('STOPPED', 'Stopped.'))
      });
      signal?.addEventListener('abort', abort, { once: true });
    });
  }
  const runtime = globalThis.browser?.runtime || globalThis.chrome?.runtime;
  if (runtime?.id) {
    const id = crypto.randomUUID();
    const abort = () => { runtime.sendMessage({ type: 'wipeditt.abort', id }).catch(() => {}); };
    signal?.addEventListener('abort', abort, { once: true });
    return runtime.sendMessage({ type: 'wipeditt.request', id, request }).then(result => {
      checkAbort(signal);
      if (result?.error) throw new AppError(result.error.code, result.error.message);
      if (!result || !Number.isInteger(result.status)) fail('NETWORK', 'Extension could not contact Reddit.');
      return result;
    }).finally(() => signal?.removeEventListener('abort', abort));
  }
  return browserRequest(request, { signal });
}
