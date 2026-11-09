import './app.css';
import { el } from '../ui/dom.js';
import { DEFAULT_REPLACEMENT } from '../filters.js';

const $ = id => document.getElementById(id);
const bridge = window.wipeditt;
const PAGE_SIZE = 10;
const filterNames = ['type', 'include', 'exclude', 'contains', 'regex', 'after', 'before', 'minScore', 'maxScore', 'edited'];
const operationNames = ['mode', 'replacement', 'interval', 'deleteDelay'];
const presets = {
  default: DEFAULT_REPLACEMENT,
  short: '[Deleted for privacy]',
  removed: '[Content removed]'
};
let state, confirmation, initialized = false, operationTimer, page = 0, previewStamp = '';
let needsRefresh = false, lastSearchSource = 'live', lastPreviewCreated = null;

function command(name, data = {}) {
  return bridge.command(name, data).then(result => {
    if (result.error) throw Object.assign(new Error(result.error.message), { code: result.error.code });
    return result.data;
  });
}
function error(failure) {
  if (failure.code === 'STALE') needsRefresh = true;
  $('status').textContent = failure.message || 'Operation failed.';
  $('status').classList.add('error');
  $('status').dataset.tone = 'danger';
  updateRefreshControl();
}
function action(id, name, data = () => ({})) {
  $(id).addEventListener('click', async () => {
    try { await command(name, data()); } catch (failure) { error(failure); }
  });
}
function preference(key, fallback = '') {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function remember(key, value) {
  try { localStorage.setItem(key, value); } catch { /* Preferences remain local and optional. */ }
}
function applyTheme(dark) {
  document.body.classList.toggle('dark', dark);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  $('theme').textContent = dark ? 'Light appearance' : 'Dark appearance';
  $('theme').setAttribute('aria-pressed', String(dark));
}
function applyPrivacy(enabled) {
  document.body.classList.toggle('private', enabled);
  $('privacy').checked = enabled;
}
const storedTheme = preference('wipeditt.theme');
applyTheme(storedTheme !== 'light');
applyPrivacy(preference('wipeditt.privacy') === '1');

function rawOptions() {
  const options = { limit: 0 };
  for (const name of [...filterNames, ...operationNames]) options[name] = $(name).value;
  return options;
}
function typeLabel(type) {
  return { comment: 'Comments', post: 'Posts', all: 'Comments & posts' }[type] || 'Comments';
}
function communityLabel(value) {
  return value.startsWith('u_') ? `u/${value.slice(2)}` : `r/${value}`;
}
function modeLabel(mode) {
  return { anonymize: 'Anonymize', delete: 'Delete', combined: 'Anonymize & Delete' }[mode] || mode;
}
function outcomeTone(outcome) {
  if (['failed', 'error'].includes(outcome)) return 'danger';
  if (['uncertain', 'partial', 'skipped', 'waiting', 'stopped'].includes(outcome)) return 'warning';
  if (['anonymized', 'deleted', 'success', 'current', 'available'].includes(outcome)) return 'success';
  if (['editing', 'deleting', 'checking'].includes(outcome)) return 'info';
  return 'neutral';
}
function resultTone(counts = {}, stopped = false) {
  return counts.failed ? 'danger' : counts.uncertain || counts.partial || counts.skipped || stopped ? 'warning' : counts.anonymized || counts.deleted ? 'success' : 'neutral';
}
function filterCount(options) {
  if (!options) return 0;
  let count = 0;
  if (options.include?.length || options.exclude?.length) count++;
  if (options.contains || options.regex) count++;
  if (options.after !== null || options.before !== null) count++;
  if (options.minScore !== null || options.maxScore !== null) count++;
  if (options.edited !== 'all') count++;
  return count;
}
function select(ids, selected, replace = false) {
  return command('select', { ids, selected, replace }).catch(error);
}
function setStatus(message, failure = false) {
  $('status').textContent = message;
  $('status').classList.toggle('error', failure);
  $('status').dataset.tone = failure ? 'danger' : 'neutral';
}
function previewExpired() {
  return !!state?.preview && Date.now() > state.preview.expiresAt;
}
function updateRefreshControl() {
  const available = !!state?.account && !state.busy && !state.browserVisible && state.updates?.installer?.status !== 'installing';
  $('refresh-results').hidden = !available || !(state.preview || state.finished || needsRefresh);
  $('refresh-results').disabled = !available;
  $('refresh-results').textContent = lastSearchSource === 'import' ? 'Re-import export' : 'Refresh results';
}
function showPreviewExpiry() {
  if (state?.updates?.installer?.status === 'installing' || state?.busy || state?.finished || state?.statusError || !previewExpired()) return;
  needsRefresh = true;
  setStatus('Results expired. Refresh them before confirming changes.');
  $('status').dataset.tone = 'warning';
  updateRefreshControl();
  if (confirmation) {
    $('confirmation').close(); confirmation = null;
    command('cancel-confirmation').catch(() => {});
    $('refresh-results').focus();
  }
}

function syncPreset() {
  const value = $('replacement').value;
  const match = Object.entries(presets).find(([, text]) => text === value);
  $('replacement-preset').value = match ? match[0] : 'custom';
}
function scheduleOptionsUpdate() {
  clearTimeout(operationTimer);
  command('cancel-confirmation').catch(() => {});
  operationTimer = setTimeout(() => {
    if (state?.preview) command('options', { options: rawOptions() }).catch(error);
  }, 220);
}
function toggleDeleteDelay() {
  $('delete-delay-label').hidden = $('mode').value !== 'combined';
}

function renderItems(preview) {
  const pages = Math.max(1, Math.ceil(preview.items.length / PAGE_SIZE));
  if (page >= pages) page = pages - 1;
  if (page < 0) page = 0;
  const start = page * PAGE_SIZE;
  const visible = preview.items.slice(start, start + PAGE_SIZE);
  const nodes = visible.map(item => {
    const selected = el('input', {
      type: 'checkbox', checked: item.selected,
      disabled: !!state.busy || !!item.skip,
      'aria-label': `Select ${item.type} in ${communityLabel(item.subreddit)}`
    });
    selected.addEventListener('change', () => select([item.id], selected.checked));
    const open = el('button', {
      type: 'button', class: 'item-open', text: 'Open ↗',
      disabled: !!state.busy,
      onClick: event => { event.stopPropagation(); command('open-original', { id: item.id }).catch(error); }
    });
    const meta = `${item.type === 'post' ? 'post' : 'comment'} · ${new Date(item.created).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })} · ${item.score ?? '?'} points${item.edited ? ' · edited' : ''}`;
    const body = item.text || item.title || '[No body text]';
    const article = el('article', { class: `item${item.selected ? ' selected' : ''}${item.skip ? ' skipped' : ''}`, 'data-id': item.id },
      selected,
      el('div', { class: 'item-heading' }, el('strong', { class: 'community sensitive', text: communityLabel(item.subreddit) }), el('span', { class: 'item-meta', text: meta }), open),
      el('p', { class: 'sensitive', text: body }),
      item.skip ? el('small', { class: 'warning', text: item.skip }) : null
    );
    article.addEventListener('click', event => {
      if (event.target.closest('button,a,input,select,textarea,label')) return;
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) return;
      if (state.busy || item.skip) return;
      select([item.id], !item.selected);
    });
    return article;
  });
  if (!nodes.length) {
    nodes.push(el('div', { class: 'empty-state' },
      el('strong', { text: 'No matches in this view' }),
      el('span', { text: 'Try wider filters, another content type, or import a Reddit export for older comments.' })
    ));
  }
  $('items').replaceChildren(...nodes);
  $('page-label').textContent = preview.items.length ? `Page ${page + 1} of ${pages} · ${preview.items.length} items` : 'No matches';
  $('previous-page').disabled = !!state.busy || page <= 0;
  $('next-page').disabled = !!state.busy || page >= pages - 1;
}
function renderPreview(preview) {
  $('counts').textContent = `${preview.stats.matched} found · ${preview.selected} selected`;
  $('scan-details').textContent = `${preview.stats.inspected} inspected · ${preview.stats.unique} unique · ${preview.stats.matched} matching · ${preview.stats.eligible} eligible. ${preview.reason}.`;
  $('matched-count').textContent = preview.stats.matched;
  $('eligible-count').textContent = preview.stats.eligible;
  $('selected-count').textContent = preview.selected;
  const source = preview.source === 'import' ? 'Imported from Reddit export' : 'Reddit profile listing';
  const filters = filterCount(preview.options);
  $('search-summary').textContent = `${source} · ${typeLabel(preview.options?.type)}${filters ? ` · ${filters} filter${filters === 1 ? '' : 's'}` : ''}`;
  const detail = preview.source === 'import'
    ? `${preview.reason}. This export is a snapshot. Current ownership is checked before any change.`
    : preview.reason || 'Reddit listings may stop before your oldest history. Import your official export to include older comments.';
  $('coverage-note').textContent = detail;
  $('coverage-actions').hidden = preview.source === 'import';
  $('include-unavailable').hidden = preview.source !== 'import' || !preview.deferredUnavailable;
  $('include-unavailable').textContent = `Review ${preview.deferredUnavailable || 0} unavailable item${preview.deferredUnavailable === 1 ? '' : 's'}`;
  $('review').textContent = preview.selected ? `Review ${preview.selected} selected` : 'Review changes';
  $('review').disabled = !!state.busy || !preview.selected;
  $('select-all').disabled = !!state.busy || !preview.stats.eligible;
  $('select-none').disabled = !!state.busy || !preview.selected;
  $('subreddit-select').disabled = !!state.busy || !preview.stats.eligible;
  const chosen = $('subreddit-select').value;
  const communities = [...new Set(preview.items.map(item => item.subreddit))].sort((a, b) => a.localeCompare(b));
  $('subreddit-select').replaceChildren(
    el('option', { value: '', text: 'Select only a community…' }),
    ...communities.map(name => el('option', { value: name, text: communityLabel(name) }))
  );
  $('subreddit-select').value = communities.includes(chosen) ? chosen : '';
  renderItems(preview);
}

