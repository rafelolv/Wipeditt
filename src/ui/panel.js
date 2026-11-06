import styles from './styles.css';
import icon from '../../images/icon.svg';
import { el, safeLink } from './dom.js';
import { DEFAULT_REPLACEMENT } from '../filters.js';
import { Engine } from '../engine.js';
import { Scheduler } from '../scheduler.js';
import { RedditAuth, REDIRECT_URI, clientId } from '../auth.js';
import { RedditAdapter } from '../adapters/reddit.js';
import { SimulationAdapter } from '../adapters/simulation.js';
import { Checkpoints } from '../checkpoint.js';
import { makeReport } from '../report.js';

export function mount(root, version) {
  const fields = {};
  let engine, scheduler, controller, dialog, lastReport, account = null, simulation = false, busy = false, connecting = false, connectionRevision = 0;
  let storage;
  try { storage = sessionStorage; } catch { /* Recovery remains optional. */ }
  const checkpoints = new Checkpoints(storage);
  const auth = new RedditAuth();
  const panel = el('section', { class: 'panel', 'aria-label': 'Wipeditt privacy utility' });
  const status = el('p', { class: 'status', role: 'status', 'aria-live': 'polite', text: 'Connect your Reddit account to get started.' });
  const connection = el('span', { class: 'connection-name', text: 'Not connected' });
  const modeNotice = el('p', { class: 'mode-notice', hidden: true });
  const results = el('div', { class: 'results', 'aria-label': 'Content preview' });
  const counters = el('p', { class: 'counts', hidden: true });
  const progress = el('progress', { max: 1, value: 0, hidden: true, 'aria-label': 'Operation progress' });
  const activity = el('ol', { class: 'activity' });
  const button = (text, onClick, className = '') => el('button', { type: 'button', text, onClick, class: className });
  const log = text => { activity.prepend(el('li', { text })); while (activity.children.length > 30) activity.lastChild.remove(); };
  const options = () => Object.fromEntries(Object.entries(fields).map(([name, input]) => [name, input.value]));
  function cancelDialog() { engine?.cancelConfirmation(); dialog?.close(); dialog?.remove(); dialog = null; }
  function selectedCount() { return engine?.preview?.items.filter(item => item.selected && !item.skip).length || 0; }
  function refresh() {
    const connected = !!account;
    connectButton.hidden = connected;
    disconnect.hidden = !connected;
    scope.hidden = !connected;
    operation.hidden = !engine?.preview;
    scan.hidden = !connected;
    review.hidden = !engine?.preview;
    review.disabled = busy || !selectedCount();
    review.textContent = `Review ${selectedCount()} selected`;
    scan.disabled = busy;
    scan.classList.toggle('primary', !engine?.preview);
    connectButton.disabled = busy;
    disconnect.disabled = busy;
    demo.disabled = busy;
    pause.hidden = !busy || connecting;
    stop.hidden = !busy;
    stop.textContent = connecting ? 'Cancel sign-in' : 'Stop';
    for (const control of panel.querySelectorAll('input,select,textarea,.scope button,.selection-tools button')) control.disabled = busy || control.dataset.ineligible === 'true';
    if (!simulation) for (const option of fields.mode.options) option.disabled = option.value !== 'anonymize';
    connection.textContent = connected ? (simulation ? 'Demo account · synthetic content' : `u/${account.name}`) : 'Not connected';
    connection.classList.toggle('sensitive', connected);
    connection.classList.toggle('connected', connected);
    modeNotice.hidden = !simulation;
    modeNotice.textContent = 'DEMO · Synthetic data. Your Reddit account is not affected.';
    if (engine?.preview) {
      const { stats } = engine.preview;
      counters.hidden = false;
      counters.textContent = `${stats.matched} found · ${selectedCount()} selected · ${stats.eligible} eligible`;
      detailsCounts.textContent = `${stats.inspected} inspected · ${stats.unique} unique · ${stats.matched} matching · ${stats.eligible} eligible · ${selectedCount()} selected`;
    }
  }
  function invalidate() {
    cancelDialog(); engine.invalidate(); results.replaceChildren(); counters.hidden = true;
    status.textContent = 'Filters changed. Scan again to update your selection.';
    refresh();
  }
  function operationChanged() {
    cancelDialog();
    try { if (engine.updateOperation(options())) { renderPreview(); status.textContent = 'Replacement updated. Review your selection before continuing.'; } }
    catch (error) { status.textContent = error.message; review.disabled = true; }
  }
  function field(name, title, { type = 'text', value = '', choices, hint, advanced = false, ...attrs } = {}) {
    const input = choices ? el('select', { id: name, ...attrs }, choices.map(([value, text]) => el('option', { value, text })))
      : type === 'textarea' ? el('textarea', { id: name, rows: 2, value, ...attrs }) : el('input', { id: name, type, value, ...attrs });
    if (choices && value) input.value = value;
    fields[name] = input;
    if (['include', 'exclude', 'contains', 'regex', 'replacement'].includes(name)) input.classList.add('sensitive');
    input.addEventListener('input', advanced ? operationChanged : invalidate);
    return el('label', { class: 'field', htmlFor: name }, el('span', { text: title }), input, hint ? el('small', { text: hint }) : null);
  }
  function useAdapter(adapter, sharedScheduler) {
    scheduler = sharedScheduler || new Scheduler({ onWait: wait => { status.textContent = `${wait.reason}${wait.remaining ? ` · ${(wait.remaining / 1000).toFixed(1)}s` : ''}`; } });
    engine = new Engine({ adapter, scheduler, checkpoints, onEvent: event => {
      if (event.type === 'scan') status.textContent = `Scanning · ${event.inspected} checked · ${event.matched} found`;
      if (event.type === 'progress') {
        progress.hidden = false; progress.max = event.total;
        progress.value = event.records.filter(record => ['anonymized', 'deleted', 'skipped', 'failed', 'uncertain'].includes(record.state)).length;
        const counts = {};
        for (const record of event.records) counts[record.state] = (counts[record.state] || 0) + 1;
        status.textContent = `${simulation ? 'DEMO · ' : ''}${progress.value}/${event.total} complete · ${Object.entries(counts).map(([state, n]) => `${n} ${state}`).join(' · ')} · ${Math.round(event.elapsed / 1000)}s elapsed`;
        log(`${event.records.at(-1)?.id}: ${event.records.at(-1)?.state}`);
      }
    } });
  }
  function setBusy(value) { busy = value; refresh(); }
  function reset() {
    connectionRevision++;
    controller?.abort(); scheduler?.resume(); auth.disconnect(); cancelDialog(); engine?.invalidate();
    account = null; simulation = false; results.replaceChildren(); counters.hidden = progress.hidden = true;
    lastReport = null; report.disabled = true; fields.mode.value = 'anonymize'; refresh();
  }
  async function connectWith(id) {
    const revision = ++connectionRevision;
    cancelDialog();
    let authorization;
    const previousCooldown = scheduler?.next || 0;
    scheduler = new Scheduler({ onWait: wait => { status.textContent = `${wait.reason} · ${Math.ceil(wait.remaining / 1000)}s`; } });
    scheduler.next = previousCooldown;
    auth.scheduler = scheduler;
    try { authorization = auth.connect(id); } catch (error) { status.textContent = error.message; return; }
    connecting = true; setBusy(true);
    status.textContent = 'Complete sign-in and consent in the Reddit window.';
    try {
      await authorization;
      if (revision !== connectionRevision) return;
      useAdapter(new RedditAdapter({ auth, scheduler, version }), scheduler);
      const verified = await engine.account();
      if (revision !== connectionRevision) return;
      account = verified;
      simulation = false;
      try { localStorage.setItem('wipeditt.clientId', id); } catch { /* Public setup can be entered again. */ }
      status.textContent = 'Connected. Choose what to scan.';
      log('Reddit account verified with OAuth.');
    } catch (error) { if (revision === connectionRevision) { auth.disconnect(); account = null; status.textContent = error.message; } }
    finally { if (revision === connectionRevision) { connecting = false; setBusy(false); } }
  }
  function showSetup() {
    if (location.hostname !== 'www.reddit.com') {
      status.textContent = 'Open www.reddit.com to connect. Wipeditt uses one origin to prevent simultaneous runs.';
      openReddit.hidden = false;
      return;
    }
    cancelDialog();
    let saved = '';
    try { saved = localStorage.getItem('wipeditt.clientId') || ''; } catch { /* Storage is optional. */ }
    const input = el('input', { type: 'text', value: saved, autocomplete: 'off', spellcheck: false, 'aria-label': 'Reddit Client ID', placeholder: 'Public Client ID' });
    const continueButton = button('Sign in with Reddit', () => {
      try { const id = clientId(input.value); connectWith(id); } catch (error) { setupError.textContent = error.message; }
    }, 'primary');
    const setupError = el('p', { class: 'error', role: 'alert' });
    const instructions = el('details', { open: !saved }, el('summary', { text: 'First time? Set up your Reddit app' }),
      el('ol', { class: 'setup-steps' },
        el('li', {}, el('a', { href: 'https://www.reddit.com/prefs/apps', target: '_blank', rel: 'noopener noreferrer', text: 'Open Reddit app settings' }), ' and create an ', el('strong', { text: 'installed app' }), ' named Wipeditt.'),
        el('li', {}, 'Set the redirect URI to ', el('code', { text: REDIRECT_URI }), '.'),
        el('li', { text: 'Copy the public Client ID shown below the app name. Paste it here. No password or client secret is needed.' })),
      el('p', { class: 'muted', text: 'Reddit controls registration and API approval. If creation is refused or redirects to policy, request API access from Reddit; signing in alone cannot grant it.' }),
      el('a', { href: 'https://support.reddithelp.com/hc/en-us/articles/42728983564564-Responsible-Builder-Policy', target: '_blank', rel: 'noopener noreferrer', text: 'Reddit access requirements' }));
    dialog = el('dialog', { 'aria-labelledby': 'setup-title' },
      el('h2', { id: 'setup-title', text: 'Connect your Reddit account' }),
      el('p', { text: 'Sign in on Reddit and approve access to your own history. Your password stays on Reddit; Wipeditt keeps the access token in memory only.' }),
      instructions, el('label', { class: 'field' }, el('span', { text: 'Reddit Client ID' }), input), setupError,
      el('div', { class: 'actions end' }, button('Cancel', cancelDialog), continueButton));
    dialog.addEventListener('cancel', event => { event.preventDefault(); event.stopPropagation(); cancelDialog(); });
    root.append(dialog); dialog.showModal(); input.focus();
  }
  function renderPreview() {
    const preview = engine.preview;
    if (!preview) return;
    results.replaceChildren();
    const select = (items, selected) => { cancelDialog(); for (const item of items) engine.select(item.id, selected); renderPreview(); };
    const groups = el('details', {}, el('summary', { text: 'Select by subreddit' }), el('div', { class: 'groups' }, [...new Set(preview.items.map(item => item.subreddit))].map(name => button(`r/${name}`, () => {
      const items = preview.items.filter(item => item.subreddit === name && !item.skip);
      select(items, !items.every(item => item.selected));
    }, 'sensitive'))));
    results.append(el('div', { class: 'selection-tools' }, counters, el('div', { class: 'actions' }, button('Select all', () => select(preview.items, true)), button('Select none', () => select(preview.items, false)))), groups);
    const list = el('div', { class: 'item-list' });
    for (const item of preview.items) {
      const check = el('input', { type: 'checkbox', checked: item.selected, disabled: !!item.skip, 'aria-label': `Select ${item.id}` });
      check.dataset.ineligible = String(!!item.skip);
      check.addEventListener('change', () => { cancelDialog(); engine.select(item.id, check.checked); refresh(); });
      const link = safeLink(item.permalink);
      list.append(el('article', { class: 'item' },
        el('div', { class: 'item-head' }, check, el('strong', { class: 'sensitive', text: `r/${item.subreddit}` }), el('span', { text: `${item.type} · ${new Date(item.created).toLocaleDateString('en-US')} · ${item.score ?? '?'} points` }), link && item.permalink ? el('a', { href: link, target: '_blank', rel: 'noopener noreferrer', text: 'Open' }) : null),
        el('p', { class: 'original sensitive', text: item.text.slice(0, 600) + (item.text.length > 600 ? '…' : '') }),
        item.skip ? el('small', { class: 'warning', text: item.skip }) : null));
    }
    results.append(list);
    if (!preview.items.length) results.append(el('p', { text: 'No matching content. Try a wider date range or fewer filters.' }));
    refresh();
  }
  async function performScan() {
    cancelDialog(); controller = new AbortController(); scheduler.resume(); pause.textContent = 'Pause';
    setBusy(true); lastReport = null; report.disabled = true; progress.hidden = true;
    try {
      const preview = await engine.scan(options(), controller.signal);
      renderPreview(); scope.open = false;
      status.textContent = `${preview.reason}. Listings may omit older content.`;
      log(`Scan finished: ${preview.stats.matched} matching items.`);
    } catch (error) { results.replaceChildren(); counters.hidden = true; status.textContent = error.message; log(error.code || 'Scan failed'); }
    finally { setBusy(false); }
  }
  async function execute(phrase) {
    dialog?.close(); dialog?.remove(); dialog = null;
    controller = new AbortController(); scheduler.resume(); pause.textContent = 'Pause'; setBusy(true);
    try {
      if (!navigator.locks) throw new Error('This browser cannot safely lock an operation. Use a current desktop browser.');
      const run = await navigator.locks.request('wipeditt.operation', { ifAvailable: true }, async lock => {
        if (!lock) throw new Error('Wipeditt is already running in another tab. Stop that run first.');
        return engine.execute(options(), { confirmed: true, phrase, signal: controller.signal });
      });
      lastReport = makeReport(run, version, scheduler.stats); report.disabled = false;
      const counts = Object.entries(lastReport.counts).map(([state, n]) => `${n} ${state}`).join(' · ');
      status.textContent = `${simulation ? 'DEMO · No Reddit content changed. ' : ''}${run.stopped ? 'Stopped' : 'Finished'} · ${counts || 'No changes'}`;
      results.replaceChildren(); counters.hidden = true;
    } catch (error) { status.textContent = error.message; engine.cancelConfirmation(); }
    finally { setBusy(false); }
  }
  function confirm() {
    try {
      const info = engine.confirmationFor(options());
      const phrase = el('input', { type: 'text', autocomplete: 'off', 'aria-label': 'Confirmation phrase' });
      const accept = button(simulation ? 'Run demo' : 'Anonymize selected', () => execute(phrase.value), 'primary');
      accept.disabled = !!info.phrase;
      phrase.addEventListener('input', () => { accept.disabled = phrase.value !== info.phrase; });
      const cancel = button('Cancel', cancelDialog);
      dialog = el('dialog', { 'aria-labelledby': 'confirmation-title' },
        el('h2', { id: 'confirmation-title', text: `Confirm ${info.count} content changes` }),
        el('p', { class: 'sensitive', text: `${simulation ? 'Demo only. ' : `Account: u/${account.name}. `}${fields.mode.selectedOptions[0].textContent}.` }),
        fields.mode.value !== 'delete' ? el('div', {}, el('strong', { text: 'Exact replacement' }), el('pre', { class: 'sensitive', text: fields.replacement.value })) : null,
        el('p', { class: 'muted', text: 'Changes may be permanent. Archives, caches and moderation records may retain copies. Stop prevents new requests; submitted requests may finish.' }),
        info.phrase ? el('label', { class: 'field' }, `Type ${info.phrase}`, phrase) : null,
        el('div', { class: 'actions end' }, cancel, accept));
      dialog.addEventListener('cancel', event => { event.preventDefault(); event.stopPropagation(); cancelDialog(); });
      root.append(dialog); dialog.showModal(); cancel.focus();
    } catch (error) { status.textContent = error.message; }
  }
  const connectButton = button('Connect Reddit', showSetup, 'primary');
  const openReddit = el('a', { class: 'button-link', href: 'https://www.reddit.com/', target: '_blank', rel: 'noopener noreferrer', text: 'Open Reddit', hidden: true });
  const disconnect = button('Disconnect', () => { reset(); status.textContent = 'Disconnected. Your access token was cleared.'; });
  const scan = button('Scan history', performScan, 'primary');
  const review = button('Review selected', confirm, 'primary');
  const pause = button('Pause', () => { scheduler.paused ? scheduler.resume() : scheduler.pause(); pause.textContent = scheduler.paused ? 'Resume' : 'Pause'; });
  const stop = button('Stop', () => { if (connecting) auth.disconnect(); controller?.abort(); scheduler.resume(); status.textContent = 'Stopping. Submitted requests may still finish.'; });
  const detailsCounts = el('p', { class: 'muted' });
  const demo = button('Try demo data', async () => {
    reset(); simulation = true; useAdapter(new SimulationAdapter()); account = await engine.account();
    fields.mode.value = 'anonymize'; status.textContent = 'Demo ready. Scan synthetic content to explore the workflow.'; refresh();
  });
  const report = button('Export report', () => {
    if (!lastReport) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(lastReport, null, 2)], { type: 'application/json' }));
    el('a', { href: url, download: `wipeditt-${version}-report.json` }).click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }); report.disabled = true;
  const scope = el('details', { class: 'scope', open: true, hidden: true }, el('summary', { text: '1 · Choose content' }),
    el('div', { class: 'grid' },
      field('type', 'Content', { value: 'comment', choices: [['comment', 'Comments'], ['post', 'Text posts'], ['all', 'Comments & text posts']] }),
      field('limit', 'Maximum items', { type: 'number', value: '100', min: 0, max: 100000 })),
    el('details', { class: 'filters' }, el('summary', { text: 'Add filters' }), el('div', { class: 'grid' },
      field('include', 'Only these subreddits', { placeholder: 'privacy, technology' }), field('exclude', 'Exclude subreddits'),
      field('contains', 'Text contains'), field('after', 'From', { type: 'datetime-local' }), field('before', 'Until', { type: 'datetime-local' }),
      field('regex', 'Regular expression', { maxLength: 300 }), field('minScore', 'Minimum score', { type: 'number' }), field('maxScore', 'Maximum score', { type: 'number' }),
      field('edited', 'Edited status', { choices: [['all', 'Any'], ['yes', 'Edited'], ['no', 'Unedited']] }))),
    el('small', { text: '0 = all available. Reddit listings may not contain your entire history.' }));
  const operation = el('section', { class: 'operation', hidden: true },
    el('h2', { text: '2 · Review & replace' }), results,
    field('replacement', 'Replace selected text with', { type: 'textarea', value: DEFAULT_REPLACEMENT, maxLength: 10000, advanced: true }),
    el('p', { class: 'muted', text: 'Replaces comment or text-post bodies. Post titles and media stay unchanged.' }),
    el('details', { class: 'operation-settings' }, el('summary', { text: 'Operation settings' }),
      field('mode', 'Mode', { advanced: true, choices: [['anonymize', 'Anonymize'], ['delete', 'Delete · demo only'], ['combined', 'Anonymize & delete · demo only']] }),
      field('interval', 'Minimum request interval (ms)', { type: 'number', value: '1500', min: 1500, max: 3600000, advanced: true, hint: 'Reddit cooldowns always take priority.' }),
      field('deleteDelay', 'Demo deletion delay (ms)', { type: 'number', value: '0', min: 0, max: 86400000, advanced: true })));
  const privacy = el('input', { type: 'checkbox', onChange: event => root.classList.toggle('private', event.target.checked) });
  const theme = button('Light mode', () => { panel.classList.toggle('light'); theme.textContent = panel.classList.contains('light') ? 'Dark mode' : 'Light mode'; });
  const hide = button('Close', () => { connectionRevision++; connecting = false; busy = false; cancelDialog(); controller?.abort(); scheduler?.resume(); auth.disconnect(); if (!simulation) { account = null; engine?.invalidate(); results.replaceChildren(); refresh(); } panel.hidden = true; launcher.focus(); });
  const launcher = button('Wipeditt', () => { if (panel.hidden) { panel.hidden = false; connectButton.focus(); } else hide.click(); }, 'launcher');
  launcher.setAttribute('aria-label', 'Open Wipeditt');
  const mark = el('img', { src: `data:image/svg+xml;base64,${btoa(icon)}`, alt: '', width: 32, height: 32 });
  panel.append(
    el('header', {}, el('div', { class: 'brand' }, mark, el('div', {}, el('h1', { text: 'Wipeditt' }), el('p', { text: 'Your Reddit history. Your control.' }))), hide),
    el('div', { class: 'connection' }, connection, disconnect), modeNotice,
    el('div', { class: 'connect-action' }, connectButton, openReddit), scope, scan, operation,
    el('div', { class: 'actions operation-actions' }, review, pause, stop), progress, status,
    el('details', { class: 'settings' }, el('summary', { text: 'Settings & help' }),
      el('div', { class: 'actions' }, el('label', {}, privacy, ' Privacy mode'), theme, report),
      el('details', {}, el('summary', { text: 'Scan details & activity' }), detailsCounts, activity),
      el('div', { class: 'actions' }, demo, button('Clear local checkpoint', () => { checkpoints.clear(); status.textContent = 'Local checkpoint cleared.'; })),
      el('small', { text: `v${version} · Rafael (rafaelolv) · No telemetry` })));
  root.append(el('style', { text: styles }), launcher, panel);
  useAdapter({ simulation: false, account: async () => { throw new Error('Connect Reddit first.'); } });
  const previous = checkpoints.load();
  if (previous) log(`Interrupted checkpoint: ${previous.records.length} item states. Rescan and review; no automatic replay.`);
  panel.hidden = true; refresh();
  root.addEventListener('keydown', event => { if (event.key === 'Escape' && !dialog && !event.defaultPrevented) hide.click(); });
  return { panel, engine: () => engine };
}
