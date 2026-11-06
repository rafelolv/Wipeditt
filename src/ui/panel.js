import styles from './styles.css';
import { el, safeLink } from './dom.js';
import { DEFAULT_REPLACEMENT } from '../filters.js';
import { Engine } from '../engine.js';
import { Scheduler } from '../scheduler.js';
import { BlockedAdapter } from '../adapters/blocked.js';
import { SimulationAdapter } from '../adapters/simulation.js';
import { Checkpoints } from '../checkpoint.js';
import { makeReport } from '../report.js';

export function mount(root, version) {
  const fields = {};
  let engine, controller, lastReport, dialog, simulation = false, busy = false;
  let storage;
  try { storage = sessionStorage; } catch { /* Panel still works without storage. */ }
  const checkpoints = new Checkpoints(storage);
  const notice = el('p', { class: 'notice', role: 'status', text: 'Live integration unavailable · Reddit approval and verified OAuth required. Your Reddit account is not connected.' });
  const status = el('p', { class: 'status', role: 'status', 'aria-live': 'polite', text: 'Choose settings, scan, then review before changing content.' });
  const results = el('div', { class: 'results', 'aria-label': 'Scan results' });
  const counters = el('p', { class: 'counts', text: 'Inspected 0 · Unique 0 · Matching 0 · Eligible 0 · Selected 0' });
  const activity = el('ol', { class: 'activity' });
  const progress = el('progress', { max: 1, value: 0, 'aria-label': 'Operation progress' });
  const log = message => { activity.prepend(el('li', { text: message })); while (activity.children.length > 30) activity.lastChild.remove(); };
  function cancelDialog() { engine.cancelConfirmation(); dialog?.close(); dialog?.remove(); dialog = null; }
  function invalidate() { cancelDialog(); engine.invalidate(); results.replaceChildren(); review.disabled = true; status.textContent = 'Settings changed. Scan again for a current preview.'; }
  function field(name, title, { type = 'text', value = '', choices, hint, ...attrs } = {}) {
    const input = choices ? el('select', { id: name, ...attrs }, choices.map(([value, text]) => el('option', { value, text })))
      : type === 'textarea' ? el('textarea', { id: name, rows: 3, value, ...attrs }) : el('input', { id: name, type, value, ...attrs });
    if (choices && value) input.value = value;
    fields[name] = input;
    if (['include', 'exclude', 'contains', 'regex', 'replacement'].includes(name)) input.classList.add('sensitive');
    input.addEventListener('input', invalidate);
    return el('label', { class: 'field', htmlFor: name }, el('span', { text: title }), input, hint ? el('small', { text: hint }) : null);
  }
  const options = () => Object.fromEntries(Object.entries(fields).map(([key, input]) => [key, input.value]));
  const button = (text, fn, className = '') => { const b = el('button', { type: 'button', text, onClick: fn, class: className }); return b; };
  function setBusy(value) {
    busy = value;
    for (const input of Object.values(fields)) input.disabled = value;
    for (const input of panel.querySelectorAll('fieldset button, fieldset select')) input.disabled = value;
    scan.disabled = value;
    demo.disabled = value;
    review.disabled = value || !engine.preview;
    pause.disabled = !value;
    stop.disabled = !value;
    for (const input of results.querySelectorAll('input, button')) input.disabled = value || input.dataset.ineligible === 'true';
  }
  function connect(adapter) {
    engine = new Engine({ adapter, checkpoints, scheduler: new Scheduler({ onWait: wait => { status.textContent = `${wait.reason}${wait.remaining ? ` · ${(wait.remaining / 1000).toFixed(1)}s` : ''}`; } }), onEvent: event => {
      if (event.type === 'scan') status.textContent = `Scanning · ${event.inspected} inspected · ${event.matched} matching`;
      if (event.type === 'progress') {
        progress.max = event.total;
        progress.value = event.records.filter(r => ['anonymized', 'deleted', 'skipped', 'failed', 'uncertain'].includes(r.state)).length;
        const counts = {};
        for (const record of event.records) counts[record.state] = (counts[record.state] || 0) + 1;
        status.textContent = `${simulation ? 'SIMULATION · ' : ''}${event.records.length}/${event.total} scheduled · ${Object.entries(counts).map(([key, n]) => `${key}: ${n}`).join(' · ')} · Elapsed ${Math.round(event.elapsed / 1000)}s`;
        log(`${event.records.at(-1)?.id}: ${event.records.at(-1)?.state}`);
      }
    } });
  }
  function selectedCount() {
    const p = engine.preview;
    if (!p) return;
    const selected = p.items.filter(i => i.selected && !i.skip).length;
    counters.textContent = `Inspected ${p.stats.inspected} · Unique ${p.stats.unique} · Matching ${p.stats.matched} · Eligible ${p.stats.eligible} · Selected ${selected}`;
    review.disabled = busy || !selected;
  }
  function renderPreview(preview) {
    results.replaceChildren();
    const subreddits = [...new Set(preview.items.map(i => i.subreddit))];
    const groups = el('div', { class: 'groups' }, subreddits.map(name => button(`Toggle r/${name}`, () => {
      cancelDialog();
      const items = preview.items.filter(i => i.subreddit === name && !i.skip);
      const selected = !items.every(i => i.selected);
      for (const item of items) engine.select(item.id, selected);
      renderPreview(preview);
    }, 'sensitive')));
    results.append(groups);
    for (const item of preview.items) {
      const check = el('input', { type: 'checkbox', checked: item.selected, disabled: !!item.skip, 'aria-label': `Select ${item.id}` });
      check.dataset.ineligible = String(!!item.skip);
      check.addEventListener('change', () => { cancelDialog(); engine.select(item.id, check.checked); selectedCount(); });
      const link = safeLink(item.permalink);
      const row = el('article', { class: 'item' },
        el('div', { class: 'item-head' }, check, el('strong', { class: 'sensitive', text: `r/${item.subreddit}` }), el('span', { text: `${item.type} · ${new Date(item.created).toLocaleDateString('en-US')} · Score ${item.score ?? 'unknown'}` }), link && item.permalink ? el('a', { href: link, target: '_blank', rel: 'noopener noreferrer', text: 'Original' }) : null),
        el('p', { class: 'original sensitive', text: item.text }),
        preview.options.mode !== 'delete' ? el('p', { class: 'replacement sensitive', text: `Replace with: ${preview.options.replacement}` }) : null,
        el('small', { class: item.skip ? 'warning' : 'eligible', text: item.skip || 'Eligible · ownership verified in simulation' }));
      results.append(row);
    }
    if (!preview.items.length) results.append(el('p', { text: 'No items match these filters.' }));
    status.textContent = `${simulation ? 'SIMULATION · ' : ''}${preview.reason}. Review every selected item.`;
    selectedCount();
  }
  async function performScan() {
    controller = new AbortController();
    engine.scheduler.resume();
    pause.textContent = 'Pause';
    setBusy(true);
    lastReport = null;
    progress.value = 0; progress.max = 1;
    report.disabled = true;
    try {
      const preview = await engine.scan(options(), controller.signal);
      renderPreview(preview);
      log(`Scan: ${preview.stats.matched} matching items. ${preview.reason}.`);
    } catch (error) { status.textContent = error.message; log(error.code || 'Scan failed'); }
    finally { setBusy(false); }
  }
  async function execute(phrase) {
    dialog.close(); dialog.remove(); dialog = null;
    controller = new AbortController();
    engine.scheduler.resume();
    pause.textContent = 'Pause';
    setBusy(true);
    try {
      const run = await engine.execute(options(), { confirmed: true, phrase, signal: controller.signal });
      lastReport = makeReport(run, version, engine.scheduler.stats);
      report.disabled = false;
      status.textContent = `${simulation ? 'SIMULATION · No Reddit content changed. ' : ''}${run.stopped ? 'Stopped' : 'Finished'} · ${JSON.stringify(lastReport.counts)}`;
      results.replaceChildren();
    } catch (error) { status.textContent = error.message; }
    finally { setBusy(false); review.disabled = true; }
  }
  function confirm() {
    try {
      const info = engine.confirmationFor(options());
      const phrase = el('input', { type: 'text', autocomplete: 'off', 'aria-label': 'Confirmation phrase' });
      const accept = el('button', { type: 'button', text: simulation ? 'Run simulation' : 'Confirm operation', disabled: !!info.phrase, onClick: () => execute(phrase.value) });
      phrase.addEventListener('input', () => { accept.disabled = phrase.value !== info.phrase; });
      const cancel = el('button', { type: 'button', text: 'Cancel', onClick: cancelDialog });
      dialog = el('dialog', { 'aria-labelledby': 'confirmation-title' },
        el('h2', { id: 'confirmation-title', text: 'Review your operation' }),
        el('p', { text: `${simulation ? 'Simulation only. ' : ''}${fields.mode.selectedOptions[0].textContent}: ${info.count} selected items.` }),
        el('p', { text: 'Edits can be permanent. Copies in archives, caches and moderation records may remain. Stop prevents new requests; submitted requests may finish.' }),
        fields.mode.value !== 'delete' ? el('pre', { class: 'sensitive', text: fields.replacement.value }) : null,
        info.phrase ? el('label', { text: `Type ${info.phrase} to continue` }, phrase) : null,
        el('div', { class: 'actions' }, cancel, accept));
      dialog.addEventListener('cancel', event => { event.preventDefault(); cancelDialog(); });
      root.append(dialog); dialog.showModal(); cancel.focus();
    } catch (error) { status.textContent = error.message; }
  }
  const scan = button('Scan content', performScan, 'primary');
  const review = button('Review operation', confirm, 'primary'); review.disabled = true;
  const pause = button('Pause', () => {
    if (engine.scheduler.paused) { engine.scheduler.resume(); pause.textContent = 'Pause'; }
    else { engine.scheduler.pause(); pause.textContent = 'Resume'; }
  }); pause.disabled = true;
  const stop = button('Stop', () => { controller?.abort(); engine.scheduler.resume(); status.textContent = 'Stopping. Submitted requests may still finish.'; }); stop.disabled = true;
  const demo = button('Try synthetic data', () => {
    invalidate(); simulation = !simulation; connect(simulation ? new SimulationAdapter() : new BlockedAdapter());
    notice.textContent = simulation ? 'SIMULATION · Synthetic content. No Reddit connection. No real content will be changed.' : 'Live integration unavailable · Reddit approval and verified OAuth required.';
    demo.textContent = simulation ? 'Leave simulation' : 'Try synthetic data';
    status.textContent = simulation ? 'Simulation account: demo_user. Scan to review synthetic content.' : 'Live integration unavailable.';
  });
  const report = button('Export report', () => {
    if (!lastReport) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(lastReport, null, 2)], { type: 'application/json' }));
    const link = el('a', { href: url, download: `wipeditt-${version}-report.json` }); link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }); report.disabled = true;
  const panel = el('section', { class: 'panel', 'aria-label': 'Wipeditt privacy utility' });
  const theme = button('Light mode', () => { const light = panel.classList.toggle('light'); theme.textContent = light ? 'Dark mode' : 'Light mode'; });
  const privacy = el('input', { type: 'checkbox', onChange: event => panel.classList.toggle('private', event.target.checked) });
  const hide = button('Close', () => { cancelDialog(); controller?.abort(); engine.scheduler.resume(); panel.hidden = true; launcher.focus(); });
  const launcher = el('button', { class: 'launcher', type: 'button', text: 'Wipeditt', 'aria-label': 'Open Wipeditt', onClick: () => { if (!panel.hidden) hide.click(); else { panel.hidden = false; hide.focus(); } } });
  root.append(el('style', { text: styles }), launcher, panel);
  panel.append(
    el('header', {}, el('div', {}, el('h1', { text: 'Wipeditt' }), el('p', { text: 'Your Reddit history. Your control.' })), el('div', { class: 'actions' }, theme, hide)),
    notice, el('div', { class: 'connection' }, demo, el('label', {}, privacy, ' Privacy mode')),
    el('details', { class: 'scope', open: true }, el('summary', { text: 'Scope & filters' }),
      el('fieldset', {}, el('legend', { text: 'Target' }), el('div', { class: 'grid' },
        field('type', 'Content', { choices: [['all', 'All supported content'], ['comment', 'Comments'], ['post', 'Text posts']] }),
        field('limit', 'Item limit', { type: 'number', value: '100', min: 0, max: 100000, hint: '0 = all available; history may be incomplete' }),
        field('include', 'Include subreddits', { placeholder: 'privacy, technology' }), field('exclude', 'Exclude subreddits', { placeholder: 'Leave empty for none' }),
        field('contains', 'Text contains')),
        el('div', { class: 'actions' }, [50, 100, 500, 0].map(n => button(n ? String(n) : 'All available', () => { fields.limit.value = n; invalidate(); })))),
      el('details', { class: 'extra-filters' }, el('summary', { text: 'Dates, pattern & score' }), el('div', { class: 'grid' },
        field('after', 'From (inclusive)', { type: 'datetime-local' }), field('before', 'Until (inclusive)', { type: 'datetime-local' }),
        field('regex', 'Regular expression', { maxLength: 300 }),
        field('minScore', 'Minimum score', { type: 'number' }), field('maxScore', 'Maximum score', { type: 'number' }),
        field('edited', 'Edited status', { choices: [['all', 'Any'], ['yes', 'Edited'], ['no', 'Unedited']] })))),
    el('fieldset', {}, el('legend', { text: 'Operation' }), field('mode', 'Operation mode', { choices: [['anonymize', 'Anonymize'], ['delete', 'Delete · simulation only'], ['combined', 'Anonymize & Delete · simulation only']] }),
      el('label', { class: 'field' }, el('span', { text: 'Replacement preset' }), el('select', { 'aria-label': 'Replacement preset', onChange: event => { if (event.target.value !== 'custom') fields.replacement.value = event.target.value; invalidate(); } }, [DEFAULT_REPLACEMENT, '[Deleted for privacy]', '[Content removed]', 'custom'].map(value => el('option', { value, text: value === 'custom' ? 'Custom text' : value })))),
      field('replacement', 'Exact replacement text', { type: 'textarea', value: DEFAULT_REPLACEMENT, maxLength: 10000 }),
      el('p', { class: 'muted', text: 'Replaces comment or editable text-post bodies. Titles and media cannot be anonymized. Does not erase external copies.' })),
    el('details', {}, el('summary', { text: 'Advanced scheduling' }),
      field('interval', 'Minimum request interval (ms)', { type: 'number', value: '1500', min: 1500, max: 3600000, hint: 'Automatic server cooldowns always take precedence.' }),
      field('deleteDelay', 'Combined-mode deletion delay (ms)', { type: 'number', value: '0', min: 0, max: 86400000, hint: '0 = immediately after verification. Requires this tab to remain active.' })),
    el('div', { class: 'actions' }, scan, review, pause, stop), counters, status, progress, results,
    el('details', {}, el('summary', { text: 'Activity' }), activity),
    el('footer', {}, report, button('Clear checkpoint', () => { checkpoints.clear(); log('Local checkpoint cleared.'); }), el('small', { text: `v${version} · Rafael (rafaelolv) · Local only` })));
  connect(new BlockedAdapter());
  const previous = checkpoints.load();
  if (previous) log(`Interrupted checkpoint: ${previous.records.length} item states. No automatic replay. Rescan and verify before any new run.`);
  panel.hidden = true;
  root.addEventListener('keydown', event => { if (event.key === 'Escape' && !dialog) hide.click(); });
  return { panel, engine: () => engine };
}