function render(next) {
  state = next;
  const update = state.updates;
  const installation = update?.installer;
  const updating = ['downloading', 'verifying', 'installing'].includes(installation?.status);
  const canUpdate = !!installation?.supported && !!update?.available?.install;
  $('update-notice').hidden = !update?.available || !!state.browserVisible;
  $('update-progress').hidden = !['downloading', 'verifying'].includes(installation?.status);
  $('update-progress').value = installation?.percent || 0;
  $('download-update').hidden = !canUpdate || ['downloading', 'verifying', 'ready', 'installing'].includes(installation?.status);
  $('install-update').hidden = installation?.status !== 'ready';
  $('update-description').textContent = ({ downloading: `Downloading from GitHub · ${installation?.percent || 0}%`, verifying: 'Verifying update integrity…', ready: `Version ${installation?.version || ''} is verified. Install when your Reddit work is finished.`, installing: 'Installing update. Wipeditt will restart…', error: 'Update could not be prepared. Retry or open the official release.' })[installation?.status] || (canUpdate ? 'Download here, then choose Install and restart. Your Reddit work will not be interrupted.' : 'Open the official release to update this package.');
  $('update-title').textContent = update?.available ? `Wipeditt ${update.available.version} is available${update.available.preview ? ' · Preview' : ''}` : 'New version available';
  $('automatic-updates').checked = update?.enabled ?? true;
  $('update-status').textContent = ({ checking: 'Checking releases…', current: 'You are up to date.', available: `Version ${update?.available?.version || ''} is available.`, error: 'Could not check. Try again later.' })[update?.status] || 'Checks public GitHub releases only.';
  $('check-updates').textContent = update?.status === 'checking' ? 'Checking…' : 'Check for updates';
  $('check-updates').dataset.state = update?.status || 'idle';
  $('check-updates').setAttribute('aria-busy', String(update?.status === 'checking'));
  $('update-status').dataset.tone = outcomeTone(update?.status);
  $('check-updates').classList.toggle('update-available', !!update?.available);
  const preview = state.preview;
  const busy = !!state.busy || !!state.verifyingLogin;
  document.body.dataset.working = String(busy && !state.paused);
  const connected = !!state.account;
  const finished = !!state.finished;
  if (!connected) { needsRefresh = false; lastSearchSource = 'live'; lastPreviewCreated = null; }
  if (preview && preview.created !== lastPreviewCreated) {
    needsRefresh = false; lastPreviewCreated = preview.created; lastSearchSource = preview.source;
    if (preview.source === 'import') $('type').value = 'comment';
  }
  if (preview) {
    const stamp = `${preview.created}:${preview.source}:${preview.items.length}`;
    if (stamp !== previewStamp) { previewStamp = stamp; page = 0; }
  } else {
    previewStamp = '';
    page = 0;
  }

  document.body.classList.toggle('connected', connected);
  document.body.classList.toggle('browser-visible', !!state.browserVisible);
  $('status').textContent = state.status || '';
  $('status').classList.toggle('error', !!state.statusError);
  $('status').dataset.tone = state.statusError ? 'danger' : busy ? 'info' : state.finished ? resultTone(state.finished.counts, state.finished.stopped) : 'neutral';
  $('account').textContent = state.account ? `u/${state.account.name}` : 'Not connected';
  $('version').textContent = `Version ${state.version}`;
  $('mode-badge').hidden = !state.deletionTesting;
  $('mode-badge').textContent = 'DELETION VALIDATION · Disposable content only';
  document.title = state.deletionTesting ? `Wipeditt — Deletion validation ${state.version}` : 'Wipeditt';
  $('browser-help').hidden = !state.browserVisible;
  $('workspace').hidden = !!state.browserVisible;

  $('welcome').hidden = connected || !!preview || finished || busy || !!state.browserVisible;
  $('operation-section').hidden = !connected || busy || !!state.browserVisible;
  $('scan-section').hidden = !connected || !!preview || busy || !!state.browserVisible;
  $('progress-section').hidden = !busy || !!state.browserVisible;
  $('finished').hidden = !finished || busy || !!state.browserVisible;
  $('review-section').hidden = !preview || busy || !!state.browserVisible;

  const heading = state.browserVisible ? 'Your Reddit browser'
    : preview ? 'Review before you replace.'
      : finished ? 'Operation results.'
        : busy ? (state.progress ? 'Working through your selection.' : 'Finding your history.')
          : connected ? 'Find the history you want to change.'
            : 'Your Reddit history.';
  const eyebrow = state.browserVisible ? 'SIGN IN ON REDDIT'
    : preview ? 'STEP 3 · REVIEW & CONFIRM'
      : finished ? 'COMPLETE'
        : busy ? 'WORKING'
          : connected ? 'STEP 2 · FIND YOUR HISTORY'
            : 'WIPEDITT / REDDIT';
  $('heading').textContent = heading;
  $('eyebrow').textContent = eyebrow;

  $('step-connect').classList.toggle('active', !connected && !state.browserVisible);
  $('step-scan').classList.toggle('active', connected && !preview && !finished);
  $('step-review').classList.toggle('active', !!preview);
  $('connect').hidden = connected || !!state.browserVisible;
  $('remember').parentElement.hidden = connected || !!state.browserVisible;
  $('verify').hidden = !state.browserVisible;
  $('show-browser').hidden = !connected || !!state.browserVisible;
  $('hide-browser').hidden = !state.browserVisible;
  $('disconnect').hidden = !connected && !state.browserVisible;

  for (const node of document.querySelectorAll('button,input,textarea,select')) node.disabled = busy;
  $('check-updates').disabled = busy || updating || update?.status === 'checking';
  $('download-update').disabled = busy || updating || !!state.browserVisible;
  $('install-update').disabled = busy || !!state.browserVisible;
  $('download-update').setAttribute('aria-busy', String(updating));
  $('stop').disabled = !state.busy;
  $('cancel-connect').hidden = !state.connecting;
  $('cancel-connect').disabled = !state.connecting;
  $('pause').disabled = !state.busy;
  $('pause').textContent = state.paused ? 'Resume' : 'Pause';
  $('privacy').disabled = false;
  $('theme').disabled = false;
  if (confirmation) $('accept').disabled = busy || !!confirmation.phrase && $('phrase').value !== confirmation.phrase;
  $('report').disabled = busy || !state.hasReport;
  $('finished-report').disabled = busy || !state.hasReport;
  $('cooldown').textContent = state.wait ? `${state.wait.reason} · ${Math.ceil(state.wait.remaining / 1000)}s` : '';

  if (busy) {
    const progress = state.progress;
    $('progress-title').textContent = !connected ? 'Verifying your Reddit account' : progress ? 'Applying your changes' : 'Finding your history';
    $('progress-help').textContent = progress
      ? 'Pause waits between actions. Stop prevents new actions; edits already sent may finish.'
      : 'Searching is read only. You will review the results next.';
    if (progress) {
      const counts = progress.counts || {};
      const completed = ['anonymized', 'deleted', 'skipped', 'failed', 'uncertain', 'partial'].reduce((sum, key) => sum + (counts[key] || 0), 0);
      const total = progress.total || 0;
      $('progress').max = Math.max(total, 1);
      $('progress').value = total ? completed : 0;
      const percent = total ? Math.round(completed / total * 100) : 0;
      $('progress-percent').textContent = `${percent}%`;
      $('progress-counts').replaceChildren(`${completed}/${total} complete`, ...Object.entries(counts).flatMap(([outcome, count]) => [' · ', el('span', { 'data-tone': outcomeTone(outcome), text: `${count} ${outcome}` })]), ` · ${Math.round(progress.elapsed / 1000)}s elapsed`);
    } else {
      $('progress').max = 1;
      $('progress').value = 0;
      $('progress-percent').textContent = '…';
      $('progress-counts').textContent = state.status || 'Working…';
    }
  }

  if (finished) {
    const counts = state.finished.counts || {};
    const tone = resultTone(counts, state.finished.stopped);
    $('finished').dataset.tone = tone;
    $('finished-mark').textContent = tone === 'success' ? '✓' : tone === 'neutral' ? '—' : '!';
    $('finished-label').textContent = tone === 'warning' || tone === 'danger' ? 'REVIEW NEEDED' : 'FINISHED';
    $('finished-help').hidden = !counts.uncertain;
    $('finished-title').textContent = counts.uncertain ? state.finished.stopped ? 'Verification incomplete. Operation stopped.' : 'Finished. Some items need review.' : state.finished.stopped ? 'Operation stopped.' : counts.failed ? 'Finished with errors.' : counts.partial ? 'Partially completed.' : 'Operation finished.';
    $('finished-summary').replaceChildren(Object.keys(counts).length ? '' : 'No changes', ...Object.entries(counts).flatMap(([outcome, count], index) => [index ? ' · ' : '', el('span', { 'data-tone': outcomeTone(outcome), text: `${count} ${outcome}` })]), ` · ${Math.max(1, Math.round((state.finished.elapsedMs || 0) / 1000))}s`);
    for (const [id, count, requested] of [['finished-anonymized', state.finished.anonymized, state.finished.mode !== 'delete'], ['finished-deleted', state.finished.deleted, state.finished.mode !== 'anonymize']]) {
      $(id).textContent = requested ? `${count || 0} verified` : 'Not requested';
      $(id).dataset.tone = requested && count ? 'success' : 'neutral';
    }
    $('inspect-original').hidden = !state.finished.uncertainId;
  }

  if (!initialized) {
    $('replacement').value = state.options?.replacement || DEFAULT_REPLACEMENT;
    initialized = true;
  }
  syncPreset();
  if (!state.deletionEnabled) $('mode').value = 'anonymize';
  for (const option of $('mode').options) option.disabled = !state.deletionEnabled && option.value !== 'anonymize';
  const mode = $('mode').value;
  $('mode-description').textContent = { anonymize: 'Replace your Reddit content with a custom message.', delete: 'Permanently delete your selected Reddit content.', combined: 'Replace your content with a custom message, then delete it.' }[mode];
  $('mode-availability').textContent = state.deletionEnabled ? state.deletionValidated ? 'Changes require review and confirmation.' : 'Deletion testing enabled. Use disposable content only.' : 'Deletion is awaiting independent live validation.';
  $('replacement-content').hidden = mode === 'delete';
  $('operation-heading').textContent = mode === 'delete' ? 'Permanently delete' : 'Choose the replacement';
  $('operation-copy').textContent = mode === 'delete' ? 'Selected items will be deleted through Reddit. This cannot be undone.' : mode === 'combined' ? 'Each replacement is verified before its item can be deleted.' : 'Selected items keep their place. Their body text becomes your message.';
  toggleDeleteDelay();

  if (preview) renderPreview(preview);
  else {
    $('items').replaceChildren();
    $('counts').textContent = '';
    $('scan-details').textContent = '';
    $('subreddit-select').replaceChildren(el('option', { value: '', text: 'Select only a community…' }));
  }
  $('activity').replaceChildren(...state.activity.map(item => el('li', { 'data-tone': outcomeTone(item.outcome), text: item.message })));
  updateRefreshControl();
  showPreviewExpiry();
  if (installation?.status === 'installing') for (const node of document.querySelectorAll('button,input,textarea,select')) node.disabled = true;
}

