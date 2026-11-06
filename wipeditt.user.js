// ==UserScript==
// @name         Wipeditt
// @namespace    https://github.com/rafelolv/Wipeditt
// @version      0.1.0
// @description  Local Reddit history review and anonymization utility — live integration pending approval
// @author       Rafael (rafaelolv)
// @copyright    2026 Rafael (rafaelolv)
// @license      LicenseRef-Wipeditt-Proprietary
// @homepageURL  https://github.com/rafelolv/Wipeditt
// @supportURL   https://github.com/rafelolv/Wipeditt/issues
// @downloadURL  https://raw.githubusercontent.com/rafelolv/Wipeditt/main/wipeditt.user.js
// @updateURL    https://raw.githubusercontent.com/rafelolv/Wipeditt/main/wipeditt.user.js
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiB2aWV3Qm94PSIwIDAgMTI4IDEyOCI+PHJlY3Qgd2lkdGg9IjEyOCIgaGVpZ2h0PSIxMjgiIHJ4PSIzMCIgZmlsbD0iIzE3MjUxYyIvPjxwYXRoIGQ9Ik0yNCAzOWgxN2wxMCAzNiAxMy0yOSAxMyAyOSAxMC0zNmgxN0w4NSA5NEg3M2wtOS0yMS05IDIxSDQzeiIgZmlsbD0iI2EwZGNiNCIvPjxwYXRoIGQ9Ik03NyAyN2gyN004NyAxOWgxNyIgc3Ryb2tlPSIjYTBkY2I0IiBzdHJva2Utd2lkdGg9IjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjwvc3ZnPgo=
// @match        https://www.reddit.com/*
// @match        https://old.reddit.com/*
// @run-at       document-idle
// @grant        none
// @noframes
// ==/UserScript==
/*!
Wipeditt Proprietary License 1.0
SPDX-License-Identifier: LicenseRef-Wipeditt-Proprietary

Copyright (c) 2026 Rafael (rafaelolv). All rights reserved.

1. Ownership and scope

Rafael (rafaelolv) owns the original Wipeditt code, documentation and artwork
(the "Software") distributed under these terms, beginning with version 0.1.0.
All rights not expressly granted are reserved. Public source visibility does
not make the Software open source. No patent or trademark license is granted.

2. Personal use

You may download official, unmodified packages, install them on your own
devices and run them for personal, non-commercial management of Reddit
accounts you control. You may make local copies necessary for installation,
execution and personal backup. This permission is non-exclusive and
non-transferable. Preserve all copyright, attribution and license notices.

3. Prior written permission required

Except for section 2, mandatory legal rights or applicable hosting-platform
terms, you must obtain Rafael's prior written permission to:

- Copy, redistribute, publish, mirror, sublicense, sell, rent or transfer
  the Software or any substantial part of its original material.
- Modify, translate, adapt or create derivative software from the Software.
- Use the Software commercially, provide it as a service or bundle it
  into another product or distribution.
- Remove ownership notices or claim the Software or its original material
  as your own creation.
- Use Wipeditt's name or artwork to suggest authorization or endorsement.

Inspection of publicly visible source grants no additional reuse rights.
These terms do not claim ownership of Reddit, third-party material, abstract
ideas, functionality or independently created implementations.

4. Independent rights

Third-party components retain their own licenses. Nothing here removes
mandatory legal exceptions, rights independently held by recipients or
rights granted by a hosting platform's applicable terms, including any
permitted viewing and forking on that platform.

5. Termination

Permission terminates upon breach. Stop use and delete copies covered only
by this license, except copies you are legally entitled or required to keep.

6. Warranty and liability

TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE SOFTWARE IS PROVIDED
"AS IS", WITHOUT WARRANTIES OF ANY KIND, INCLUDING MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT. THE COPYRIGHT HOLDER IS NOT
LIABLE FOR CLAIMS OR DAMAGES ARISING FROM THE SOFTWARE OR ITS USE. CONTENT
CHANGES AND DELETION MAY BE PERMANENT. NOTHING EXCLUDES LIABILITY THAT CANNOT
LAWFULLY BE EXCLUDED. EDITING DOES NOT GUARANTEE REMOVAL OF EXTERNAL COPIES.

7. Additional permissions

Request explicit written permission from Rafael (rafaelolv) through:
https://github.com/rafelolv/Wipeditt
*/
(() => {
  // src/ui/styles.css
  var styles_default = ':host{all:initial;color-scheme:dark;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:13px;color:#dce5df}\n*{box-sizing:border-box}\nbutton,input,select,textarea{font:inherit}\nbutton,a,input,select,textarea,summary{outline-offset:3px}\n :focus-visible{outline:2px solid #8edbb0}\nbutton{cursor:pointer;border:1px solid var(--border,#39413d);border-radius:6px;padding:7px 11px;background:var(--input,#252d28);color:inherit}\nbutton:hover:not(:disabled){border-color:#8edbb0}\nbutton:disabled{opacity:.45;cursor:default}\n.primary{background:#a0dcb4;color:#102419;border-color:#a0dcb4;font-weight:650}\n.launcher{position:fixed;bottom:22px;right:22px;background:#a0dcb4;color:#102419;font-weight:700;box-shadow:0 4px 20px #0004}\n.panel{--border:#343e37;--input:#202923;position:fixed;right:22px;bottom:68px;width:min(660px,calc(100vw - 32px));max-height:calc(100dvh - 100px);overflow:auto;background:#171e1a;color:#dce5df;border:1px solid var(--border);border-radius:12px;padding:22px;box-shadow:0 16px 60px #0006;line-height:1.5}\n.panel.light{--border:#c7d4ca;--input:#fff;background:#f5f8f5;color:#223629;color-scheme:light}\n.panel[hidden]{display:none}\nh1{font-size:23px;letter-spacing:-.8px;margin:0}\nheader{display:flex;justify-content:space-between;gap:16px;align-items:start}\nheader p{margin:2px 0;color:#8caa96}\nh2{font-size:18px}\n.notice{border-left:3px solid #a0dcb4;background:#80bc9820;padding:10px 12px;margin:20px 0 12px}\n.connection,.actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}\n.connection{justify-content:space-between}\n.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 14px}\n.field{display:flex;flex-direction:column;gap:4px;margin:8px 0}\n.field>span{font-weight:550}\ninput:not([type=checkbox]),select,textarea{width:100%;color:inherit;background:var(--input,#202923);border:1px solid var(--border,#343e37);padding:8px;border-radius:5px;min-width:0}\ntextarea{resize:vertical}\ninput[type=checkbox]{accent-color:#83c69c;width:16px;height:16px}\nfieldset{border:0;border-top:1px solid var(--border);padding:12px 0 6px;margin:20px 0 8px;min-width:0}\nlegend{font-weight:650;padding-right:12px}\nsmall,.muted{font-size:11px;opacity:.75}\n.counts{font-size:11px;color:#83c69c}\n.status{min-height:20px;font-size:12px}\n.results{margin:12px 0}\n.item{padding:12px 0;border-bottom:1px solid var(--border)}\n.item-head{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:11px}\n.item-head a{margin-left:auto;color:#83c69c}\n.original,.replacement{white-space:pre-wrap;overflow-wrap:anywhere;margin:8px 0;font-size:12px}\n.replacement{color:#83c69c}\n.warning{color:#e5b37d}\n.eligible{color:#83c69c}\n.groups{display:flex;gap:5px;flex-wrap:wrap}\n.groups button{font-size:11px;padding:4px 7px}\ndetails{border-top:1px solid var(--border);padding:12px 0}\nsummary{cursor:pointer}\n.activity{padding-left:20px;font:11px ui-monospace,monospace;max-height:150px;overflow:auto}\nfooter{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:16px}\nfooter small{margin-left:auto}\nprogress{width:100%;height:5px;accent-color:#a0dcb4}\ndialog{color:#dce5df;background:#171e1a;border:1px solid #46594c;border-radius:10px;max-width:min(500px,90vw);padding:24px;font:13px/1.5 system-ui}\ndialog::backdrop{background:#000a}\ndialog pre{white-space:pre-wrap;overflow-wrap:anywhere}\n.private .sensitive{filter:blur(6px);user-select:none}\n.private dialog .sensitive{filter:blur(6px)}\n@media(max-width:480px){.panel{right:16px;padding:16px}\n.grid{grid-template-columns:1fr}\nheader{flex-wrap:wrap}\n}\n\n.light .counts,.light .replacement,.light .eligible,.light .item-head a{color:#285b3b}\n.light .warning{color:#855019}\n.light header p{color:#466451}\n.scope{margin-top:16px}\n';

  // src/ui/dom.js
  function el(tag, attributes = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attributes)) {
      if (key.startsWith("on")) node.addEventListener(key.slice(2).toLowerCase(), value);
      else if (key === "text") node.textContent = value;
      else if (key === "class") node.className = value;
      else if (key in node && !key.startsWith("aria")) node[key] = value;
      else node.setAttribute(key, value);
    }
    for (const child of children.flat()) if (child !== null && child !== void 0) node.append(child);
    return node;
  }
  function safeLink(value) {
    try {
      const url = new URL(value, "https://www.reddit.com");
      return url.protocol === "https:" && ["www.reddit.com", "old.reddit.com", "reddit.com"].includes(url.hostname) && !url.username && !url.password ? url.href : null;
    } catch {
      return null;
    }
  }

  // src/errors.js
  var AppError = class extends Error {
    constructor(code, message, details = {}) {
      super(message);
      this.name = "AppError";
      this.code = code;
      Object.assign(this, details);
    }
  };
  function checkAbort(signal) {
    if (signal?.aborted) throw new AppError("STOPPED", "Stopped. Submitted requests may still finish.");
  }
  function sleep(ms, signal) {
    checkAbort(signal);
    return new Promise((resolve, reject) => {
      const finish = () => {
        signal?.removeEventListener("abort", abort);
        resolve();
      };
      const timer = setTimeout(finish, ms);
      const abort = () => {
        clearTimeout(timer);
        signal.removeEventListener("abort", abort);
        reject(new AppError("STOPPED", "Stopped."));
      };
      signal?.addEventListener("abort", abort, { once: true });
    });
  }
  var fail = (code, message) => {
    throw new AppError(code, message);
  };

  // src/filters.js
  var DEFAULT_REPLACEMENT = "This content has been removed for privacy reasons.";
  var list = (value) => [...new Set(String(value || "").split(/[\s,]+/).filter(Boolean).map((s) => s.replace(/^r\//i, "").toLowerCase()))].sort();
  function date(value) {
    if (!value) return null;
    const parts = /^(\d{4})-(\d{2})-(\d{2})(?:T|$)/.exec(String(value));
    if (!parts) fail("FILTER", "Enter an ISO date or date and time.");
    const [year, month, day] = parts.slice(1).map(Number);
    const calendar = new Date(Date.UTC(year, month - 1, day));
    if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) fail("FILTER", "Enter a valid calendar date.");
    const n = Date.parse(value);
    if (!Number.isFinite(n)) fail("FILTER", "Enter a valid date and time.");
    return n;
  }
  function number(value, fallback = null) {
    if (value === "" || value === void 0 || value === null) return fallback;
    const n = Number(value);
    if (!Number.isFinite(n)) fail("FILTER", "Enter a finite numeric value.");
    return n;
  }
  function normalizeOptions(raw = {}) {
    const o = {
      type: raw.type || "all",
      include: list(raw.include),
      exclude: list(raw.exclude),
      after: date(raw.after),
      before: date(raw.before),
      contains: String(raw.contains || ""),
      regex: String(raw.regex || ""),
      minScore: number(raw.minScore),
      maxScore: number(raw.maxScore),
      edited: raw.edited || "all",
      limit: number(raw.limit, 100),
      mode: raw.mode || "anonymize",
      replacement: raw.replacement ?? DEFAULT_REPLACEMENT,
      interval: number(raw.interval, 1500),
      deleteDelay: number(raw.deleteDelay, 0)
    };
    if (!["all", "comment", "post"].includes(o.type) || !["all", "yes", "no"].includes(o.edited) || !["anonymize", "delete", "combined"].includes(o.mode)) fail("FILTER", "Invalid operation or content type.");
    if (o.after !== null && o.before !== null && o.after >= o.before) fail("FILTER", "Start date must precede end date.");
    if (o.minScore !== null && o.maxScore !== null && o.minScore > o.maxScore) fail("FILTER", "Minimum score must not exceed maximum score.");
    if (!Number.isInteger(o.limit) || o.limit < 0 || o.limit > 1e5) fail("FILTER", "Item limit must be a whole number from 0 to 100000.");
    if (o.interval < 1500 || o.interval > 36e5 || o.deleteDelay < 0 || o.deleteDelay > 864e5) fail("FILTER", "Interval must be 1500\u20133600000 ms; deletion delay 0\u201386400000 ms.");
    if (typeof o.replacement !== "string" || !o.replacement.trim() || o.replacement.length > 1e4) fail("FILTER", "Replacement must contain 1\u201310000 characters.");
    if (o.regex.length > 300) fail("FILTER", "Regex is limited to 300 characters.");
    try {
      if (o.regex) new RegExp(o.regex, "iu");
    } catch {
      fail("FILTER", "Invalid regular expression.");
    }
    return o;
  }
  var fingerprint = (options) => JSON.stringify(options);
  function makeMatcher(o) {
    const regex = o.regex ? new RegExp(o.regex, "iu") : null;
    return (item) => (o.type === "all" || o.type === item.type) && (!o.include.length || o.include.includes(item.subreddit.toLowerCase())) && !o.exclude.includes(item.subreddit.toLowerCase()) && (o.after === null || item.created >= o.after) && (o.before === null || item.created <= o.before) && item.text.toLowerCase().includes(o.contains.toLowerCase()) && (!regex || regex.test(item.text)) && (o.minScore === null || Number.isFinite(item.score) && item.score >= o.minScore) && (o.maxScore === null || Number.isFinite(item.score) && item.score <= o.maxScore) && (o.edited === "all" || typeof item.edited === "boolean" && item.edited === (o.edited === "yes"));
  }
  function eligibility(item, account, mode) {
    if (!account?.id || typeof account?.name !== "string" || typeof item?.author !== "string" || item.authorId !== account.id || item.author.toLowerCase() !== account.name.toLowerCase()) return "Ownership could not be verified";
    if (!/^t[13]_[a-z0-9]+$/.test(item.id)) return "Invalid content ID";
    if (item.deleted) return "Already deleted";
    if (mode !== "delete" && !item.editable) return "Content cannot be edited; no deletion fallback";
    return "";
  }

  // src/engine.js
  var Engine = class {
    constructor({ adapter, scheduler, checkpoints, now = Date.now, sleeper = sleep, onEvent = () => {
    } }) {
      Object.assign(this, { adapter, scheduler, checkpoints, now, sleeper, onEvent });
      this.preview = null;
      this.revision = 0;
      this.running = false;
      this.confirmation = null;
    }
    invalidate() {
      this.revision++;
      this.confirmation = null;
      this.preview = null;
    }
    async read(task, signal) {
      return this.scheduler.request(task, { signal });
    }
    async account(expected, signal) {
      const current = await this.read(() => this.adapter.account(), signal);
      if (typeof current?.id !== "string" || !current.id || typeof current?.name !== "string" || !current.name) fail("AUTH", "Account identity unavailable.");
      if (expected && (expected.id !== current.id || expected.name !== current.name)) fail("ACCOUNT_CHANGED", "Account changed. Scan again.");
      return current;
    }
    async scan(raw, signal) {
      if (this.running) fail("BUSY", "Another operation is running.");
      this.invalidate();
      const revision = this.revision;
      const options = normalizeOptions(raw);
      const matches = makeMatcher(options);
      this.scheduler.interval = options.interval;
      this.running = true;
      try {
        const account = await this.account(null, signal);
        const items = [], ids = /* @__PURE__ */ new Set(), cursors = /* @__PURE__ */ new Set();
        let after = null, inspected = 0, pages = 0, reason = "Listing exhausted; older history may still be missing";
        outer: do {
          checkAbort(signal);
          const page = await this.read(() => this.adapter.page({ account, after, type: options.type }), signal);
          if (!Array.isArray(page?.items)) fail("RESPONSE", "Invalid listing response.");
          pages++;
          for (const item of page.items) {
            inspected++;
            if (!item || !/^t[13]_[a-z0-9]+$/.test(item.id) || ids.has(item.id)) continue;
            ids.add(item.id);
            if (typeof item.text !== "string" || typeof item.subreddit !== "string" || typeof item.author !== "string" || !Number.isFinite(item.created)) continue;
            if (!matches(item)) continue;
            const skip = eligibility(item, account, options.mode);
            items.push({ ...item, skip, selected: !skip });
            if (options.limit && items.length >= options.limit) {
              reason = "Item limit reached; scan is partial";
              break outer;
            }
          }
          this.onEvent({ type: "scan", inspected, unique: ids.size, matched: items.length });
          after = page.after;
          if (after && cursors.has(after)) {
            reason = "Repeated pagination cursor; scan is partial";
            break;
          }
          if (after) cursors.add(after);
          if (pages >= 1e3) {
            reason = "Page safety limit reached; scan is partial";
            break;
          }
        } while (after);
        await this.account(account, signal);
        if (this.revision !== revision) fail("STALE", "Settings changed during scan. Scan again.");
        this.preview = { account, options, key: fingerprint(options), created: this.now(), revision, items, reason, completeHistory: false, stats: { inspected, unique: ids.size, matched: items.length, eligible: items.filter((i) => !i.skip).length } };
        return this.preview;
      } finally {
        this.running = false;
      }
    }
    select(id, selected) {
      if (this.running) fail("BUSY", "Selection is locked during an operation.");
      const item = this.preview?.items.find((i) => i.id === id);
      if (item && !item.skip) {
        item.selected = Boolean(selected);
        this.confirmation = null;
      }
    }
    validate(raw) {
      const preview = this.preview;
      if (!preview || preview.revision !== this.revision || this.now() - preview.created > 3e5 || fingerprint(normalizeOptions(raw)) !== preview.key) fail("STALE", "Preview expired or settings changed. Scan again.");
      if (!preview.items.some((i) => i.selected && !i.skip)) fail("EMPTY", "Select at least one eligible item.");
      return preview;
    }
    confirmationFor(raw) {
      const preview = this.validate(raw);
      const ids = preview.items.filter((i) => i.selected && !i.skip).map((i) => i.id);
      this.confirmation = { revision: preview.revision, ids: JSON.stringify(ids), key: preview.key, created: this.now() };
      return { count: ids.length, phrase: ids.length > 100 ? preview.options.mode === "anonymize" ? "ANONYMIZE" : "DELETE" : "", simulation: this.adapter.simulation };
    }
    cancelConfirmation() {
      this.confirmation = null;
    }
    async execute(raw, { confirmed = false, phrase = "", signal } = {}) {
      if (this.running) fail("BUSY", "Another operation is running.");
      const preview = this.validate(raw);
      const selected = preview.items.filter((i) => i.selected && !i.skip);
      const confirmation = this.confirmation;
      this.confirmation = null;
      if (!confirmed || !confirmation || confirmation.key !== preview.key || confirmation.revision !== preview.revision || confirmation.ids !== JSON.stringify(selected.map((i) => i.id)) || this.now() - confirmation.created > 6e4) fail("CONFIRM", "Explicit current confirmation required.");
      const required = selected.length > 100 ? preview.options.mode === "anonymize" ? "ANONYMIZE" : "DELETE" : "";
      if (phrase !== required) fail("CONFIRM", "Confirmation phrase does not match.");
      this.running = true;
      const run = { simulation: this.adapter.simulation, mode: preview.options.mode, options: preview.options, started: this.now(), finished: this.now(), stopped: false, records: [] };
      const emit = () => {
        this.checkpoints?.save(run.records, run.simulation);
        this.onEvent({ type: "progress", records: structuredClone(run.records), total: selected.length, elapsed: this.now() - run.started });
      };
      try {
        for (const item of selected) {
          checkAbort(signal);
          const record = { id: item.id, state: "pending" };
          run.records.push(record);
          const state = (value, code) => {
            record.state = value;
            record.code = code;
            emit();
          };
          let writeSubmitted = false;
          try {
            await this.account(preview.account, signal);
            let current = await this.read(() => this.adapter.get(item.id), signal);
            const skip = current && eligibility(current, preview.account, run.mode);
            if (!current || skip) {
              state("skipped", "INELIGIBLE");
              continue;
            }
            const write = async (task) => {
              await this.account(preview.account, signal);
              current = await this.read(() => this.adapter.get(item.id), signal);
              if (!current || eligibility(current, preview.account, run.mode)) fail("OWNERSHIP", "Ownership or capability changed.");
              return this.scheduler.request(async () => {
                checkAbort(signal);
                if (this.preview !== preview || this.revision !== preview.revision) fail("STALE", "Preview invalidated.");
                writeSubmitted = true;
                return task(preview.account);
              }, { signal, write: true });
            };
            if (run.mode !== "delete") {
              if (current.text !== preview.options.replacement) {
                state("editing");
                await write((expected) => this.adapter.edit(item.id, preview.options.replacement, expected));
              }
              const verified = await this.read(() => this.adapter.get(item.id), signal);
              if (!verified || verified.text !== preview.options.replacement) {
                state("uncertain", "EDIT_UNVERIFIED");
                continue;
              }
              state("anonymized");
              item.text = preview.options.replacement;
              if (run.mode === "combined") {
                state("waiting");
                const until = this.now() + preview.options.deleteDelay;
                while (this.now() < until) {
                  await this.scheduler.gate(signal);
                  await this.sleeper(Math.min(250, until - this.now()), signal);
                }
                const again = await this.read(() => this.adapter.get(item.id), signal);
                if (!again || again.text !== preview.options.replacement) {
                  state("uncertain", "EDIT_CHANGED");
                  continue;
                }
              }
            }
            if (run.mode !== "anonymize") {
              await write((expected) => this.adapter.delete(item.id, expected, run.mode === "combined" ? preview.options.replacement : void 0));
              const verified = await this.read(() => this.adapter.get(item.id), signal);
              if (!verified?.deleted) {
                state("uncertain", "DELETE_UNVERIFIED");
                continue;
              }
              state("deleted");
              item.text = "";
            }
          } catch (error) {
            const ambiguous = writeSubmitted && !(error.status >= 400 && error.status < 500) && !["ACCOUNT_CHANGED", "OWNERSHIP", "PERMISSION"].includes(error.code);
            state(error.code === "UNCERTAIN" || ambiguous ? "uncertain" : "failed", error.code || "API");
            if (["STOPPED", "ACCOUNT_CHANGED", "AUTH", "PERMISSION", "OWNERSHIP", "STALE"].includes(error.code) || error.fatal) {
              run.stopped = true;
              break;
            }
          }
        }
      } catch (error) {
        if (error.code !== "STOPPED") throw error;
        run.stopped = true;
      } finally {
        run.finished = this.now();
        this.running = false;
        this.invalidate();
        this.onEvent({ type: "done", run });
      }
      return run;
    }
  };

  // src/scheduler.js
  var Scheduler = class {
    constructor({ interval = 1500, now = Date.now, sleeper = sleep, onWait = () => {
    } } = {}) {
      this.interval = interval;
      this.now = now;
      this.sleeper = sleeper;
      this.onWait = onWait;
      this.next = 0;
      this.paused = false;
      this.tail = Promise.resolve();
      this.stats = { requests: 0, retries: 0, throttles: 0, waitedMs: 0 };
    }
    pause() {
      this.paused = true;
    }
    resume() {
      this.paused = false;
    }
    observe(headers) {
      if (!headers?.get) return;
      const remaining = headers.get("x-ratelimit-remaining");
      const reset = Number(headers.get("x-ratelimit-reset"));
      if (remaining !== null && Number(remaining) <= 1 && Number.isFinite(reset) && reset > 0) {
        this.next = Math.max(this.next, this.now() + reset * 1e3);
      }
      const retry = headers.get("retry-after");
      if (retry) {
        const seconds = Number(retry);
        const until = Number.isFinite(seconds) ? this.now() + seconds * 1e3 : Date.parse(retry);
        if (Number.isFinite(until)) this.next = Math.max(this.next, until);
      }
    }
    async gate(signal) {
      for (; ; ) {
        checkAbort(signal);
        const remaining = this.next - this.now();
        if (!this.paused && remaining <= 0) return;
        const ms = this.paused ? 100 : Math.min(remaining, 250);
        this.onWait({ reason: this.paused ? "Paused" : "Request interval or server cooldown", remaining: Math.max(0, remaining) });
        await this.sleeper(ms, signal);
        this.stats.waitedMs += ms;
      }
    }
    request(task, { signal, write = false } = {}) {
      const run = async () => {
        for (let attempt = 0; ; attempt++) {
          await this.gate(signal);
          checkAbort(signal);
          this.stats.requests++;
          try {
            const result2 = await task();
            this.observe(result2?.headers);
            return result2?.data ?? result2;
          } catch (error) {
            this.observe(error.headers);
            if (Number.isFinite(error.retryAfterMs) && error.retryAfterMs > 0) this.next = Math.max(this.next, this.now() + error.retryAfterMs);
            const status = error.status;
            if (error.code && !["NETWORK", "TIMEOUT", "RATELIMIT"].includes(error.code) && !status) throw error;
            if (status === 401 || status === 403) throw new AppError(status === 401 ? "AUTH" : "PERMISSION", "Authorization or permission refused.", { fatal: true });
            const throttle = status === 429 || error.code === "RATELIMIT";
            if (throttle) this.stats.throttles++;
            const transient = !status || status >= 500;
            if (write && !throttle && transient) throw new AppError("UNCERTAIN", "Write outcome unknown. Verify current state before trying again.");
            if (attempt >= 3 || !throttle && !transient) throw error;
            this.stats.retries++;
            this.next = Math.max(this.next, this.now() + (throttle ? 6e4 : 1e3 * 2 ** attempt));
          } finally {
            this.next = Math.max(this.next, this.now() + this.interval);
          }
        }
      };
      const result = this.tail.then(run);
      this.tail = result.catch(() => {
      });
      return result;
    }
  };

  // src/adapters/blocked.js
  var BlockedAdapter = class {
    simulation = false;
    label = "Live Reddit integration unavailable";
    async account() {
      fail("LIVE_UNAVAILABLE", "Reddit approval and a verified public-client OAuth integration are required. This build cannot read or modify your Reddit account.");
    }
    async page() {
      return this.account();
    }
    async get() {
      return this.account();
    }
    async edit() {
      return this.account();
    }
    async delete() {
      return this.account();
    }
  };

  // src/adapters/simulation.js
  var SimulationAdapter = class {
    simulation = true;
    label = "Simulation \xB7 synthetic data only";
    identity = { id: "t2_demo", name: "demo_user" };
    constructor(items = sampleItems()) {
      this.items = structuredClone(items);
    }
    async account() {
      return { ...this.identity };
    }
    async page({ after }) {
      const offset = after ? Number(after) : 0;
      return { items: structuredClone(this.items.slice(offset, offset + 25)), after: offset + 25 < this.items.length ? String(offset + 25) : null };
    }
    async get(id) {
      return structuredClone(this.items.find((item) => item.id === id));
    }
    guard(id, expected, mode) {
      const item = this.items.find((item2) => item2.id === id);
      if (!expected || expected.id !== this.identity.id || expected.name !== this.identity.name) fail("ACCOUNT_CHANGED", "Account changed.");
      if (!item || eligibility(item, expected, mode)) fail("OWNERSHIP", "Ownership or capability changed.");
      return item;
    }
    async edit(id, text, expected) {
      const item = this.guard(id, expected, "anonymize");
      item.text = text;
      item.edited = true;
      return { acknowledged: true };
    }
    async delete(id, expected, verifiedReplacement) {
      const item = this.guard(id, expected, "delete");
      if (verifiedReplacement !== void 0 && item.text !== verifiedReplacement) fail("EDIT_CHANGED", "Replacement changed before deletion.");
      item.deleted = true;
      item.text = "";
      return { acknowledged: true };
    }
  };
  function sampleItems() {
    return Array.from({ length: 12 }, (_, i) => ({
      id: `${i % 3 ? "t1" : "t3"}_demo${i}`,
      authorId: "t2_demo",
      author: "demo_user",
      subreddit: ["privacy", "technology", "casualconversation"][i % 3],
      type: i % 3 ? "comment" : "post",
      created: Date.UTC(2025, i, 5, 12),
      score: i * 3 - 5,
      edited: i % 2 === 0,
      editable: i !== 6,
      deleted: false,
      text: [
        "I used to share too much about my daily routine. Time for a fresh start.",
        "Small privacy habits make a difference. This is a synthetic example comment.",
        "An old conversation, a new perspective. No real Reddit content is loaded."
      ][i % 3],
      permalink: ""
    }));
  }

  // src/checkpoint.js
  var KEY = "wipeditt.checkpoint.v1";
  var STATES = /* @__PURE__ */ new Set(["pending", "editing", "anonymized", "waiting", "deleted", "skipped", "failed", "uncertain"]);
  var Checkpoints = class {
    constructor(storage, now = Date.now) {
      this.storage = storage;
      this.now = now;
    }
    save(records, simulation) {
      const data = { expires: this.now() + 864e5, simulation, records: records.slice(-1e5).map(({ id, state }) => ({ id, state })) };
      try {
        this.storage?.setItem(KEY, JSON.stringify(data));
      } catch {
        return false;
      }
      return true;
    }
    load() {
      try {
        const data = JSON.parse(this.storage?.getItem(KEY) || "null");
        if (!data || data.expires < this.now() || !Array.isArray(data.records) || data.records.length > 1e5) {
          this.clear();
          return null;
        }
        data.records = data.records.filter((r) => /^t[13]_[a-z0-9]+$/.test(r.id) && STATES.has(r.state)).map((r) => ({ ...r, state: ["editing", "waiting", "pending"].includes(r.state) ? "uncertain" : r.state }));
        return data;
      } catch {
        this.clear();
        return null;
      }
    }
    clear() {
      try {
        this.storage?.removeItem(KEY);
      } catch {
      }
    }
  };

  // src/report.js
  function makeReport(run, version, rateStats) {
    const counts = {};
    for (const record of run.records) counts[record.state] = (counts[record.state] || 0) + 1;
    return {
      application: "Wipeditt",
      version,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      simulation: run.simulation,
      operation: run.mode,
      stopped: run.stopped,
      elapsedMs: Math.max(0, run.finished - run.started),
      filters: { type: run.options.type, limit: run.options.limit, hasSubredditFilter: !!(run.options.include.length || run.options.exclude.length), hasTextFilter: !!(run.options.contains || run.options.regex), hasDateFilter: run.options.after !== null || run.options.before !== null, hasScoreFilter: run.options.minScore !== null || run.options.maxScore !== null, edited: run.options.edited },
      counts,
      issues: run.records.filter((r) => ["failed", "skipped", "uncertain"].includes(r.state)).map(({ id, state, code }) => ({ id, state, category: code || "UNAVAILABLE" })),
      rateLimit: { ...rateStats }
    };
  }

  // src/ui/panel.js
  function mount(root, version) {
    const fields = {};
    let engine, controller, lastReport, dialog, simulation = false, busy = false;
    let storage;
    try {
      storage = sessionStorage;
    } catch {
    }
    const checkpoints = new Checkpoints(storage);
    const notice = el("p", { class: "notice", role: "status", text: "Live integration unavailable \xB7 Reddit approval and verified OAuth required. Your Reddit account is not connected." });
    const status = el("p", { class: "status", role: "status", "aria-live": "polite", text: "Choose settings, scan, then review before changing content." });
    const results = el("div", { class: "results", "aria-label": "Scan results" });
    const counters = el("p", { class: "counts", text: "Inspected 0 \xB7 Unique 0 \xB7 Matching 0 \xB7 Eligible 0 \xB7 Selected 0" });
    const activity = el("ol", { class: "activity" });
    const progress = el("progress", { max: 1, value: 0, "aria-label": "Operation progress" });
    const log = (message) => {
      activity.prepend(el("li", { text: message }));
      while (activity.children.length > 30) activity.lastChild.remove();
    };
    function cancelDialog() {
      engine.cancelConfirmation();
      dialog?.close();
      dialog?.remove();
      dialog = null;
    }
    function invalidate() {
      cancelDialog();
      engine.invalidate();
      results.replaceChildren();
      review.disabled = true;
      status.textContent = "Settings changed. Scan again for a current preview.";
    }
    function field(name, title, { type = "text", value = "", choices, hint, ...attrs } = {}) {
      const input = choices ? el("select", { id: name, ...attrs }, choices.map(([value2, text]) => el("option", { value: value2, text }))) : type === "textarea" ? el("textarea", { id: name, rows: 3, value, ...attrs }) : el("input", { id: name, type, value, ...attrs });
      if (choices && value) input.value = value;
      fields[name] = input;
      if (["include", "exclude", "contains", "regex", "replacement"].includes(name)) input.classList.add("sensitive");
      input.addEventListener("input", invalidate);
      return el("label", { class: "field", htmlFor: name }, el("span", { text: title }), input, hint ? el("small", { text: hint }) : null);
    }
    const options = () => Object.fromEntries(Object.entries(fields).map(([key, input]) => [key, input.value]));
    const button = (text, fn, className = "") => {
      const b = el("button", { type: "button", text, onClick: fn, class: className });
      return b;
    };
    function setBusy(value) {
      busy = value;
      for (const input of Object.values(fields)) input.disabled = value;
      for (const input of panel.querySelectorAll("fieldset button, fieldset select")) input.disabled = value;
      scan.disabled = value;
      demo.disabled = value;
      review.disabled = value || !engine.preview;
      pause.disabled = !value;
      stop.disabled = !value;
      for (const input of results.querySelectorAll("input, button")) input.disabled = value || input.dataset.ineligible === "true";
    }
    function connect(adapter) {
      engine = new Engine({ adapter, checkpoints, scheduler: new Scheduler({ onWait: (wait) => {
        status.textContent = `${wait.reason}${wait.remaining ? ` \xB7 ${(wait.remaining / 1e3).toFixed(1)}s` : ""}`;
      } }), onEvent: (event) => {
        if (event.type === "scan") status.textContent = `Scanning \xB7 ${event.inspected} inspected \xB7 ${event.matched} matching`;
        if (event.type === "progress") {
          progress.max = event.total;
          progress.value = event.records.filter((r) => ["anonymized", "deleted", "skipped", "failed", "uncertain"].includes(r.state)).length;
          const counts = {};
          for (const record of event.records) counts[record.state] = (counts[record.state] || 0) + 1;
          status.textContent = `${simulation ? "SIMULATION \xB7 " : ""}${event.records.length}/${event.total} scheduled \xB7 ${Object.entries(counts).map(([key, n]) => `${key}: ${n}`).join(" \xB7 ")} \xB7 Elapsed ${Math.round(event.elapsed / 1e3)}s`;
          log(`${event.records.at(-1)?.id}: ${event.records.at(-1)?.state}`);
        }
      } });
    }
    function selectedCount() {
      const p = engine.preview;
      if (!p) return;
      const selected = p.items.filter((i) => i.selected && !i.skip).length;
      counters.textContent = `Inspected ${p.stats.inspected} \xB7 Unique ${p.stats.unique} \xB7 Matching ${p.stats.matched} \xB7 Eligible ${p.stats.eligible} \xB7 Selected ${selected}`;
      review.disabled = busy || !selected;
    }
    function renderPreview(preview) {
      results.replaceChildren();
      const subreddits = [...new Set(preview.items.map((i) => i.subreddit))];
      const groups = el("div", { class: "groups" }, subreddits.map((name) => button(`Toggle r/${name}`, () => {
        cancelDialog();
        const items = preview.items.filter((i) => i.subreddit === name && !i.skip);
        const selected = !items.every((i) => i.selected);
        for (const item of items) engine.select(item.id, selected);
        renderPreview(preview);
      }, "sensitive")));
      results.append(groups);
      for (const item of preview.items) {
        const check = el("input", { type: "checkbox", checked: item.selected, disabled: !!item.skip, "aria-label": `Select ${item.id}` });
        check.dataset.ineligible = String(!!item.skip);
        check.addEventListener("change", () => {
          cancelDialog();
          engine.select(item.id, check.checked);
          selectedCount();
        });
        const link = safeLink(item.permalink);
        const row = el(
          "article",
          { class: "item" },
          el("div", { class: "item-head" }, check, el("strong", { class: "sensitive", text: `r/${item.subreddit}` }), el("span", { text: `${item.type} \xB7 ${new Date(item.created).toLocaleDateString("en-US")} \xB7 Score ${item.score ?? "unknown"}` }), link && item.permalink ? el("a", { href: link, target: "_blank", rel: "noopener noreferrer", text: "Original" }) : null),
          el("p", { class: "original sensitive", text: item.text }),
          preview.options.mode !== "delete" ? el("p", { class: "replacement sensitive", text: `Replace with: ${preview.options.replacement}` }) : null,
          el("small", { class: item.skip ? "warning" : "eligible", text: item.skip || "Eligible \xB7 ownership verified in simulation" })
        );
        results.append(row);
      }
      if (!preview.items.length) results.append(el("p", { text: "No items match these filters." }));
      status.textContent = `${simulation ? "SIMULATION \xB7 " : ""}${preview.reason}. Review every selected item.`;
      selectedCount();
    }
    async function performScan() {
      controller = new AbortController();
      engine.scheduler.resume();
      pause.textContent = "Pause";
      setBusy(true);
      lastReport = null;
      progress.value = 0;
      progress.max = 1;
      report.disabled = true;
      try {
        const preview = await engine.scan(options(), controller.signal);
        renderPreview(preview);
        log(`Scan: ${preview.stats.matched} matching items. ${preview.reason}.`);
      } catch (error) {
        status.textContent = error.message;
        log(error.code || "Scan failed");
      } finally {
        setBusy(false);
      }
    }
    async function execute(phrase) {
      dialog.close();
      dialog.remove();
      dialog = null;
      controller = new AbortController();
      engine.scheduler.resume();
      pause.textContent = "Pause";
      setBusy(true);
      try {
        const run = await engine.execute(options(), { confirmed: true, phrase, signal: controller.signal });
        lastReport = makeReport(run, version, engine.scheduler.stats);
        report.disabled = false;
        status.textContent = `${simulation ? "SIMULATION \xB7 No Reddit content changed. " : ""}${run.stopped ? "Stopped" : "Finished"} \xB7 ${JSON.stringify(lastReport.counts)}`;
        results.replaceChildren();
      } catch (error) {
        status.textContent = error.message;
      } finally {
        setBusy(false);
        review.disabled = true;
      }
    }
    function confirm() {
      try {
        const info = engine.confirmationFor(options());
        const phrase = el("input", { type: "text", autocomplete: "off", "aria-label": "Confirmation phrase" });
        const accept = el("button", { type: "button", text: simulation ? "Run simulation" : "Confirm operation", disabled: !!info.phrase, onClick: () => execute(phrase.value) });
        phrase.addEventListener("input", () => {
          accept.disabled = phrase.value !== info.phrase;
        });
        const cancel = el("button", { type: "button", text: "Cancel", onClick: cancelDialog });
        dialog = el(
          "dialog",
          { "aria-labelledby": "confirmation-title" },
          el("h2", { id: "confirmation-title", text: "Review your operation" }),
          el("p", { text: `${simulation ? "Simulation only. " : ""}${fields.mode.selectedOptions[0].textContent}: ${info.count} selected items.` }),
          el("p", { text: "Edits can be permanent. Copies in archives, caches and moderation records may remain. Stop prevents new requests; submitted requests may finish." }),
          fields.mode.value !== "delete" ? el("pre", { class: "sensitive", text: fields.replacement.value }) : null,
          info.phrase ? el("label", { text: `Type ${info.phrase} to continue` }, phrase) : null,
          el("div", { class: "actions" }, cancel, accept)
        );
        dialog.addEventListener("cancel", (event) => {
          event.preventDefault();
          cancelDialog();
        });
        root.append(dialog);
        dialog.showModal();
        cancel.focus();
      } catch (error) {
        status.textContent = error.message;
      }
    }
    const scan = button("Scan content", performScan, "primary");
    const review = button("Review operation", confirm, "primary");
    review.disabled = true;
    const pause = button("Pause", () => {
      if (engine.scheduler.paused) {
        engine.scheduler.resume();
        pause.textContent = "Pause";
      } else {
        engine.scheduler.pause();
        pause.textContent = "Resume";
      }
    });
    pause.disabled = true;
    const stop = button("Stop", () => {
      controller?.abort();
      engine.scheduler.resume();
      status.textContent = "Stopping. Submitted requests may still finish.";
    });
    stop.disabled = true;
    const demo = button("Try synthetic data", () => {
      invalidate();
      simulation = !simulation;
      connect(simulation ? new SimulationAdapter() : new BlockedAdapter());
      notice.textContent = simulation ? "SIMULATION \xB7 Synthetic content. No Reddit connection. No real content will be changed." : "Live integration unavailable \xB7 Reddit approval and verified OAuth required.";
      demo.textContent = simulation ? "Leave simulation" : "Try synthetic data";
      status.textContent = simulation ? "Simulation account: demo_user. Scan to review synthetic content." : "Live integration unavailable.";
    });
    const report = button("Export report", () => {
      if (!lastReport) return;
      const url = URL.createObjectURL(new Blob([JSON.stringify(lastReport, null, 2)], { type: "application/json" }));
      const link = el("a", { href: url, download: `wipeditt-${version}-report.json` });
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1e3);
    });
    report.disabled = true;
    const panel = el("section", { class: "panel", "aria-label": "Wipeditt privacy utility" });
    const theme = button("Light mode", () => {
      const light = panel.classList.toggle("light");
      theme.textContent = light ? "Dark mode" : "Light mode";
    });
    const privacy = el("input", { type: "checkbox", onChange: (event) => panel.classList.toggle("private", event.target.checked) });
    const hide = button("Close", () => {
      cancelDialog();
      controller?.abort();
      engine.scheduler.resume();
      panel.hidden = true;
      launcher.focus();
    });
    const launcher = el("button", { class: "launcher", type: "button", text: "Wipeditt", "aria-label": "Open Wipeditt", onClick: () => {
      if (!panel.hidden) hide.click();
      else {
        panel.hidden = false;
        hide.focus();
      }
    } });
    root.append(el("style", { text: styles_default }), launcher, panel);
    panel.append(
      el("header", {}, el("div", {}, el("h1", { text: "Wipeditt" }), el("p", { text: "Your Reddit history. Your control." })), el("div", { class: "actions" }, theme, hide)),
      notice,
      el("div", { class: "connection" }, demo, el("label", {}, privacy, " Privacy mode")),
      el(
        "details",
        { class: "scope", open: true },
        el("summary", { text: "Scope & filters" }),
        el(
          "fieldset",
          {},
          el("legend", { text: "Target" }),
          el(
            "div",
            { class: "grid" },
            field("type", "Content", { choices: [["all", "All supported content"], ["comment", "Comments"], ["post", "Text posts"]] }),
            field("limit", "Item limit", { type: "number", value: "100", min: 0, max: 1e5, hint: "0 = all available; history may be incomplete" }),
            field("include", "Include subreddits", { placeholder: "privacy, technology" }),
            field("exclude", "Exclude subreddits", { placeholder: "Leave empty for none" }),
            field("contains", "Text contains")
          ),
          el("div", { class: "actions" }, [50, 100, 500, 0].map((n) => button(n ? String(n) : "All available", () => {
            fields.limit.value = n;
            invalidate();
          })))
        ),
        el("details", { class: "extra-filters" }, el("summary", { text: "Dates, pattern & score" }), el(
          "div",
          { class: "grid" },
          field("after", "From (inclusive)", { type: "datetime-local" }),
          field("before", "Until (inclusive)", { type: "datetime-local" }),
          field("regex", "Regular expression", { maxLength: 300 }),
          field("minScore", "Minimum score", { type: "number" }),
          field("maxScore", "Maximum score", { type: "number" }),
          field("edited", "Edited status", { choices: [["all", "Any"], ["yes", "Edited"], ["no", "Unedited"]] })
        ))
      ),
      el(
        "fieldset",
        {},
        el("legend", { text: "Operation" }),
        field("mode", "Operation mode", { choices: [["anonymize", "Anonymize"], ["delete", "Delete \xB7 simulation only"], ["combined", "Anonymize & Delete \xB7 simulation only"]] }),
        el("label", { class: "field" }, el("span", { text: "Replacement preset" }), el("select", { "aria-label": "Replacement preset", onChange: (event) => {
          if (event.target.value !== "custom") fields.replacement.value = event.target.value;
          invalidate();
        } }, [DEFAULT_REPLACEMENT, "[Deleted for privacy]", "[Content removed]", "custom"].map((value) => el("option", { value, text: value === "custom" ? "Custom text" : value })))),
        field("replacement", "Exact replacement text", { type: "textarea", value: DEFAULT_REPLACEMENT, maxLength: 1e4 }),
        el("p", { class: "muted", text: "Replaces comment or editable text-post bodies. Titles and media cannot be anonymized. Does not erase external copies." })
      ),
      el(
        "details",
        {},
        el("summary", { text: "Advanced scheduling" }),
        field("interval", "Minimum request interval (ms)", { type: "number", value: "1500", min: 1500, max: 36e5, hint: "Automatic server cooldowns always take precedence." }),
        field("deleteDelay", "Combined-mode deletion delay (ms)", { type: "number", value: "0", min: 0, max: 864e5, hint: "0 = immediately after verification. Requires this tab to remain active." })
      ),
      el("div", { class: "actions" }, scan, review, pause, stop),
      counters,
      status,
      progress,
      results,
      el("details", {}, el("summary", { text: "Activity" }), activity),
      el("footer", {}, report, button("Clear checkpoint", () => {
        checkpoints.clear();
        log("Local checkpoint cleared.");
      }), el("small", { text: `v${version} \xB7 Rafael (rafaelolv) \xB7 Local only` }))
    );
    connect(new BlockedAdapter());
    const previous = checkpoints.load();
    if (previous) log(`Interrupted checkpoint: ${previous.records.length} item states. No automatic replay. Rescan and verify before any new run.`);
    panel.hidden = true;
    root.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !dialog) hide.click();
    });
    return { panel, engine: () => engine };
  }

  // src/index.js
  var ID = "wipeditt-runtime-v1";
  if (window.top === window.self && !document.getElementById(ID)) {
    const host = document.createElement("div");
    host.id = ID;
    host.style.cssText = "position:fixed;z-index:2147483646;inset:0;pointer-events:none";
    const shadow = host.attachShadow({ mode: "open" });
    const container = document.createElement("div");
    container.style.pointerEvents = "auto";
    shadow.append(container);
    document.documentElement.append(host);
    mount(container, "0.1.0");
  }
})();
