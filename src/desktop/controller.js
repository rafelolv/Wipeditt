import { randomUUID } from 'node:crypto';
import { Engine } from '../engine.js';
import { Scheduler } from '../scheduler.js';
import { Checkpoints } from '../checkpoint.js';
import { SimulationAdapter } from '../adapters/simulation.js';
import { normalizeOptions } from '../filters.js';
import { makeReport } from '../report.js';
import { fail } from '../errors.js';

export class DesktopController {
  constructor({ browser, storage, version, onState = () => {}, saveReport = async () => {}, openOriginal = async () => {} }) {
    Object.assign(this, { browser, version, onState, saveReport, openOriginal });
    this.checkpoints = new Checkpoints(storage);
    this.options = normalizeOptions({ type: 'comment' });
    this.account = null;
    this.busy = false;
    this.simulation = false;
    this.browserVisible = false;
    this.report = null;
    this.confirmation = null;
    this.activity = [];
    this.status = 'Connect Reddit to review your history.';
    this.useAdapter(browser.adapter);
    const checkpoint = this.checkpoints.load();
    if (checkpoint) this.log(`${checkpoint.records.length} interrupted item states found. A new scan and review are required; nothing will resume automatically.`);
  }
  useAdapter(adapter) {
    this.scheduler = adapter.scheduler || new Scheduler();
    this.scheduler.onWait = wait => { this.wait = wait; this.emit(); };
    this.engine = new Engine({ adapter, scheduler: this.scheduler, checkpoints: this.checkpoints, onEvent: event => {
      if (event.type === 'scan') this.status = `Scanning · ${event.inspected} inspected · ${event.matched} matching`;
      if (event.type === 'progress') {
        this.progress = { total: event.total, elapsed: event.elapsed, counts: {} };
        for (const record of event.records) this.progress.counts[record.state] = (this.progress.counts[record.state] || 0) + 1;
        this.log(`${event.records.at(-1)?.id}: ${event.records.at(-1)?.state}`);
      }
      this.emit();
    } });
  }
  log(message) { this.activity.unshift({ at: Date.now(), message }); this.activity = this.activity.slice(0, 30); }
  snapshot() {
    const preview = this.engine.preview;
    return {
      version: this.version, account: this.account, busy: this.busy, simulation: this.simulation,
      browserVisible: this.browserVisible, paused: this.scheduler.paused, options: this.options,
      status: this.status, wait: this.busy ? this.wait : null, progress: this.progress,
      activity: this.activity, hasReport: !!this.report,
      preview: preview ? { items: preview.items, stats: preview.stats, reason: preview.reason, selected: preview.items.filter(item => item.selected && !item.skip).length } : null
    };
  }
  emit() { this.onState(this.snapshot()); }
  invalidate() { this.engine.invalidate(); this.confirmation = null; }
  stop() { this.abort?.abort(); this.scheduler.resume(); this.engine.cancelConfirmation(); this.confirmation = null; this.status = 'Stopping. Submitted edits may still finish.'; this.emit(); }
  requireIdle() { if (this.busy) fail('BUSY', 'Wait for the current operation or stop it first.'); }
  async work(action) {
    this.requireIdle(); this.scheduler.resume(); this.busy = true; this.wait = null; this.abort = new AbortController();
    this.emit();
    try { return await action(this.abort.signal); }
    catch (error) { this.status = error.message || 'Operation failed.'; this.log(error.code || 'ERROR'); throw error; }
    finally { this.busy = false; this.wait = null; this.emit(); }
  }
  async command(name, data = {}) {
    if (name === 'state') return this.snapshot();
    if (name === 'stop') { this.stop(); return; }
    if (name === 'pause') { if (this.busy) this.scheduler.pause(); this.emit(); return; }
    if (name === 'resume') { this.scheduler.resume(); this.emit(); return; }
    if (name === 'cancel-confirmation') { this.engine.cancelConfirmation(); this.confirmation = null; return; }
    if (name === 'scan') return this.work(async signal => {
      if (!this.account) fail('AUTH', 'Connect and verify your Reddit account first.');
      this.browser.hide(); this.browserVisible = false; this.progress = null; this.report = null;
      this.options = normalizeOptions(data.options);
      if (!this.simulation && this.options.mode !== 'anonymize') fail('DELETION_UNVERIFIED', 'Real-account deletion is not enabled.');
      this.status = 'Scanning your Reddit history…';
      const preview = await this.engine.scan(this.options, signal);
      this.status = `${preview.stats.matched} matching items. ${preview.reason}.`;
      this.log('Scan finished. Review selected items before editing.');
    });
    if (name === 'run') return this.work(async signal => {
      if (!this.confirmation || data.token !== this.confirmation) fail('CONFIRM', 'Open a new confirmation before running.');
      this.confirmation = null;
      this.browser.hide(); this.browserVisible = false;
      const run = await this.engine.execute(this.options, { confirmed: true, phrase: data.phrase || '', signal });
      this.report = makeReport(run, this.version, this.scheduler.stats);
      this.report.integration = this.simulation ? 'simulation' : 'native-browser';
      this.status = `${this.simulation ? 'DEMO · No Reddit content changed. ' : ''}${run.stopped ? 'Stopped' : 'Finished'} · ${Object.entries(this.report.counts).map(([state, count]) => `${count} ${state}`).join(' · ') || 'No changes'}`;
    });
    this.requireIdle();
    if (name === 'connect') {
      return this.work(async () => {
        this.invalidate(); this.account = null; this.simulation = false; this.report = null; this.activity = [];
        this.browserVisible = true; this.status = 'Opening your isolated Reddit browser…'; this.emit();
        try { await this.browser.open({ remember: data.remember === true }); }
        finally { this.useAdapter(this.browser.adapter); }
        this.status = 'Sign in on Reddit, then choose Verify account.';
      });
    } else if (name === 'verify-account') {
      return this.work(async signal => {
        this.invalidate();
        this.account = await this.browser.adapter.connect({ signal });
        this.browser.hide(); this.browserVisible = false; this.simulation = false;
        this.status = `Connected as u/${this.account.name}. Choose what to scan.`;
      });
    } else if (name === 'show-browser') {
      this.invalidate(); await this.browser.show(); this.useAdapter(this.browser.adapter); this.simulation = false; this.browserVisible = true;
      this.status = 'Review Reddit in the browser. Verify the account again before a new scan.';
      this.account = null;
    } else if (name === 'hide-browser') {
      this.browser.hide(); this.browserVisible = false;
    } else if (name === 'disconnect') {
      this.invalidate(); await this.browser.clear(); this.account = null; this.browserVisible = false; this.report = null; this.activity = []; this.progress = null;
      this.checkpoints.clear(); this.status = 'Disconnected. Wipeditt’s Reddit session data was cleared.';
    } else if (name === 'invalidate') {
      this.invalidate(); this.status = 'Filters changed. Scan again to update your selection.';
    } else if (name === 'options') {
      const next = normalizeOptions(data.options);
      if (!this.simulation && next.mode !== 'anonymize') fail('DELETION_UNVERIFIED', 'Real-account deletion is not enabled.');
      this.options = next;
      this.confirmation = null;
      this.engine.updateOperation(next);
    } else if (name === 'select') {
      if (!Array.isArray(data.ids) || data.ids.length > 100000 || typeof data.selected !== 'boolean') fail('SELECTION', 'Invalid content selection.');
      for (const id of data.ids) this.engine.select(id, data.selected);
      this.confirmation = null;
    } else if (name === 'confirm') {
      const confirmation = this.engine.confirmationFor(this.options);
      this.confirmation = randomUUID();
      return { ...confirmation, token: this.confirmation, account: this.account?.name, replacement: this.options.replacement, mode: this.options.mode };
    } else if (name === 'export-report') {
      if (!this.report) fail('REPORT', 'Run an operation before exporting its report.');
      await this.saveReport(this.report);
    } else if (name === 'open-original') {
      const item = this.engine.preview?.items.find(item => item.id === data.id);
      if (!item) fail('STALE', 'Scan again before opening this item.');
      await this.openOriginal(item.permalink);
    } else if (name === 'clear-checkpoint') {
      this.checkpoints.clear(); this.status = 'Local checkpoint cleared.';
    } else if (name === 'demo') {
      this.invalidate(); await this.browser.clear(); this.browserVisible = false;
      const adapter = new SimulationAdapter();
      this.useAdapter(adapter); this.account = await adapter.account(); this.simulation = true;
      this.status = 'DEMO · Synthetic content. No Reddit account is connected.';
    } else fail('COMMAND', 'Unknown application command.');
    this.emit();
  }
}