setInterval(() => {
  if (!needsRefresh) showPreviewExpiry();
}, 1000);

async function cancelConfirmation() {
  $('confirmation').close();
  confirmation = null;
  await command('cancel-confirmation');
}

$('review').addEventListener('click', async () => {
  try {
    clearTimeout(operationTimer);
    await command('options', { options: rawOptions() });
    confirmation = await command('confirm');
    $('confirmation-summary').textContent = `${confirmation.count} ${confirmation.count === 1 ? 'item' : 'items'} · ${modeLabel(confirmation.mode)} · u/${confirmation.account}`;
    $('confirmation-summary').textContent += ` · ${confirmation.eligible} eligible · ${confirmation.ineligible} ineligible`;
    $('confirmation-title').textContent = confirmation.mode === 'delete' ? 'Permanently delete these items?' : confirmation.mode === 'combined' ? 'Anonymize, then permanently delete?' : 'Replace this text?';
    $('confirmation-replacement').hidden = confirmation.mode === 'delete';
    $('confirmation-warning').textContent = confirmation.mode === 'anonymize' ? 'Your selected body text will be replaced. External copies may remain.' : 'Deletion is irreversible. Only independently verified replacements proceed to deletion in combined mode. Stop prevents new actions; submitted actions may finish. External copies may remain.';
    $('confirmation-text').textContent = confirmation.replacement;
    $('phrase-label').hidden = !confirmation.phrase;
    $('phrase-prompt').textContent = `Type ${confirmation.phrase}`;
    $('phrase').value = '';
    $('accept').disabled = !!confirmation.phrase;
    $('accept').textContent = confirmation.mode === 'anonymize' ? 'Confirm & anonymize' : confirmation.mode === 'delete' ? 'Confirm & delete' : 'Confirm both steps';
    $('confirmation').showModal();
    $('cancel-confirmation').focus();
  } catch (failure) { error(failure); }
});
$('phrase').addEventListener('input', () => { $('accept').disabled = $('phrase').value !== confirmation?.phrase; });
$('cancel-confirmation').addEventListener('click', () => cancelConfirmation().catch(error));
$('confirmation').addEventListener('cancel', event => { event.preventDefault(); cancelConfirmation().catch(error); });
$('accept').addEventListener('click', async () => {
  const token = confirmation?.token;
  const phrase = $('phrase').value;
  $('confirmation').close();
  confirmation = null;
  try { await command('run', { token, phrase }); } catch (failure) { error(failure); }
});

