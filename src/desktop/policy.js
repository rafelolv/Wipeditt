import { fail } from '../errors.js';
export const REDDIT_HOME = 'https://www.reddit.com/';
export const REDDIT_CLASSIC = 'https://old.reddit.com';
export function redditURL(value) {
  let url;
  try { url = new URL(value); } catch { fail('URL', 'Invalid Reddit URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password || !['www.reddit.com', 'old.reddit.com', 'reddit.com', 'accounts.reddit.com'].includes(url.hostname)) fail('URL', 'Only Reddit website navigation is allowed.');
  return url;
}
export function contentURL(value, id) {
  const url = redditURL(value);
  if (!/^t[13]_[a-z0-9]+$/.test(id) || !/^\/r\/[^/]+\/comments\/[a-z0-9]+(?:\/|$)/.test(url.pathname)) fail('URL', 'Original content link could not be verified.');
  url.hostname = 'old.reddit.com';
  url.search = '';
  url.hash = '';
  return url.href;
}
export function historyURL(value, account) {
  const url = redditURL(value);
  const match = /^\/user\/([A-Za-z0-9_-]+)\/(comments|submitted|overview)\/?$/.exec(url.pathname);
  if (url.hostname !== 'old.reddit.com' || !match || match[1].toLowerCase() !== account.name.toLowerCase()) fail('URL', 'History navigation must remain on the verified account.');
  return url.href;
}
export const REMOTE_PREFERENCES = Object.freeze({ nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, navigateOnDragDrop: false, safeDialogs: true });
export function trustedSender(event, shell, appURL) {
  return event.sender === shell.webContents && event.senderFrame === shell.webContents.mainFrame && event.senderFrame.url === appURL;
}

export function loginNavigation(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && ['www.reddit.com', 'old.reddit.com', 'reddit.com', 'accounts.reddit.com', 'accounts.google.com', 'appleid.apple.com', 'idmsa.apple.com'].includes(url.hostname);
  } catch { return false; }
}
