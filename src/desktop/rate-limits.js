// Only scheduling metadata from this app's navigation/native writes reaches
// the scheduler. Cached pages and background resources are not fresh limits.
export function observeRedditResponse(details, { contentsId, writeTracker, scheduler }) {
  if ((details.webContentsId ?? details.webContents?.id) !== contentsId || details.fromCache) return false;
  const navigation = details.resourceType === 'mainFrame';
  const submitted = writeTracker?.active?.pending.has(details.id);
  if (!navigation && !submitted) return false;
  const headers = new Headers();
  for (const [key, values] of Object.entries(details.responseHeaders || {})) {
    if (['retry-after', 'x-ratelimit-remaining', 'x-ratelimit-reset', 'date', 'age'].includes(key.toLowerCase())) headers.set(key, values.join(','));
  }
  scheduler.observe(headers);
  if (details.statusCode === 429) {
    scheduler.stats.throttles++;
    scheduler.cooldown(scheduler.now() + 60000);
  }
  return true;
}