for (const name of filterNames) $(name).addEventListener('input', () => {
  clearTimeout(operationTimer);
  if (state?.preview) {
    command('invalidate').catch(error);
    $('review-section').hidden = true;
  }
  setStatus('Filters changed. Scan again to update your selection.');
});
for (const name of operationNames) $(name).addEventListener('input', () => {
  if (name === 'replacement') {
    $('replacement-preset').value = 'custom';
  }
  scheduleOptionsUpdate();
});
$('replacement-preset').addEventListener('change', () => {
  const preset = $('replacement-preset').value;
  if (preset === 'custom') { $('replacement').focus(); return; }
  $('replacement').value = presets[preset];
  scheduleOptionsUpdate();
});
$('mode').addEventListener('change', () => { toggleDeleteDelay(); if (state) render(state); });
$('subreddit-select').addEventListener('change', () => {
  const name = $('subreddit-select').value;
  if (!name || !state?.preview || state.busy) return;
  const items = state.preview.items.filter(item => item.subreddit === name && !item.skip);
  select(items.map(item => item.id), true, true);
  $('subreddit-select').value = '';
});
$('previous-page').addEventListener('click', () => { if (page > 0) { page--; render(state); } });
$('next-page').addEventListener('click', () => { page++; render(state); });
$('change-search').addEventListener('click', () => command('invalidate').catch(error));
$('select-all').addEventListener('click', () => {
  if (!state?.preview) return;
  select(state.preview.items.filter(item => !item.skip).map(item => item.id), true);
});
$('select-none').addEventListener('click', () => {
  if (!state?.preview) return;
  select(state.preview.items.map(item => item.id), false);
});
$('privacy').addEventListener('change', () => {
  applyPrivacy($('privacy').checked);
  remember('wipeditt.privacy', $('privacy').checked ? '1' : '0');
});
$('theme').addEventListener('click', () => {
  const dark = !document.body.classList.contains('dark');
  applyTheme(dark);
  remember('wipeditt.theme', dark ? 'dark' : 'light');
});
for (const id of ['request-export', 'request-older']) $(id).addEventListener('click', () => { $('export-help').showModal(); $('close-export-help').focus(); });
$('close-export-help').addEventListener('click', () => $('export-help').close());
$('open-data-request').addEventListener('click', async () => {
  try { await command('open-data-request'); $('export-help').close(); } catch (failure) { error(failure); }
});
$('export-help').addEventListener('cancel', event => { event.preventDefault(); $('export-help').close(); });

