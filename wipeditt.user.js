// ==UserScript==
// @name         Wipeditt
// @namespace    https://github.com/rafelolv/Wipeditt
// @version      0.2.0
// @description  Review and anonymize your own Reddit history with local OAuth authentication
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
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @connect      oauth.reddit.com
// @connect      www.reddit.com
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

  // src/network.js
  var RESPONSE_HEADERS = ["retry-after", "x-ratelimit-remaining", "x-ratelimit-reset", "x-ratelimit-used"];
  function validateRequest(request) {
    const url = new URL(request.url);
    const method = request.method || "GET";
    const apiRead = /^\/(api\/v1\/me|api\/info|user\/[A-Za-z0-9_-]+\/(comments|submitted|overview))$/.test(url.pathname);
    const apiWrite = ["/api/editusertext", "/api/del"].includes(url.pathname);
    const token = url.origin === "https://www.reddit.com" && url.pathname === "/api/v1/access_token" && method === "POST";
    if (url.username || url.password || url.hash || !(token || url.origin === "https://oauth.reddit.com" && (apiRead && method === "GET" || apiWrite && method === "POST"))) fail("NETWORK_SCOPE", "Request is outside the Reddit integration.");
    if (url.searchParams.has("access_token") || url.searchParams.has("code")) fail("NETWORK_SCOPE", "Credentials must not appear in request URLs.");
    if (typeof request.body !== "undefined" && (typeof request.body !== "string" || request.body.length > 1e5)) fail("NETWORK_SCOPE", "Invalid request body.");
    const headers = request.headers || {};
    for (const name of Object.keys(headers)) if (!["authorization", "content-type", "user-agent"].includes(name.toLowerCase())) fail("NETWORK_SCOPE", "Unexpected request header.");
    const authorization = Object.entries(headers).find(([key]) => key.toLowerCase() === "authorization")?.[1];
    if (typeof authorization !== "string" || !(token ? /^Basic [A-Za-z0-9+/=]+$/ : /^Bearer [^\s]+$/).test(authorization)) fail("AUTH", "Reddit authorization is missing.");
    return { url: url.href, method, body: request.body, headers };
  }
  async function browserRequest(input, { signal, fetcher = globalThis.fetch } = {}) {
    const request = validateRequest(input);
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), 3e4);
    const combined = signal ? AbortSignal.any([signal, timeout.signal]) : timeout.signal;
    try {
      checkAbort(signal);
      const response = await fetcher(request.url, { method: request.method, headers: request.headers, body: request.body, credentials: "omit", redirect: "error", referrerPolicy: "no-referrer", cache: "no-store", signal: combined });
      const text = await response.text();
      if (text.length > 2e7) fail("RESPONSE", "Reddit response is too large.");
      return { status: response.status, text, headers: Object.fromEntries(RESPONSE_HEADERS.map((key) => [key, response.headers.get(key)]).filter(([, value]) => value !== null)) };
    } catch (error) {
      if (error instanceof AppError) throw error;
      checkAbort(signal);
      throw new AppError(timeout.signal.aborted ? "TIMEOUT" : "NETWORK", "Reddit request failed. Check your connection and try again.");
    } finally {
      clearTimeout(timer);
    }
  }
  function send(input, { signal } = {}) {
    const request = validateRequest(input);
    checkAbort(signal);
    if (typeof GM_xmlhttpRequest === "function") {
      return new Promise((resolve, reject) => {
        let handle;
        const finish = (error, data) => {
          signal?.removeEventListener("abort", abort);
          error ? reject(error) : resolve(data);
        };
        const abort = () => {
          handle?.abort();
          finish(new AppError("STOPPED", "Stopped."));
        };
        handle = GM_xmlhttpRequest({
          ...request,
          data: request.body,
          anonymous: true,
          redirect: "error",
          timeout: 3e4,
          onload: (response) => {
            const headers = {};
            for (const line of (response.responseHeaders || "").split(/\r?\n/)) {
              const split = line.indexOf(":");
              const key = line.slice(0, split).trim().toLowerCase();
              if (RESPONSE_HEADERS.includes(key)) headers[key] = line.slice(split + 1).trim();
            }
            finish(null, { status: response.status, text: response.responseText, headers });
          },
          onerror: () => finish(new AppError("NETWORK", "Reddit request failed. Check your connection.")),
          ontimeout: () => finish(new AppError("TIMEOUT", "Reddit did not respond in time.")),
          onabort: () => finish(new AppError("STOPPED", "Stopped."))
        });
        signal?.addEventListener("abort", abort, { once: true });
      });
    }
    const runtime = globalThis.browser?.runtime || globalThis.chrome?.runtime;
    if (runtime?.id) {
      const id = crypto.randomUUID();
      const abort = () => {
        runtime.sendMessage({ type: "wipeditt.abort", id }).catch(() => {
        });
      };
      signal?.addEventListener("abort", abort, { once: true });
      return runtime.sendMessage({ type: "wipeditt.request", id, request }).then((result) => {
        checkAbort(signal);
        if (result?.error) throw new AppError(result.error.code, result.error.message);
        if (!result || !Number.isInteger(result.status)) fail("NETWORK", "Extension could not contact Reddit.");
        return result;
      }).finally(() => signal?.removeEventListener("abort", abort));
    }
    return browserRequest(request, { signal });
  }

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
    async perform(task, { signal, write = false, before = [] } = {}) {
      for (let attempt = 0; ; attempt++) {
        for (const guard of before) await this.perform(guard, { signal });
        await this.gate(signal);
        checkAbort(signal);
        this.stats.requests++;
        try {
          const result = await task();
          this.observe(result?.headers);
          return result && typeof result === "object" && Object.hasOwn(result, "data") ? result.data : result;
        } catch (error) {
          this.observe(error.headers);
          if (Number.isFinite(error.retryAfterMs) && error.retryAfterMs > 0) this.next = Math.max(this.next, this.now() + error.retryAfterMs);
          const status = error.status;
          if (error.code && !["NETWORK", "TIMEOUT", "RATELIMIT"].includes(error.code) && !status) throw error;
          if (status === 401 || status === 403) throw new AppError(status === 401 ? "AUTH" : "PERMISSION", status === 401 ? "Reddit authorization expired or was refused. Reconnect your account." : "Reddit denied permission. Check your app access and account permissions.", { fatal: true });
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
    }
    request(task, options = {}) {
      const result = this.tail.then(() => this.perform(task, options));
      this.tail = result.catch(() => {
      });
      return result;
    }
  };

  // src/auth.js
  var REDIRECT_URI = "https://www.reddit.com/";
  var REQUIRED_SCOPES = ["identity", "history", "read", "edit"];
  function clientId(value) {
    const id = String(value || "").trim();
    if (!/^[A-Za-z0-9_-]{8,80}$/.test(id)) fail("CLIENT_ID", "Enter the public Client ID of a Reddit installed app.");
    return id;
  }
  function authorizationUrl(id, state) {
    const url = new URL("https://www.reddit.com/api/v1/authorize");
    url.search = new URLSearchParams({ client_id: clientId(id), response_type: "code", state, redirect_uri: REDIRECT_URI, duration: "temporary", scope: REQUIRED_SCOPES.join(" ") });
    return url.href;
  }
  function handleOAuthCallback(win = window) {
    const url = new URL(win.location.href);
    const state = url.searchParams.get("state") || "";
    const match = /^wipeditt\.(www|old)\.[a-f0-9]{64}$/.exec(state);
    if (!match || url.origin !== "https://www.reddit.com" || url.pathname !== "/") return false;
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");
    if (!code && !error) return false;
    for (const key of ["code", "state", "error", "error_description"]) url.searchParams.delete(key);
    win.history.replaceState(null, "", url.href);
    const message = { type: "wipeditt.oauth", state, code, error };
    win.opener?.postMessage(message, `https://${match[1]}.reddit.com`);
    if (match[1] === "www" && typeof win.BroadcastChannel === "function") {
      const channel = new win.BroadcastChannel("wipeditt.oauth.v1");
      channel.postMessage(message);
      channel.close();
    }
    win.close();
    return true;
  }
  var RedditAuth = class {
    #token = null;
    #expires = 0;
    #pending = null;
    constructor({ transport = send, now = Date.now, win = globalThis.window, scheduler = new Scheduler() } = {}) {
      Object.assign(this, { transport, now, win, scheduler });
    }
    token() {
      if (!this.#token || this.now() >= this.#expires) {
        this.#token = null;
        this.#expires = 0;
        fail("AUTH", "Your Reddit connection expired. Connect again to continue.");
      }
      return this.#token;
    }
    disconnect() {
      this.#token = null;
      this.#expires = 0;
      this.#pending?.();
    }
    async exchange(id, code, signal) {
      const response = await this.scheduler.request(async () => {
        const result = await this.transport({ url: "https://www.reddit.com/api/v1/access_token", method: "POST", headers: { Authorization: `Basic ${btoa(`${clientId(id)}:`)}`, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI }).toString() }, { signal });
        return { data: result, headers: new Headers(result.headers || {}) };
      }, { signal, write: true });
      checkAbort(signal);
      let data;
      try {
        data = JSON.parse(response.text);
      } catch {
        fail("AUTH", "Reddit did not return a valid authorization response.");
      }
      if (response.status !== 200 || data.error || typeof data.access_token !== "string" || data.token_type?.toLowerCase() !== "bearer") fail("AUTH", "Reddit refused this app or authorization code. Check the installed-app Client ID, redirect URI and Reddit API access.");
      const scopes = String(data.scope || "").split(/[\s,]+/);
      if (!REQUIRED_SCOPES.every((scope) => scopes.includes(scope))) fail("AUTH", "Reddit did not grant all required permissions. Connect again and approve identity, history, read and edit.");
      const seconds = Number(data.expires_in);
      if (!Number.isFinite(seconds) || seconds <= 0) fail("AUTH", "Reddit returned an expired authorization.");
      this.#token = data.access_token;
      this.#expires = this.now() + Math.min(seconds, 3600) * 1e3;
    }
    connect(id) {
      this.disconnect();
      const origin = new URL(this.win.location.href);
      const host = origin.hostname.split(".")[0];
      if (!["https://www.reddit.com", "https://old.reddit.com"].includes(origin.origin)) fail("AUTH", "Open Wipeditt on Reddit to connect your account.");
      const random = [...crypto.getRandomValues(new Uint8Array(32))].map((n) => n.toString(16).padStart(2, "0")).join("");
      const state = `wipeditt.${host}.${random}`;
      const popup = this.win.open(authorizationUrl(id, state), "_blank", "popup,width=620,height=760");
      if (!popup) fail("POPUP", "Allow the Reddit sign-in popup, then try again.");
      return new Promise((resolve, reject) => {
        const controller = new AbortController();
        let settled = false, exchanging = false;
        const channel = host === "www" && typeof this.win.BroadcastChannel === "function" ? new this.win.BroadcastChannel("wipeditt.oauth.v1") : null;
        const cleanup = () => {
          this.win.removeEventListener("message", receive);
          channel?.close();
          clearTimeout(timer);
          this.#pending = null;
        };
        const finish = (error) => {
          if (settled) return;
          settled = true;
          cleanup();
          popup.close();
          error ? reject(error) : resolve();
        };
        const accept = async (data) => {
          if (settled || exchanging) return;
          if (data.state !== state) return finish(new AppError("AUTH_STATE", "Reddit authorization could not be verified. Connect again."));
          if (data.error || typeof data.code !== "string" || !data.code) return finish(new AppError("AUTH_DENIED", "Reddit sign-in was canceled or refused."));
          exchanging = true;
          this.win.removeEventListener("message", receive);
          try {
            await this.exchange(id, data.code, controller.signal);
            finish();
          } catch (error) {
            finish(error);
          }
        };
        const receive = (event) => {
          if (event.origin !== "https://www.reddit.com" || event.source !== popup || event.data?.type !== "wipeditt.oauth") return;
          return accept(event.data);
        };
        if (channel) channel.onmessage = (event) => {
          if (event.data?.type === "wipeditt.oauth" && event.data.state === state) accept(event.data);
        };
        const timer = setTimeout(() => {
          controller.abort();
          finish(new AppError("AUTH_TIMEOUT", "Reddit sign-in timed out. Try again."));
        }, 10 * 60 * 1e3);
        this.#pending = () => {
          controller.abort();
          finish(new AppError("AUTH_CANCELED", "Reddit sign-in canceled."));
        };
        this.win.addEventListener("message", receive);
      });
    }
  };

  // src/ui/styles.css
  var styles_default = ':host{all:initial;color-scheme:dark;font:13px/1.5 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#e0e9e3}\n*{box-sizing:border-box}button,input,select,textarea{font:inherit}button,a,input,select,textarea,summary{outline-offset:3px}:focus-visible{outline:2px solid #9cddb4}[hidden]{display:none!important}\nbutton,.button-link{cursor:pointer;border:1px solid var(--border,#39483f);border-radius:6px;padding:7px 11px;background:var(--input,#242f28);color:inherit;text-decoration:none}button:hover:not(:disabled){border-color:#a0dcb4}button:disabled{opacity:.45;cursor:default}.primary{background:#a0dcb4;color:#102419;border-color:#a0dcb4;font-weight:650}.launcher{position:fixed;bottom:22px;right:22px;background:#a0dcb4;color:#102419;font-weight:700;box-shadow:0 4px 20px #0004}\n.panel{--border:#344239;--input:#202a23;position:fixed;right:22px;bottom:68px;width:min(580px,calc(100vw - 32px));max-height:calc(100dvh - 100px);overflow:auto;background:#161f19;color:#e0e9e3;border:1px solid var(--border);border-radius:12px;padding:22px;box-shadow:0 16px 60px #0006;font:13px/1.5 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.panel.light{--border:#c7d4ca;--input:#fff;background:#f7faf7;color:#223629;color-scheme:light}\nheader{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px}.brand{display:flex;align-items:center;gap:10px}h1{font-size:20px;letter-spacing:-.5px;margin:0}header p{margin:0;color:#9eb5a6;font-size:11px}h2{font-size:14px;margin:16px 0 10px}.connection{display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--border);padding:12px 0}.connection-name{color:#a9b7ae;font-size:12px}.connection-name.connected{color:#a0dcb4}.connection button{padding:3px 7px;font-size:11px}.mode-notice{font-size:11px;color:#e3c08b;margin:0 0 12px}.connect-action:has(button:not([hidden])){padding:12px 0 4px}\n.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 14px}.field{display:flex;flex-direction:column;gap:5px;margin:10px 0}.field>span{font-size:12px;font-weight:550}input:not([type=checkbox]),select,textarea{width:100%;color:inherit;background:var(--input,#202a23);border:1px solid var(--border,#344239);padding:8px;border-radius:5px;min-width:0}textarea{resize:vertical;min-height:65px}input[type=checkbox]{accent-color:#9ed9b0;width:15px;height:15px;vertical-align:middle}\nsmall,.muted{font-size:11px;color:#a9b7ae}.counts{font-size:12px;font-weight:600;margin:0}.status{font-size:12px;min-height:18px;color:#b7c9bf;margin:12px 0 0;overflow-wrap:anywhere}.actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.end{justify-content:flex-end}.operation-actions{margin-top:12px}.scope>summary{font-size:14px;font-weight:650}.scope{padding-bottom:12px}.operation{border-top:1px solid var(--border);margin-top:16px}.results{margin-bottom:14px}.selection-tools{display:flex;align-items:center;justify-content:space-between;gap:8px}.selection-tools button,.groups button{font-size:11px;padding:3px 7px}.item-list{max-height:245px;overflow:auto;scrollbar-width:thin}.item{padding:10px 0;border-bottom:1px solid var(--border)}.item-head{display:flex;align-items:center;gap:7px;flex-wrap:wrap;font-size:10px}.item-head span{color:#a9b7ae}.item-head a{margin-left:auto;color:#a0dcb4}.original{font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere;margin:6px 0}.warning,.error{color:#e8b982;font-size:11px}.groups{display:flex;gap:5px;flex-wrap:wrap;padding-top:8px}\ndetails{padding:9px 0}summary{cursor:pointer;font-size:12px;color:inherit}.settings{border-top:1px solid var(--border);margin-top:16px;padding-top:12px}.settings>.actions{margin:12px 0}.activity{padding-left:20px;font:11px ui-monospace,monospace;max-height:150px;overflow:auto}progress{width:100%;height:5px;accent-color:#a0dcb4;margin-top:14px}.private .sensitive{filter:blur(6px);user-select:none}\ndialog{--border:#344239;--input:#202a23;max-height:85dvh;overflow:auto;color:#e0e9e3;background:#161f19;border:1px solid #46594c;border-radius:12px;max-width:min(480px,90vw);padding:24px;font:13px/1.5 system-ui}dialog h2{font-size:18px;margin-top:0}dialog::backdrop{background:#000a}dialog pre{padding:12px;background:#24342a;white-space:pre-wrap;overflow-wrap:anywhere;border-radius:6px}.setup-steps{padding-left:20px}.setup-steps li{margin:10px 0}a{color:#a0dcb4}code{font:12px ui-monospace,monospace;overflow-wrap:anywhere}\n.light .status,.light .muted,.light small,.light .item-head span,.light .connection-name{color:#4d6656}.light .connection-name.connected,.light .item-head a{color:#285b3b}.light .warning{color:#855019}.light header p{color:#466451}@media(max-width:480px){.panel{right:16px;padding:16px}.grid{grid-template-columns:1fr 1fr}.selection-tools{align-items:start;flex-direction:column}header p{font-size:10px}header button{padding:5px 8px}}\n';

  // images/icon.svg
  var icon_default = '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" rx="30" fill="#17251c"/><path d="M24 39h17l10 36 13-29 13 29 10-36h17L85 94H73l-9-21-9 21H43z" fill="#a0dcb4"/><path d="M77 27h27M87 19h17" stroke="#a0dcb4" stroke-width="5" stroke-linecap="round"/></svg>\n';

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
      checkAbort(signal);
      return this.adapter.handlesScheduling ? task() : this.scheduler.request(task, { signal });
    }
    async account(expected, signal) {
      const current = await this.read(() => this.adapter.account({ signal }), signal);
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
          const page = await this.read(() => this.adapter.page({ account, after, type: options.type, signal }), signal);
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
    updateOperation(raw) {
      if (this.running) fail("BUSY", "Operation is running.");
      const preview = this.preview;
      if (!preview) return null;
      const options = normalizeOptions(raw);
      const discovery = (value) => Object.fromEntries(Object.entries(value).filter(([key]) => !["mode", "replacement", "interval", "deleteDelay"].includes(key)));
      if (fingerprint(discovery(options)) !== fingerprint(discovery(preview.options))) {
        this.invalidate();
        fail("STALE", "Filters changed. Scan again.");
      }
      this.confirmation = null;
      this.revision++;
      preview.revision = this.revision;
      preview.options = options;
      preview.key = fingerprint(options);
      this.scheduler.interval = options.interval;
      for (const item of preview.items) {
        item.skip = eligibility(item, preview.account, options.mode);
        if (item.skip) item.selected = false;
      }
      preview.stats.eligible = preview.items.filter((item) => !item.skip).length;
      return preview;
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
            let current = await this.read(() => this.adapter.get(item.id, { signal }), signal);
            const skip = current && eligibility(current, preview.account, run.mode);
            if (!current || skip) {
              state("skipped", "INELIGIBLE");
              continue;
            }
            const write = async (task) => {
              await this.account(preview.account, signal);
              current = await this.read(() => this.adapter.get(item.id, { signal }), signal);
              if (!current || eligibility(current, preview.account, run.mode)) fail("OWNERSHIP", "Ownership or capability changed.");
              const beforeDispatch = () => {
                checkAbort(signal);
                if (this.preview !== preview || this.revision !== preview.revision) fail("STALE", "Preview invalidated.");
                writeSubmitted = true;
              };
              if (this.adapter.handlesScheduling) return task(preview.account, { signal, beforeDispatch });
              return this.scheduler.request(async () => {
                beforeDispatch();
                return task(preview.account);
              }, { signal, write: true });
            };
            if (run.mode !== "delete") {
              if (current.text !== preview.options.replacement) {
                state("editing");
                await write((expected, settings) => this.adapter.edit(item.id, preview.options.replacement, expected, settings));
              }
              const verified = await this.read(() => this.adapter.get(item.id, { signal }), signal);
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
                const again = await this.read(() => this.adapter.get(item.id, { signal }), signal);
                if (!again || again.text !== preview.options.replacement) {
                  state("uncertain", "EDIT_CHANGED");
                  continue;
                }
              }
            }
            if (run.mode !== "anonymize") {
              await write((expected, settings) => this.adapter.delete(item.id, expected, run.mode === "combined" ? preview.options.replacement : void 0, settings));
              const verified = await this.read(() => this.adapter.get(item.id, { signal }), signal);
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

  // src/adapters/reddit.js
  function normalizeThing(thing) {
    const data = thing?.data;
    if (!data || !["t1", "t3"].includes(thing.kind) || !/^t[13]_[a-z0-9]+$/.test(data.name)) return null;
    const comment = thing.kind === "t1";
    const text = comment ? data.body : data.selftext;
    return {
      id: data.name,
      authorId: data.author_fullname || "",
      author: data.author || "",
      subreddit: data.subreddit || "",
      type: comment ? "comment" : "post",
      created: Number(data.created_utc) * 1e3,
      text: typeof text === "string" ? text : "",
      score: typeof data.score === "number" ? data.score : null,
      edited: data.edited === false ? false : typeof data.edited === "number" && data.edited > 0 ? true : null,
      editable: (comment || data.is_self === true) && !data.archived && !data.locked && !data.removed_by_category && !["[deleted]", "[removed]"].includes(text),
      deleted: data.author === "[deleted]" && text === "[deleted]",
      permalink: data.permalink || ""
    };
  }
  var RedditAdapter = class {
    simulation = false;
    handlesScheduling = true;
    label = "Reddit OAuth";
    constructor({ auth, scheduler, transport = send, version = "0.2.0" }) {
      Object.assign(this, { auth, scheduler, transport, version });
    }
    async raw(path, { method = "GET", body, signal, beforeDispatch } = {}) {
      const token = this.auth.token();
      beforeDispatch?.();
      const response = await this.transport({ url: `https://oauth.reddit.com${path}`, method, headers: { Authorization: `Bearer ${token}`, "User-Agent": `web:Wipeditt:v${this.version} (https://github.com/rafelolv/Wipeditt)`, ...body ? { "Content-Type": "application/x-www-form-urlencoded" } : {} }, ...body ? { body: new URLSearchParams(body).toString() } : {} }, { signal });
      const headers = new Headers(response.headers);
      if (response.status !== 200) throw new AppError("HTTP", `Reddit refused the request (HTTP ${response.status}).`, { status: response.status, headers });
      let data;
      try {
        data = JSON.parse(response.text);
      } catch {
        fail("RESPONSE", "Reddit returned an unreadable response.");
      }
      const errors = data?.json?.errors;
      if (Array.isArray(errors) && errors.length) {
        const rate = errors.find((error) => error[0] === "RATELIMIT");
        if (rate) {
          const match = /(?:try again in|wait)\s+(\d+(?:\.\d+)?)\s*(second|minute|hour)/i.exec(String(rate[1]));
          const retryAfterMs = match ? Number(match[1]) * { second: 1e3, minute: 6e4, hour: 36e5 }[match[2].toLowerCase()] : 6e4;
          throw new AppError("RATELIMIT", "Reddit asked Wipeditt to wait.", { headers, retryAfterMs });
        }
        const code = ["USER_REQUIRED", "WRONG_USER", "NOT_AUTHOR"].includes(errors[0]?.[0]) ? "AUTH" : "REDDIT_REJECTED";
        throw new AppError(code, "Reddit rejected the content change. It may be locked, restricted or no longer editable.", { status: code === "AUTH" ? 403 : 400, headers });
      }
      return { data, headers };
    }
    async identityRaw(signal, expected) {
      const result = await this.raw("/api/v1/me?raw_json=1", { signal });
      const { id, name } = result.data;
      if (typeof id !== "string" || !/^[a-z0-9]+$/.test(id) || typeof name !== "string" || !name) fail("AUTH", "Reddit account identity could not be verified.");
      const identity = { id: `t2_${id}`, name };
      if (expected && (identity.id !== expected.id || identity.name !== expected.name)) fail("ACCOUNT_CHANGED", "Reddit account changed. Scan again.");
      return { data: identity, headers: result.headers };
    }
    account({ signal } = {}) {
      return this.scheduler.request(() => this.identityRaw(signal), { signal });
    }
    async page({ account, after, type, signal }) {
      if (!/^[A-Za-z0-9_-]+$/.test(account.name)) fail("AUTH", "Invalid Reddit account name.");
      const listing = type === "comment" ? "comments" : type === "post" ? "submitted" : "overview";
      const query = new URLSearchParams({ limit: "100", sort: "new", raw_json: "1", ...after ? { after } : {} });
      const data = await this.scheduler.request(() => this.raw(`/user/${account.name}/${listing}?${query}`, { signal }), { signal });
      if (data?.kind !== "Listing" || !Array.isArray(data.data?.children)) fail("RESPONSE", "Reddit returned an invalid history listing.");
      if (data.data.after !== null && typeof data.data.after !== "string") fail("RESPONSE", "Reddit returned an invalid history cursor.");
      return { items: data.data.children.map(normalizeThing).filter(Boolean), after: data.data.after };
    }
    async thingRaw(id, signal) {
      if (!/^t[13]_[a-z0-9]+$/.test(id)) fail("OWNERSHIP", "Invalid Reddit content ID.");
      const result = await this.raw(`/api/info?${new URLSearchParams({ id, raw_json: "1" })}`, { signal });
      if (!Array.isArray(result.data?.data?.children)) fail("RESPONSE", "Reddit did not return content for verification.");
      return { data: result.data.data.children.map(normalizeThing).find((item) => item?.id === id) || null, headers: result.headers };
    }
    get(id, { signal } = {}) {
      return this.scheduler.request(() => this.thingRaw(id, signal), { signal });
    }
    edit(id, text, expected, { signal, beforeDispatch } = {}) {
      if (typeof text !== "string" || !text.trim() || text.length > 1e4) fail("FILTER", "Invalid replacement text.");
      return this.scheduler.request(() => this.raw("/api/editusertext", { method: "POST", body: { thing_id: id, text, api_type: "json", return_rtjson: "false" }, signal, beforeDispatch }), {
        signal,
        write: true,
        before: [() => this.identityRaw(signal, expected), async () => {
          const result = await this.thingRaw(id, signal);
          if (!result.data || eligibility(result.data, expected, "anonymize")) fail("OWNERSHIP", "Reddit ownership or edit permission changed.");
          return result;
        }]
      });
    }
    delete() {
      fail("DELETION_UNVERIFIED", "Live deletion will be enabled after real-account anonymization and deletion validation.");
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
    let engine, scheduler, controller, dialog, lastReport, account = null, simulation = false, busy = false, connecting = false, connectionRevision = 0;
    let storage;
    try {
      storage = sessionStorage;
    } catch {
    }
    const checkpoints = new Checkpoints(storage);
    const auth = new RedditAuth();
    const panel = el("section", { class: "panel", "aria-label": "Wipeditt privacy utility" });
    const status = el("p", { class: "status", role: "status", "aria-live": "polite", text: "Connect your Reddit account to get started." });
    const connection = el("span", { class: "connection-name", text: "Not connected" });
    const modeNotice = el("p", { class: "mode-notice", hidden: true });
    const results = el("div", { class: "results", "aria-label": "Content preview" });
    const counters = el("p", { class: "counts", hidden: true });
    const progress = el("progress", { max: 1, value: 0, hidden: true, "aria-label": "Operation progress" });
    const activity = el("ol", { class: "activity" });
    const button = (text, onClick, className = "") => el("button", { type: "button", text, onClick, class: className });
    const log = (text) => {
      activity.prepend(el("li", { text }));
      while (activity.children.length > 30) activity.lastChild.remove();
    };
    const options = () => Object.fromEntries(Object.entries(fields).map(([name, input]) => [name, input.value]));
    function cancelDialog() {
      engine?.cancelConfirmation();
      dialog?.close();
      dialog?.remove();
      dialog = null;
    }
    function selectedCount() {
      return engine?.preview?.items.filter((item) => item.selected && !item.skip).length || 0;
    }
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
      scan.classList.toggle("primary", !engine?.preview);
      connectButton.disabled = busy;
      disconnect.disabled = busy;
      demo.disabled = busy;
      pause.hidden = !busy || connecting;
      stop.hidden = !busy;
      stop.textContent = connecting ? "Cancel sign-in" : "Stop";
      for (const control of panel.querySelectorAll("input,select,textarea,.scope button,.selection-tools button")) control.disabled = busy || control.dataset.ineligible === "true";
      if (!simulation) for (const option of fields.mode.options) option.disabled = option.value !== "anonymize";
      connection.textContent = connected ? simulation ? "Demo account \xB7 synthetic content" : `u/${account.name}` : "Not connected";
      connection.classList.toggle("sensitive", connected);
      connection.classList.toggle("connected", connected);
      modeNotice.hidden = !simulation;
      modeNotice.textContent = "DEMO \xB7 Synthetic data. Your Reddit account is not affected.";
      if (engine?.preview) {
        const { stats } = engine.preview;
        counters.hidden = false;
        counters.textContent = `${stats.matched} found \xB7 ${selectedCount()} selected \xB7 ${stats.eligible} eligible`;
        detailsCounts.textContent = `${stats.inspected} inspected \xB7 ${stats.unique} unique \xB7 ${stats.matched} matching \xB7 ${stats.eligible} eligible \xB7 ${selectedCount()} selected`;
      }
    }
    function invalidate() {
      cancelDialog();
      engine.invalidate();
      results.replaceChildren();
      counters.hidden = true;
      status.textContent = "Filters changed. Scan again to update your selection.";
      refresh();
    }
    function operationChanged() {
      cancelDialog();
      try {
        if (engine.updateOperation(options())) {
          renderPreview();
          status.textContent = "Replacement updated. Review your selection before continuing.";
        }
      } catch (error) {
        status.textContent = error.message;
        review.disabled = true;
      }
    }
    function field(name, title, { type = "text", value = "", choices, hint, advanced = false, ...attrs } = {}) {
      const input = choices ? el("select", { id: name, ...attrs }, choices.map(([value2, text]) => el("option", { value: value2, text }))) : type === "textarea" ? el("textarea", { id: name, rows: 2, value, ...attrs }) : el("input", { id: name, type, value, ...attrs });
      if (choices && value) input.value = value;
      fields[name] = input;
      if (["include", "exclude", "contains", "regex", "replacement"].includes(name)) input.classList.add("sensitive");
      input.addEventListener("input", advanced ? operationChanged : invalidate);
      return el("label", { class: "field", htmlFor: name }, el("span", { text: title }), input, hint ? el("small", { text: hint }) : null);
    }
    function useAdapter(adapter, sharedScheduler) {
      scheduler = sharedScheduler || new Scheduler({ onWait: (wait) => {
        status.textContent = `${wait.reason}${wait.remaining ? ` \xB7 ${(wait.remaining / 1e3).toFixed(1)}s` : ""}`;
      } });
      engine = new Engine({ adapter, scheduler, checkpoints, onEvent: (event) => {
        if (event.type === "scan") status.textContent = `Scanning \xB7 ${event.inspected} checked \xB7 ${event.matched} found`;
        if (event.type === "progress") {
          progress.hidden = false;
          progress.max = event.total;
          progress.value = event.records.filter((record) => ["anonymized", "deleted", "skipped", "failed", "uncertain"].includes(record.state)).length;
          const counts = {};
          for (const record of event.records) counts[record.state] = (counts[record.state] || 0) + 1;
          status.textContent = `${simulation ? "DEMO \xB7 " : ""}${progress.value}/${event.total} complete \xB7 ${Object.entries(counts).map(([state, n]) => `${n} ${state}`).join(" \xB7 ")} \xB7 ${Math.round(event.elapsed / 1e3)}s elapsed`;
          log(`${event.records.at(-1)?.id}: ${event.records.at(-1)?.state}`);
        }
      } });
    }
    function setBusy(value) {
      busy = value;
      refresh();
    }
    function reset() {
      connectionRevision++;
      controller?.abort();
      scheduler?.resume();
      auth.disconnect();
      cancelDialog();
      engine?.invalidate();
      account = null;
      simulation = false;
      results.replaceChildren();
      counters.hidden = progress.hidden = true;
      lastReport = null;
      report.disabled = true;
      fields.mode.value = "anonymize";
      refresh();
    }
    async function connectWith(id) {
      const revision = ++connectionRevision;
      cancelDialog();
      let authorization;
      const previousCooldown = scheduler?.next || 0;
      scheduler = new Scheduler({ onWait: (wait) => {
        status.textContent = `${wait.reason} \xB7 ${Math.ceil(wait.remaining / 1e3)}s`;
      } });
      scheduler.next = previousCooldown;
      auth.scheduler = scheduler;
      try {
        authorization = auth.connect(id);
      } catch (error) {
        status.textContent = error.message;
        return;
      }
      connecting = true;
      setBusy(true);
      status.textContent = "Complete sign-in and consent in the Reddit window.";
      try {
        await authorization;
        if (revision !== connectionRevision) return;
        useAdapter(new RedditAdapter({ auth, scheduler, version }), scheduler);
        const verified = await engine.account();
        if (revision !== connectionRevision) return;
        account = verified;
        simulation = false;
        try {
          localStorage.setItem("wipeditt.clientId", id);
        } catch {
        }
        status.textContent = "Connected. Choose what to scan.";
        log("Reddit account verified with OAuth.");
      } catch (error) {
        if (revision === connectionRevision) {
          auth.disconnect();
          account = null;
          status.textContent = error.message;
        }
      } finally {
        if (revision === connectionRevision) {
          connecting = false;
          setBusy(false);
        }
      }
    }
    function showSetup() {
      if (location.hostname !== "www.reddit.com") {
        status.textContent = "Open www.reddit.com to connect. Wipeditt uses one origin to prevent simultaneous runs.";
        openReddit.hidden = false;
        return;
      }
      cancelDialog();
      let saved = "";
      try {
        saved = localStorage.getItem("wipeditt.clientId") || "";
      } catch {
      }
      const input = el("input", { type: "text", value: saved, autocomplete: "off", spellcheck: false, "aria-label": "Reddit Client ID", placeholder: "Public Client ID" });
      const continueButton = button("Sign in with Reddit", () => {
        try {
          const id = clientId(input.value);
          connectWith(id);
        } catch (error) {
          setupError.textContent = error.message;
        }
      }, "primary");
      const setupError = el("p", { class: "error", role: "alert" });
      const instructions = el(
        "details",
        { open: !saved },
        el("summary", { text: "First time? Set up your Reddit app" }),
        el(
          "ol",
          { class: "setup-steps" },
          el("li", {}, el("a", { href: "https://www.reddit.com/prefs/apps", target: "_blank", rel: "noopener noreferrer", text: "Open Reddit app settings" }), " and create an ", el("strong", { text: "installed app" }), " named Wipeditt."),
          el("li", {}, "Set the redirect URI to ", el("code", { text: REDIRECT_URI }), "."),
          el("li", { text: "Copy the public Client ID shown below the app name. Paste it here. No password or client secret is needed." })
        ),
        el("p", { class: "muted", text: "Reddit controls registration and API approval. If creation is refused or redirects to policy, request API access from Reddit; signing in alone cannot grant it." }),
        el("a", { href: "https://support.reddithelp.com/hc/en-us/articles/42728983564564-Responsible-Builder-Policy", target: "_blank", rel: "noopener noreferrer", text: "Reddit access requirements" })
      );
      dialog = el(
        "dialog",
        { "aria-labelledby": "setup-title" },
        el("h2", { id: "setup-title", text: "Connect your Reddit account" }),
        el("p", { text: "Sign in on Reddit and approve access to your own history. Your password stays on Reddit; Wipeditt keeps the access token in memory only." }),
        instructions,
        el("label", { class: "field" }, el("span", { text: "Reddit Client ID" }), input),
        setupError,
        el("div", { class: "actions end" }, button("Cancel", cancelDialog), continueButton)
      );
      dialog.addEventListener("cancel", (event) => {
        event.preventDefault();
        event.stopPropagation();
        cancelDialog();
      });
      root.append(dialog);
      dialog.showModal();
      input.focus();
    }
    function renderPreview() {
      const preview = engine.preview;
      if (!preview) return;
      results.replaceChildren();
      const select = (items, selected) => {
        cancelDialog();
        for (const item of items) engine.select(item.id, selected);
        renderPreview();
      };
      const groups = el("details", {}, el("summary", { text: "Select by subreddit" }), el("div", { class: "groups" }, [...new Set(preview.items.map((item) => item.subreddit))].map((name) => button(`r/${name}`, () => {
        const items = preview.items.filter((item) => item.subreddit === name && !item.skip);
        select(items, !items.every((item) => item.selected));
      }, "sensitive"))));
      results.append(el("div", { class: "selection-tools" }, counters, el("div", { class: "actions" }, button("Select all", () => select(preview.items, true)), button("Select none", () => select(preview.items, false)))), groups);
      const list2 = el("div", { class: "item-list" });
      for (const item of preview.items) {
        const check = el("input", { type: "checkbox", checked: item.selected, disabled: !!item.skip, "aria-label": `Select ${item.id}` });
        check.dataset.ineligible = String(!!item.skip);
        check.addEventListener("change", () => {
          cancelDialog();
          engine.select(item.id, check.checked);
          refresh();
        });
        const link = safeLink(item.permalink);
        list2.append(el(
          "article",
          { class: "item" },
          el("div", { class: "item-head" }, check, el("strong", { class: "sensitive", text: `r/${item.subreddit}` }), el("span", { text: `${item.type} \xB7 ${new Date(item.created).toLocaleDateString("en-US")} \xB7 ${item.score ?? "?"} points` }), link && item.permalink ? el("a", { href: link, target: "_blank", rel: "noopener noreferrer", text: "Open" }) : null),
          el("p", { class: "original sensitive", text: item.text.slice(0, 600) + (item.text.length > 600 ? "\u2026" : "") }),
          item.skip ? el("small", { class: "warning", text: item.skip }) : null
        ));
      }
      results.append(list2);
      if (!preview.items.length) results.append(el("p", { text: "No matching content. Try a wider date range or fewer filters." }));
      refresh();
    }
    async function performScan() {
      cancelDialog();
      controller = new AbortController();
      scheduler.resume();
      pause.textContent = "Pause";
      setBusy(true);
      lastReport = null;
      report.disabled = true;
      progress.hidden = true;
      try {
        const preview = await engine.scan(options(), controller.signal);
        renderPreview();
        scope.open = false;
        status.textContent = `${preview.reason}. Listings may omit older content.`;
        log(`Scan finished: ${preview.stats.matched} matching items.`);
      } catch (error) {
        results.replaceChildren();
        counters.hidden = true;
        status.textContent = error.message;
        log(error.code || "Scan failed");
      } finally {
        setBusy(false);
      }
    }
    async function execute(phrase) {
      dialog?.close();
      dialog?.remove();
      dialog = null;
      controller = new AbortController();
      scheduler.resume();
      pause.textContent = "Pause";
      setBusy(true);
      try {
        if (!navigator.locks) throw new Error("This browser cannot safely lock an operation. Use a current desktop browser.");
        const run = await navigator.locks.request("wipeditt.operation", { ifAvailable: true }, async (lock) => {
          if (!lock) throw new Error("Wipeditt is already running in another tab. Stop that run first.");
          return engine.execute(options(), { confirmed: true, phrase, signal: controller.signal });
        });
        lastReport = makeReport(run, version, scheduler.stats);
        report.disabled = false;
        const counts = Object.entries(lastReport.counts).map(([state, n]) => `${n} ${state}`).join(" \xB7 ");
        status.textContent = `${simulation ? "DEMO \xB7 No Reddit content changed. " : ""}${run.stopped ? "Stopped" : "Finished"} \xB7 ${counts || "No changes"}`;
        results.replaceChildren();
        counters.hidden = true;
      } catch (error) {
        status.textContent = error.message;
        engine.cancelConfirmation();
      } finally {
        setBusy(false);
      }
    }
    function confirm() {
      try {
        const info = engine.confirmationFor(options());
        const phrase = el("input", { type: "text", autocomplete: "off", "aria-label": "Confirmation phrase" });
        const accept = button(simulation ? "Run demo" : "Anonymize selected", () => execute(phrase.value), "primary");
        accept.disabled = !!info.phrase;
        phrase.addEventListener("input", () => {
          accept.disabled = phrase.value !== info.phrase;
        });
        const cancel = button("Cancel", cancelDialog);
        dialog = el(
          "dialog",
          { "aria-labelledby": "confirmation-title" },
          el("h2", { id: "confirmation-title", text: `Confirm ${info.count} content changes` }),
          el("p", { class: "sensitive", text: `${simulation ? "Demo only. " : `Account: u/${account.name}. `}${fields.mode.selectedOptions[0].textContent}.` }),
          fields.mode.value !== "delete" ? el("div", {}, el("strong", { text: "Exact replacement" }), el("pre", { class: "sensitive", text: fields.replacement.value })) : null,
          el("p", { class: "muted", text: "Changes may be permanent. Archives, caches and moderation records may retain copies. Stop prevents new requests; submitted requests may finish." }),
          info.phrase ? el("label", { class: "field" }, `Type ${info.phrase}`, phrase) : null,
          el("div", { class: "actions end" }, cancel, accept)
        );
        dialog.addEventListener("cancel", (event) => {
          event.preventDefault();
          event.stopPropagation();
          cancelDialog();
        });
        root.append(dialog);
        dialog.showModal();
        cancel.focus();
      } catch (error) {
        status.textContent = error.message;
      }
    }
    const connectButton = button("Connect Reddit", showSetup, "primary");
    const openReddit = el("a", { class: "button-link", href: "https://www.reddit.com/", target: "_blank", rel: "noopener noreferrer", text: "Open Reddit", hidden: true });
    const disconnect = button("Disconnect", () => {
      reset();
      status.textContent = "Disconnected. Your access token was cleared.";
    });
    const scan = button("Scan history", performScan, "primary");
    const review = button("Review selected", confirm, "primary");
    const pause = button("Pause", () => {
      scheduler.paused ? scheduler.resume() : scheduler.pause();
      pause.textContent = scheduler.paused ? "Resume" : "Pause";
    });
    const stop = button("Stop", () => {
      if (connecting) auth.disconnect();
      controller?.abort();
      scheduler.resume();
      status.textContent = "Stopping. Submitted requests may still finish.";
    });
    const detailsCounts = el("p", { class: "muted" });
    const demo = button("Try demo data", async () => {
      reset();
      simulation = true;
      useAdapter(new SimulationAdapter());
      account = await engine.account();
      fields.mode.value = "anonymize";
      status.textContent = "Demo ready. Scan synthetic content to explore the workflow.";
      refresh();
    });
    const report = button("Export report", () => {
      if (!lastReport) return;
      const url = URL.createObjectURL(new Blob([JSON.stringify(lastReport, null, 2)], { type: "application/json" }));
      el("a", { href: url, download: `wipeditt-${version}-report.json` }).click();
      setTimeout(() => URL.revokeObjectURL(url), 1e3);
    });
    report.disabled = true;
    const scope = el(
      "details",
      { class: "scope", open: true, hidden: true },
      el("summary", { text: "1 \xB7 Choose content" }),
      el(
        "div",
        { class: "grid" },
        field("type", "Content", { value: "comment", choices: [["comment", "Comments"], ["post", "Text posts"], ["all", "Comments & text posts"]] }),
        field("limit", "Maximum items", { type: "number", value: "100", min: 0, max: 1e5 })
      ),
      el("details", { class: "filters" }, el("summary", { text: "Add filters" }), el(
        "div",
        { class: "grid" },
        field("include", "Only these subreddits", { placeholder: "privacy, technology" }),
        field("exclude", "Exclude subreddits"),
        field("contains", "Text contains"),
        field("after", "From", { type: "datetime-local" }),
        field("before", "Until", { type: "datetime-local" }),
        field("regex", "Regular expression", { maxLength: 300 }),
        field("minScore", "Minimum score", { type: "number" }),
        field("maxScore", "Maximum score", { type: "number" }),
        field("edited", "Edited status", { choices: [["all", "Any"], ["yes", "Edited"], ["no", "Unedited"]] })
      )),
      el("small", { text: "0 = all available. Reddit listings may not contain your entire history." })
    );
    const operation = el(
      "section",
      { class: "operation", hidden: true },
      el("h2", { text: "2 \xB7 Review & replace" }),
      results,
      field("replacement", "Replace selected text with", { type: "textarea", value: DEFAULT_REPLACEMENT, maxLength: 1e4, advanced: true }),
      el("p", { class: "muted", text: "Replaces comment or text-post bodies. Post titles and media stay unchanged." }),
      el(
        "details",
        { class: "operation-settings" },
        el("summary", { text: "Operation settings" }),
        field("mode", "Mode", { advanced: true, choices: [["anonymize", "Anonymize"], ["delete", "Delete \xB7 demo only"], ["combined", "Anonymize & delete \xB7 demo only"]] }),
        field("interval", "Minimum request interval (ms)", { type: "number", value: "1500", min: 1500, max: 36e5, advanced: true, hint: "Reddit cooldowns always take priority." }),
        field("deleteDelay", "Demo deletion delay (ms)", { type: "number", value: "0", min: 0, max: 864e5, advanced: true })
      )
    );
    const privacy = el("input", { type: "checkbox", onChange: (event) => root.classList.toggle("private", event.target.checked) });
    const theme = button("Light mode", () => {
      panel.classList.toggle("light");
      theme.textContent = panel.classList.contains("light") ? "Dark mode" : "Light mode";
    });
    const hide = button("Close", () => {
      connectionRevision++;
      connecting = false;
      busy = false;
      cancelDialog();
      controller?.abort();
      scheduler?.resume();
      auth.disconnect();
      if (!simulation) {
        account = null;
        engine?.invalidate();
        results.replaceChildren();
        refresh();
      }
      panel.hidden = true;
      launcher.focus();
    });
    const launcher = button("Wipeditt", () => {
      if (panel.hidden) {
        panel.hidden = false;
        connectButton.focus();
      } else hide.click();
    }, "launcher");
    launcher.setAttribute("aria-label", "Open Wipeditt");
    const mark = el("img", { src: `data:image/svg+xml;base64,${btoa(icon_default)}`, alt: "", width: 32, height: 32 });
    panel.append(
      el("header", {}, el("div", { class: "brand" }, mark, el("div", {}, el("h1", { text: "Wipeditt" }), el("p", { text: "Your Reddit history. Your control." }))), hide),
      el("div", { class: "connection" }, connection, disconnect),
      modeNotice,
      el("div", { class: "connect-action" }, connectButton, openReddit),
      scope,
      scan,
      operation,
      el("div", { class: "actions operation-actions" }, review, pause, stop),
      progress,
      status,
      el(
        "details",
        { class: "settings" },
        el("summary", { text: "Settings & help" }),
        el("div", { class: "actions" }, el("label", {}, privacy, " Privacy mode"), theme, report),
        el("details", {}, el("summary", { text: "Scan details & activity" }), detailsCounts, activity),
        el("div", { class: "actions" }, demo, button("Clear local checkpoint", () => {
          checkpoints.clear();
          status.textContent = "Local checkpoint cleared.";
        })),
        el("small", { text: `v${version} \xB7 Rafael (rafaelolv) \xB7 No telemetry` })
      )
    );
    root.append(el("style", { text: styles_default }), launcher, panel);
    useAdapter({ simulation: false, account: async () => {
      throw new Error("Connect Reddit first.");
    } });
    const previous = checkpoints.load();
    if (previous) log(`Interrupted checkpoint: ${previous.records.length} item states. Rescan and review; no automatic replay.`);
    panel.hidden = true;
    refresh();
    root.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !dialog && !event.defaultPrevented) hide.click();
    });
    return { panel, engine: () => engine };
  }

  // src/index.js
  var ID = "wipeditt-runtime-v1";
  if (window.top === window.self && !handleOAuthCallback()) {
    const start = () => {
      if (document.getElementById(ID)) return;
      const host = document.createElement("div");
      host.id = ID;
      host.style.cssText = "position:fixed;z-index:2147483646;inset:0;pointer-events:none";
      const shadow = host.attachShadow({ mode: "open" });
      const container = document.createElement("div");
      container.style.pointerEvents = "auto";
      shadow.append(container);
      document.documentElement.append(host);
      mount(container, "0.2.0");
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
    else start();
  }
})();
