import { browserRequest } from '../network.js';
const runtime = globalThis.browser?.runtime || globalThis.chrome?.runtime;
const pending = new Map();
runtime.onMessage.addListener((message, sender, respond) => {
  let origin;
  try { origin = new URL(sender.url || sender.tab?.url).origin; } catch { return false; }
  if (sender.id !== runtime.id || !['https://www.reddit.com', 'https://old.reddit.com'].includes(origin) || typeof message?.id !== 'string') return false;
  const key = `${sender.tab?.id}:${message.id}`;
  if (message.type === 'wipeditt.abort') { pending.get(key)?.abort(); return false; }
  if (message.type !== 'wipeditt.request' || pending.has(key)) return false;
  const controller = new AbortController();
  pending.set(key, controller);
  browserRequest(message.request, { signal: controller.signal }).then(respond, error => respond({ error: { code: error.code || 'NETWORK', message: error.message || 'Reddit request failed.' } })).finally(() => pending.delete(key));
  return true;
});