action('connect', 'connect', () => ({ remember: $('remember').checked }));
action('welcome-connect', 'connect', () => ({ remember: $('remember').checked }));
action('verify', 'verify-account');
action('show-browser', 'show-browser');
action('hide-browser', 'hide-browser');
action('disconnect', 'disconnect');
action('scan', 'scan', () => ({ options: rawOptions() }));
for (const id of ['import-export', 'import-older']) action(id, 'import-export', () => ({ options: rawOptions() }));
action('report', 'export-report');
action('finished-report', 'export-report');
action('inspect-original', 'open-original', () => ({ id: state.finished.uncertainId }));
$('refresh-results').addEventListener('click', async () => {
  clearTimeout(operationTimer);
  const source = state.preview?.source || lastSearchSource;
  $('confirmation').close(); confirmation = null;
  try {
    await command('cancel-confirmation');
    await command(source === 'import' ? 'import-export' : 'scan', { options: rawOptions() });
  } catch (failure) { error(failure); }
});
action('clear-checkpoint', 'clear-checkpoint');
action('include-unavailable', 'include-unavailable');
action('stop', 'stop');
action('cancel-connect', 'stop');
action('check-updates', 'check-updates');
action('open-update', 'open-update');
action('download-update', 'download-update');
action('install-update', 'install-update');
$('automatic-updates').addEventListener('change', () => command('update-settings', { enabled: $('automatic-updates').checked }).catch(error));
$('pause').addEventListener('click', () => command(state?.paused ? 'resume' : 'pause').catch(error));

$('show-license').addEventListener('click', async () => {
  try { const legal = await command('read-license'); $('legal-text').textContent = `${legal.notice}\n${legal.license}`; $('legal-dialog').showModal(); $('close-legal').focus(); } catch (failure) { error(failure); }
});
$('close-legal').addEventListener('click', () => $('legal-dialog').close());
action('open-source', 'open-source');
action('author-link', 'open-source');
bridge.onState(render);
command('state').then(render).catch(error);
