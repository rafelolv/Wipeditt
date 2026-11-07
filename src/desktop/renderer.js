import './app.css';
import { el } from '../ui/dom.js';
import { DEFAULT_REPLACEMENT } from '../filters.js';
const $ = id => document.getElementById(id);
const bridge = window.wipeditt;
let state, confirmation, initialized = false, operationTimer;
const filterNames = ['type', 'limit', 'include', 'exclude', 'contains', 'regex', 'after', 'before', 'minScore', 'maxScore', 'edited'];
const operationNames = ['mode', 'replacement', 'interval', 'deleteDelay'];
const rawOptions = () => Object.fromEntries([...filterNames, ...operationNames].map(name => [name, $(name).value]));
async function command(name, data = {}) {
  const result = await bridge.command(name, data);
  if (result.error) throw Object.assign(new Error(result.error.message), { code: result.error.code });
  return result.data;
}
function error(error) { $('status').textContent = error.message || 'Operation failed.'; $('status').classList.add('error'); }
function action(id, name, data = () => ({})) {
  $(id).addEventListener('click', async () => { try { await command(name, data()); } catch (failure) { error(failure); } });
}
function render(next) {
  state = next;
  $('status').classList.remove('error');
  $('status').textContent = state.status;
  $('account').textContent = state.account ? (state.simulation ? 'Demo account · synthetic data' : `u/${state.account.name}`) : 'Not connected';
  $('version').textContent = `Version ${state.version}`;
  $('mode-badge').hidden = !state.simulation;
  document.body.classList.toggle('browser-visible', state.browserVisible);
  $('browser-help').hidden = !state.browserVisible;
  $('workspace').hidden = state.browserVisible;
  $('welcome').hidden = !!state.account;
  $('scan-section').hidden = !state.account;
  $('review-section').hidden = !state.preview;
  $('connect').hidden = !!state.account || state.browserVisible;
  $('remember').parentElement.hidden = !!state.account || state.browserVisible;
  $('verify').hidden = !state.browserVisible;
  $('show-browser').hidden = !state.account || state.browserVisible;
  $('hide-browser').hidden = !state.browserVisible;
  $('disconnect').hidden = !state.account && !state.browserVisible;
  $('heading').textContent = state.browserVisible ? 'Your Reddit browser' : state.preview ? 'Review before you replace.' : state.account ? 'Find the history you want to change.' : 'A fresh start, on your terms.';
  $('step-connect').classList.toggle('active', !state.account);
  $('step-scan').classList.toggle('active', !!state.account && !state.preview);
  $('step-review').classList.toggle('active', !!state.preview);
  for (const node of document.querySelectorAll('button,input,textarea,select')) node.disabled = state.busy;
  $('stop').disabled = false; $('pause').disabled = false; $('privacy').disabled = false; $('theme').disabled = false;
  $('report').disabled = state.busy || !state.hasReport;
  $('progress-section').hidden = !state.busy;
  $('pause').textContent = state.paused ? 'Resume' : 'Pause';
  $('cooldown').textContent = state.wait ? `${state.wait.reason} · ${Math.ceil(state.wait.remaining / 1000)}s` : '';
  if (state.progress) {
    const counts = state.progress.counts;
    const completed = ['anonymized', 'deleted', 'skipped', 'failed', 'uncertain'].reduce((sum, key) => sum + (counts[key] || 0), 0);
    $('progress').max = state.progress.total; $('progress').value = completed;
    $('progress-counts').textContent = `${completed}/${state.progress.total} complete · ${Object.entries(counts).map(([key, count]) => `${count} ${key}`).join(' · ')} · ${Math.round(state.progress.elapsed / 1000)}s elapsed`;
  }
  $('activity').replaceChildren(...state.activity.map(item => el('li', { text: item.message })));
  if (!initialized) {
    $('replacement').value = DEFAULT_REPLACEMENT;
    initialized = true;
  }
  if (!state.simulation) $('mode').value = 'anonymize';
  for (const option of $('mode').options) option.disabled = !state.simulation && option.value !== 'anonymize';
  if (state.preview) {
    const preview = state.preview;
    $('counts').textContent = `${preview.stats.matched} found · ${preview.selected} selected`;
    $('scan-details').textContent = `${preview.stats.inspected} inspected · ${preview.stats.unique} unique · ${preview.stats.matched} matching · ${preview.stats.eligible} eligible. ${preview.reason}.`;
    $('review').textContent = `Review ${preview.selected} selected`;
    $('review').disabled = state.busy || !preview.selected;
    $('scan').classList.remove('primary');
    $('scope').open = false;
    const items = preview.items.map(item => {
      const selected = el('input', { type: 'checkbox', checked: item.selected, disabled: state.busy || !!item.skip, 'aria-label': `Select ${item.id}` });
      selected.addEventListener('change', () => command('select', { ids: [item.id], selected: selected.checked }).catch(error));
      const open = el('button', { type: 'button', text: 'Open', disabled: state.busy, onClick: () => command('open-original', { id: item.id }).catch(error) });
      return el('article', { class: 'item' }, el('div', { class: 'item-heading' }, selected, el('strong', { class: 'sensitive', text: `r/${item.subreddit}` }), el('span', { text: `${item.type} · ${new Date(item.created).toLocaleDateString('en-US')} · ${item.score ?? '?'} points` }), open), el('p', { class: 'sensitive original', text: item.text.slice(0, 800) + (item.text.length > 800 ? '…' : '') }), item.skip ? el('small', { class: 'warning', text: item.skip }) : null);
    });
    $('items').replaceChildren(...items);
    const chosen = $('subreddit-select').value;
    $('subreddit-select').replaceChildren(el('option', { value: '', text: 'Select by subreddit…' }), ...[...new Set(preview.items.map(item => item.subreddit))].map(name => el('option', { value: name, text: `r/${name}` })));
    $('subreddit-select').value = chosen;
  } else {
    $('items').replaceChildren(); $('scan').classList.add('primary');
  }
}
async function cancelConfirmation() {
  $('confirmation').close(); confirmation = null;
  await command('cancel-confirmation');
}
$('review').addEventListener('click', async () => {
  try {
    clearTimeout(operationTimer);
    await command('options', { options: rawOptions() });
    confirmation = await command('confirm');
    $('confirmation-summary').textContent = `${confirmation.simulation ? 'Demo only' : `Account: u/${confirmation.account}`} · ${confirmation.count} selected · ${confirmation.mode}`;
    $('confirmation-text').textContent = confirmation.replacement;
    $('phrase-label').hidden = !confirmation.phrase;
    $('phrase-prompt').textContent = `Type ${confirmation.phrase}`;
    $('phrase').value = ''; $('accept').disabled = !!confirmation.phrase;
    $('accept').textContent = confirmation.simulation ? 'Run demo' : 'Anonymize selected';
    $('confirmation').showModal(); $('cancel-confirmation').focus();
  } catch (failure) { error(failure); }
});
$('phrase').addEventListener('input', () => { $('accept').disabled = $('phrase').value !== confirmation?.phrase; });
$('cancel-confirmation').addEventListener('click', () => cancelConfirmation().catch(error));
$('confirmation').addEventListener('cancel', event => { event.preventDefault(); cancelConfirmation().catch(error); });
$('accept').addEventListener('click', async () => {
  const token = confirmation?.token; const phrase = $('phrase').value;
  $('confirmation').close(); confirmation = null;
  try { await command('run', { token, phrase }); } catch (failure) { error(failure); }
});
for (const name of filterNames) $(name).addEventListener('input', () => {
  clearTimeout(operationTimer);
  if (state?.preview) { command('invalidate').catch(error); $('review-section').hidden = true; }
  $('status').textContent = 'Filters changed. Scan again to update your selection.';
});
for (const name of operationNames) $(name).addEventListener('input', () => {
  clearTimeout(operationTimer);
  command('cancel-confirmation').catch(error);
  operationTimer = setTimeout(() => { if (state?.preview) command('options', { options: rawOptions() }).catch(error); }, 250);
});
$('subreddit-select').addEventListener('change', () => {
  const items = state.preview.items.filter(item => item.subreddit === $('subreddit-select').value && !item.skip);
  command('select', { ids: items.map(item => item.id), selected: !items.every(item => item.selected) }).catch(error);
});
action('connect', 'connect', () => ({ remember: $('remember').checked }));
action('welcome-connect', 'connect', () => ({ remember: $('remember').checked }));
action('verify', 'verify-account'); action('show-browser', 'show-browser'); action('hide-browser', 'hide-browser');
action('disconnect', 'disconnect'); action('scan', 'scan', () => ({ options: rawOptions() }));
action('demo', 'demo'); action('report', 'export-report'); action('clear-checkpoint', 'clear-checkpoint');
action('stop', 'stop');
$('pause').addEventListener('click', () => command(state.paused ? 'resume' : 'pause').catch(error));
action('select-all', 'select', () => ({ ids: state.preview.items.map(item => item.id), selected: true }));
action('select-none', 'select', () => ({ ids: state.preview.items.map(item => item.id), selected: false }));
$('privacy').addEventListener('change', () => document.body.classList.toggle('private', $('privacy').checked));
$('theme').addEventListener('click', () => { document.body.classList.toggle('light'); $('theme').textContent = document.body.classList.contains('light') ? 'Dark mode' : 'Light mode'; });
bridge.onState(render);
command('state').then(render).catch(error);
