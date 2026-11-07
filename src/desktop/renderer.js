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

function command(name, data = {}) {
  return bridge.command(name, data).then(result => {
    if (result.error) throw Object.assign(new Error(result.error.message), { code: result.error.code });
    return result.data;
  });
}
function error(failure) {
  $('status').textContent = failure.message || 'Operation failed.';
  $('status').classList.add('error');
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
  return { comment: 'Comments', post: 'Text posts', all: 'Comments & text posts' }[type] || 'Comments';
}
function communityLabel(value) {
  return value.startsWith('u_') ? `u/${value.slice(2)}` : `r/${value}`;
}
function modeLabel(mode) {
  return { anonymize: 'replace text', delete: 'delete · sample only', combined: 'replace & delete · sample only' }[mode] || mode;
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
function select(ids, selected) {
  return command('select', { ids, selected }).catch(error);
}
function setStatus(message, failure = false) {
  $('status').textContent = message;
  $('status').classList.toggle('error', failure);
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
  $('delete-delay-label').hidden = !state?.simulation || $('mode').value === 'anonymize';
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
    const meta = `${item.type === 'post' ? 'text post' : 'comment'} · ${new Date(item.created).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })} · ${item.score ?? '?'} points${item.edited ? ' · edited' : ''}`;
    const body = item.text || '[No body text]';
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
  const source = preview.source === 'import' ? 'Imported from Reddit export' : 'All available history';
  const filters = filterCount(preview.options);
  $('search-summary').textContent = `${source} · ${typeLabel(preview.options?.type)}${filters ? ` · ${filters} filter${filters === 1 ? '' : 's'}` : ''}`;
  const detail = preview.source === 'import'
    ? 'This export is a snapshot. Comments edited or deleted since then are skipped before any change, and ownership is checked again.'
    : preview.reason || 'Reddit listings may stop before your oldest history. Import your official export to include older comments.';
  $('coverage-note').textContent = detail;
  $('review').textContent = preview.selected ? `Review ${preview.selected} selected` : 'Review changes';
  $('review').disabled = !!state.busy || !preview.selected;
  $('select-all').disabled = !!state.busy || !preview.stats.eligible;
  $('select-none').disabled = !!state.busy || !preview.selected;
  $('subreddit-select').disabled = !!state.busy || !preview.stats.eligible;
  const chosen = $('subreddit-select').value;
  const communities = [...new Set(preview.items.map(item => item.subreddit))].sort((a, b) => a.localeCompare(b));
  $('subreddit-select').replaceChildren(
    el('option', { value: '', text: 'Select a community…' }),
    ...communities.map(name => el('option', { value: name, text: communityLabel(name) }))
  );
  $('subreddit-select').value = communities.includes(chosen) ? chosen : '';
  renderItems(preview);
}

function render(next) {
  state = next;
  const update = state.updates;
  $('update-notice').hidden = !update?.available || !!state.browserVisible;
  $('update-title').textContent = update?.available ? `Wipeditt ${update.available.version} is available${update.available.preview ? ' · Preview' : ''}` : 'New version available';
  $('automatic-updates').checked = update?.enabled ?? true;
  $('update-status').textContent = ({ checking: 'Checking releases…', current: 'You are up to date.', available: `Version ${update?.available?.version || ''} is available.`, error: 'Could not check. Try again later.' })[update?.status] || 'Checks public GitHub releases only.';
  $('check-updates').textContent = update?.status === 'checking' ? 'Checking…' : 'Check for updates';
  const preview = state.preview;
  const busy = !!state.busy;
  const connected = !!state.account;
  const finished = !!state.finished;
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
  $('account').textContent = state.account ? (state.simulation ? 'Sample data · synthetic' : `u/${state.account.name}`) : 'Not connected';
  $('version').textContent = `Version ${state.version}`;
  $('mode-badge').hidden = !state.simulation;
  $('browser-help').hidden = !state.browserVisible;
  $('workspace').hidden = !!state.browserVisible;

  $('welcome').hidden = connected || !!preview || finished || busy || !!state.browserVisible;
  $('scan-section').hidden = !connected || !!preview || busy || !!state.browserVisible;
  $('progress-section').hidden = !busy || !!state.browserVisible;
  $('finished').hidden = !finished || busy || !!state.browserVisible;
  $('review-section').hidden = !preview || busy || !!state.browserVisible;
  $('import-card').hidden = !!state.simulation;

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
  $('check-updates').disabled = busy || update?.status === 'checking';
  $('stop').disabled = !busy;
  $('pause').disabled = !busy;
  $('pause').textContent = state.paused ? 'Resume' : 'Pause';
  $('privacy').disabled = false;
  $('theme').disabled = false;
  if (confirmation) $('accept').disabled = busy || !!confirmation.phrase && $('phrase').value !== confirmation.phrase;
  $('report').disabled = busy || !state.hasReport;
  $('finished-report').disabled = busy || !state.hasReport;
  $('cooldown').textContent = state.wait ? `${state.wait.reason} · ${Math.ceil(state.wait.remaining / 1000)}s` : '';

  if (busy) {
    const progress = state.progress;
    $('progress-title').textContent = progress ? (state.simulation ? 'Running your sample' : 'Applying your changes') : 'Finding your history';
    $('progress-help').textContent = progress
      ? 'Pause waits between actions. Stop prevents new actions; edits already sent may finish.'
      : 'Searching is read only. You will review the results next.';
    if (progress) {
      const counts = progress.counts || {};
      const completed = ['anonymized', 'deleted', 'skipped', 'failed', 'uncertain'].reduce((sum, key) => sum + (counts[key] || 0), 0);
      const total = progress.total || 0;
      $('progress').max = Math.max(total, 1);
      $('progress').value = total ? completed : 0;
      const percent = total ? Math.round(completed / total * 100) : 0;
      $('progress-percent').textContent = `${percent}%`;
      $('progress-counts').textContent = `${completed}/${total} complete · ${Object.entries(counts).map(([key, count]) => `${count} ${key}`).join(' · ')} · ${Math.round(progress.elapsed / 1000)}s elapsed`;
    } else {
      $('progress').max = 1;
      $('progress').value = 0;
      $('progress-percent').textContent = '…';
      $('progress-counts').textContent = state.status || 'Working…';
    }
  }

  if (finished) {
    const counts = state.finished.counts || {};
    const countText = Object.entries(counts).map(([key, count]) => `${count} ${key}`).join(' · ') || 'No changes';
    const prefix = state.finished.simulation ? 'Sample only — no Reddit content changed. ' : '';
    $('finished-title').textContent = state.finished.stopped ? 'Operation stopped.' : state.finished.simulation ? 'Sample finished.' : 'Operation finished.';
    $('finished-summary').textContent = `${prefix}${countText} · ${Math.max(1, Math.round((state.finished.elapsedMs || 0) / 1000))}s`;
  }

  if (!initialized) {
    $('replacement').value = state.options?.replacement || DEFAULT_REPLACEMENT;
    initialized = true;
  }
  syncPreset();
  if (!state.simulation) $('mode').value = 'anonymize';
  for (const option of $('mode').options) option.disabled = !state.simulation && option.value !== 'anonymize';
  toggleDeleteDelay();

  if (preview) renderPreview(preview);
  else {
    $('items').replaceChildren();
    $('counts').textContent = '';
    $('scan-details').textContent = '';
    $('subreddit-select').replaceChildren(el('option', { value: '', text: 'Select a community…' }));
  }
  $('activity').replaceChildren(...state.activity.map(item => el('li', { text: item.message })));
}

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
    $('confirmation-summary').textContent = `${confirmation.count} ${confirmation.count === 1 ? 'item' : 'items'} · ${modeLabel(confirmation.mode)} · ${confirmation.simulation ? 'sample data' : `u/${confirmation.account}`}`;
    $('confirmation-text').textContent = confirmation.replacement;
    $('phrase-label').hidden = !confirmation.phrase;
    $('phrase-prompt').textContent = `Type ${confirmation.phrase}`;
    $('phrase').value = '';
    $('accept').disabled = !!confirmation.phrase;
    $('accept').textContent = confirmation.simulation
      ? (confirmation.mode === 'anonymize' ? 'Run sample replacement' : 'Run sample operation')
      : 'Confirm & replace text';
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
$('mode').addEventListener('change', toggleDeleteDelay);
$('subreddit-select').addEventListener('change', () => {
  const name = $('subreddit-select').value;
  if (!name || !state?.preview || state.busy) return;
  const items = state.preview.items.filter(item => item.subreddit === name && !item.skip);
  select(items.map(item => item.id), !items.every(item => item.selected));
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
$('request-export').addEventListener('click', () => { $('export-help').showModal(); $('close-export-help').focus(); });
$('close-export-help').addEventListener('click', () => $('export-help').close());
$('open-data-request').addEventListener('click', async () => {
  try { await command('open-data-request'); $('export-help').close(); } catch (failure) { error(failure); }
});
$('export-help').addEventListener('cancel', event => { event.preventDefault(); $('export-help').close(); });

action('connect', 'connect', () => ({ remember: $('remember').checked }));
action('welcome-connect', 'connect', () => ({ remember: $('remember').checked }));
action('welcome-demo', 'demo');
action('verify', 'verify-account');
action('show-browser', 'show-browser');
action('hide-browser', 'hide-browser');
action('disconnect', 'disconnect');
action('scan', 'scan', () => ({ options: rawOptions() }));
action('import-export', 'import-export', () => ({ options: rawOptions() }));
action('demo', 'demo');
action('report', 'export-report');
action('finished-report', 'export-report');
action('clear-checkpoint', 'clear-checkpoint');
action('stop', 'stop');
action('check-updates', 'check-updates');
action('open-update', 'open-update');
$('automatic-updates').addEventListener('change', () => command('update-settings', { enabled: $('automatic-updates').checked }).catch(error));
$('pause').addEventListener('click', () => command(state?.paused ? 'resume' : 'pause').catch(error));

bridge.onState(render);
command('state').then(render).catch(error);
