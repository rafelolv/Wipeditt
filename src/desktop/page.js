// Trusted DOM driver, executed in an isolated renderer world. It reads ordinary page
// content and uses native website controls; it never reads session cookies or tokens.
export function redditPage(operation, input = {}) {
  const result = (code, message, details = {}) => ({ error: { code, message, ...details } });
  const profileName = href => {
    try {
      const url = new URL(href, location.href);
      if (url.protocol !== 'https:' || !['old.reddit.com', 'www.reddit.com', 'reddit.com'].includes(url.hostname)) return '';
      return /^\/(?:user|u)\/([A-Za-z0-9_-]+)\/?$/.exec(url.pathname)?.[1] || '';
    } catch { return ''; }
  };
  const visible = node => !!node && getComputedStyle(node).display !== 'none' && getComputedStyle(node).visibility !== 'hidden' && !!node.getClientRects().length;
  const own = (node, selector) => [...node.querySelectorAll(selector)].find(child => child.closest('.thing') === node);
  const identity = () => {
    const link = document.querySelector('#header-bottom-right .user a[href*="/user/"], #header-bottom-right .user a[href*="/u/"]');
    const name = link && profileName(link.href);
    return name ? { id: `reddit:${name.toLowerCase()}`, name } : null;
  };
  const current = identity();
  if (operation === 'account') {
    if (current) return { data: current };
    const message = document.body?.textContent?.slice(0, 12000).toLowerCase() || '';
    if (/blocked|whoa there|too many requests|network security/.test(message)) return result('SITE_BLOCKED', 'Reddit is blocking this browser or connection. Review the Reddit page; Wipeditt will not bypass the restriction.');
    return result('AUTH', 'Sign in to Reddit in the browser. Wipeditt will verify the account automatically.');
  }
  if (!current) return result('AUTH', 'Reddit sign-in is no longer available. Connect again.');
  if (input.expected && (input.expected.id !== current.id || input.expected.name.toLowerCase() !== current.name.toLowerCase())) return result('ACCOUNT_CHANGED', 'The signed-in Reddit account changed. Connect and scan again.');
  const normalize = node => {
    const id = node.dataset.fullname || /^thing_(t[13]_[a-z0-9]+)$/.exec(node.id)?.[1];
    if (!/^t[13]_[a-z0-9]+$/.test(id || '')) return null;
    const username = value => {
      const text = String(value || '').trim().replace(/^\/?u\//i, '');
      return /^[A-Za-z0-9_-]+$/.test(text) ? text : '';
    };
    const authorNode = own(node, '.tagline .author');
    const authorLink = authorNode?.matches('a[href]') ? authorNode : own(node, '.tagline a[href*="/user/"], .tagline a[href*="/u/"]');
    const linked = authorLink ? profileName(authorLink.href) : '';
    const invalidLink = !!authorLink && !linked;
    const declared = username(node.dataset.author);
    // A non-link author span is used by some classic layouts. A link must
    // resolve to Reddit before its text is considered author evidence.
    const visibleAuthor = authorNode && (!authorNode.matches('a[href]') || linked) ? username(authorNode.textContent) : '';
    const evidence = [linked, declared, visibleAuthor].filter(Boolean);
    const conflict = new Set(evidence.map(name => name.toLowerCase())).size > 1;
    const deletedLabel = own(node, '.tagline em');
    const deletedAuthor = /^\[deleted\]$/i.test(authorNode?.textContent?.trim() || deletedLabel?.textContent?.trim() || '') && !linked;
    const removedAuthor = /^(?:\[deleted\]|\[removed\])$/i.test(String(node.dataset.author || authorNode?.textContent || '').trim());
    let author = !conflict && !removedAuthor ? evidence[0] || '' : '';
    let authorEvidence = author ? (linked ? 'profile-link' : declared ? 'data-author' : 'author-label') : '';
    const textArea = own(node, '.usertext-edit textarea[name="text"], textarea[name="text"]');
    const body = own(node, '.usertext-body .md');
    const text = textArea ? textArea.value : body?.textContent?.trim() || '';
    const subredditLink = own(node, 'a.subreddit');
    const subreddit = node.dataset.subreddit || /^\/r\/([^/]+)/.exec(subredditLink ? new URL(subredditLink.href).pathname : location.pathname)?.[1] || '';
    const time = own(node, 'time[datetime]');
    const created = Date.parse(time?.getAttribute('datetime') || '');
    const scoreNode = own(node, '.score[title], .score[data-score], .score');
    const scoreText = node.dataset.score ?? scoreNode?.getAttribute('title') ?? scoreNode?.dataset.score ?? scoreNode?.textContent;
    const score = typeof scoreText === 'string' && /^-?\d+(?:\s+points?)?$/.test(scoreText.trim()) ? Number.parseInt(scoreText, 10) : null;
    const permalink = own(node, 'a.bylink, a[data-event-action="permalink"], a[data-event-action="comments"]')?.href || '';
    const self = id.startsWith('t1_') || node.classList.contains('self') || node.dataset.domain?.startsWith('self.') || !!own(node, '.expando-button.selftext');
    const edit = own(node, 'a.edit-usertext, .edit-usertext > a');
    const deletion = own(node, 'form.del-button');
    // Classic Reddit emits this native editing action only for an editable
    // item owned by the signed-in author. Use it when the author label is
    // absent, never to override conflicting or explicitly deleted authors.
    if (!author && !conflict && !invalidLink && !removedAuthor && edit && textArea && !evidence.length && !['[deleted]', '[removed]'].includes(text.trim())) {
      author = current.name;
      authorEvidence = 'own-edit-control';
    }
    return {
      id, author, authorEvidence, authorConflict: conflict, authorId: author ? `reddit:${author.toLowerCase()}` : '', subreddit,
      type: id.startsWith('t1_') ? 'comment' : 'post', title: own(node, 'a.title')?.textContent?.trim() || '', created, score,
      edited: !!own(node, 'time.edited-timestamp, .edited-timestamp'), text, permalink,
      editable: self && !!edit && !!textArea && !node.classList.contains('archived') && !node.classList.contains('locked') && !['[deleted]', '[removed]'].includes(text),
      deletable: !!deletion && !!own(node, 'form.del-button a.togglebutton[data-event-action="delete"]'),
      deleted: deletedAuthor && !edit && !deletion && (/^\[deleted\]$/i.test(text.trim()) || node.classList.contains('deleted') || /^\[deleted\]$/i.test(own(node, 'a.title')?.textContent?.trim() || '')),
      needsBody: self && !textArea && !!edit
    };
  };
  const find = id => [...document.querySelectorAll('.thing')].find(node => node.dataset.fullname === id || !node.dataset.fullname && node.id === `thing_${id}`);
  let proofReason = 'DELETE_ORIGINAL_UNAVAILABLE';
  const noProof = reason => { proofReason = reason; return null; };
  const anonymousDeleted = id => {
    const match = /^\/(?:r\/[^/]+|user\/[A-Za-z0-9_-]+)\/comments\/([a-z0-9]+)\/[^/]+(?:\/([a-z0-9]+))?\/?$/.exec(location.pathname);
    if (!match) return noProof('DELETE_FOCUS_URL_MISMATCH');
    if (new URLSearchParams(location.search).get('context') !== '0') return noProof('DELETE_CONTEXT_NOT_FOCUSED');
    const comment = id.startsWith('t1_');
    if (comment ? match[2] !== id.slice(3) : match[1] !== id.slice(3) || match[2]) return noProof('DELETE_FOCUS_URL_MISMATCH');
    const container = document.querySelector(comment ? '.commentarea .sitetable' : '.content > .sitetable.linklisting, #siteTable.linklisting');
    if (!container) return noProof('DELETE_PLACEHOLDER_LAYOUT_UNKNOWN');
    const kind = comment ? '.thing.comment' : '.thing.link';
    const roots = [...container.querySelectorAll(kind)].filter(node => !node.parentElement.closest(kind));
    if (roots.length !== 1) return noProof('DELETE_PLACEHOLDER_AMBIGUOUS');
    const node = roots[0];
    if (!node.classList.contains('deleted')) return noProof('DELETE_MARKER_MISSING');
    if (node.dataset.fullname || node.id || [...node.classList].some(name => /^id-t[13]_/.test(name))) return noProof('DELETE_PLACEHOLDER_ID_CONFLICT');
    if (own(node, '.tagline a.author, a.edit-usertext, form.del-button')) return noProof('DELETE_PLACEHOLDER_AUTHOR_VISIBLE');
    const marker = own(node, '.tagline em, .tagline .author');
    if (!marker || !marker.textContent.trim()) return noProof('DELETE_MARKER_MISSING');
    // The server deliberately strips identity attributes from deleted entries.
    // A unique deleted root in the exact focused permalink (context=0), with
    // its deleted-author marker and no controls, is positive native evidence.
    return { id, type: comment ? 'comment' : 'post', deleted: true, editable: false, deletable: false, author: '', authorId: '', text: '', permalink: location.href, evidence: 'focused-deleted-placeholder' };
  };
  if (operation === 'listing') {
    const listing = document.querySelector('#siteTable, .sitetable.linklisting');
    // Profile context can embed other people's replies beneath a listed item.
    // Only the listing's own entries belong in this history scan.
    const nodes = listing ? [...listing.querySelectorAll('.thing[data-fullname]')].filter(node => !node.parentElement.closest('.thing[data-fullname]')) : [];
    const items = nodes.map(normalize).filter(Boolean);
    const next = document.querySelector('.next-button a')?.href || null;
    const empty = !!document.querySelector('.sitetable .error, #siteTable .error, .sitetable .empty, .empty-page');
    if (!document.querySelector('#siteTable, .sitetable.linklisting')) return result('SITE_CHANGED', 'Reddit history layout is not recognized. Review the browser page before continuing.');
    return { data: { items, after: next, empty } };
  }
  const node = find(input.id);
  if (operation === 'delete-status' && !node) return { data: { settled: true } }; // Fresh original verification is still mandatory.

  if (!node && operation === 'get') { const deleted = anonymousDeleted(input.id); if (deleted) return { data: deleted }; }
  if (!node) return result('CONTENT_UNAVAILABLE', 'Reddit did not show the requested item.', { reason: proofReason });
  const item = normalize(node);
  if (!item) return result('CONTENT_UNAVAILABLE', 'Content metadata is not recognized.');
  if (operation === 'get') return { data: item };
  if (operation === 'delete-status' && item.deleted) return { data: { settled: true } };
  if (item.authorId !== current.id || item.author.toLowerCase() !== current.name.toLowerCase()) return result('OWNERSHIP', 'This content does not belong to the signed-in account.');
  if (operation === 'prepare-delete') {
    const toggle = own(node, 'form.del-button a.togglebutton[data-event-action="delete"]');
    if (!item.deletable || !toggle || !visible(toggle)) return result('INELIGIBLE', 'Reddit does not offer a native delete action for this item.', { status: 400 });
    toggle.click();
    return { data: { prepared: true } };
  }
  if (operation === 'submit-delete') {
    if (input.replacement !== undefined && item.text !== input.replacement) return result('EDIT_CHANGED', 'Replacement changed before deletion. No deletion was sent.', { status: 400 });
    const yes = own(node, 'form.del-button a.yes');
    if (!item.deletable || !yes || !visible(yes) || yes.getAttribute('aria-disabled') === 'true') return result('INELIGIBLE', 'Reddit deletion confirmation is unavailable. No deletion was sent.', { status: 400 });
    yes.click();
    return { data: { submitted: true } };
  }
  if (operation === 'delete-status') {
    const errors = [...node.querySelectorAll('.error')].filter(child => child.closest('.thing') === node && !child.matches('.option.error') && !child.matches('.option.error') && visible(child) && child.textContent.trim());
    const message = errors.map(child => child.textContent).join(' ').toLowerCase();
    if (/sign in|logged in|session expired/.test(message)) return result('AUTH', 'Reddit authorization is no longer available.', { status: 401, fatal: true });
    if (/permission|forbidden|not authorized/.test(message)) return result('PERMISSION', 'Reddit denied permission for this operation.', { status: 403, fatal: true });
    if (/try again|wait|too much|ratelimit/.test(message)) {
      const wait = /(?:in|wait)\s+(\d+)\s*(second|minute|hour)/i.exec(message);
      return result('RATELIMIT', 'Reddit asked Wipeditt to wait.', { status: 429, retryAfterMs: wait ? Number(wait[1]) * ({ second: 1000, minute: 60000, hour: 3600000 }[wait[2]]) : 60000 });
    }
    if (errors.length) return result('REDDIT_REJECTED', 'Reddit rejected the deletion.', { status: 400 });
    const yes = own(node, 'form.del-button a.yes');
    return { data: { settled: item.deleted || !yes || !visible(yes) } };
  }
  if (operation === 'expand') {
    const expand = own(node, '.expando-button.selftext');
    if (expand && !expand.classList.contains('expanded')) expand.click();
    return { data: item };
  }
  if (operation === 'prepare-edit') {
    const edit = own(node, 'a.edit-usertext, .edit-usertext > a');
    if (!edit || !item.editable) return result('INELIGIBLE', 'Reddit does not offer an editable text body for this item.');
    edit.click();
    return { data: item };
  }
  if (operation === 'submit-edit') {
    const area = own(node, '.usertext-edit textarea[name="text"]');
    const save = own(node, '.usertext-edit button.save, .usertext-edit button[type="submit"]');
    if (!area || !save || !visible(area) || !visible(save) || save.disabled || !item.editable) return result('SITE_CHANGED', 'Reddit edit controls are unavailable. No change was sent.');
    if (typeof input.text !== 'string' || !input.text.trim() || input.text.length > 10000) return result('FILTER', 'Invalid replacement text.');
    const nativeSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    nativeSetter.call(area, input.text);
    area.dispatchEvent(new Event('input', { bubbles: true }));
    area.dispatchEvent(new Event('change', { bubbles: true }));
    save.click();
    return { data: { submitted: true } };
  }
  if (operation === 'edit-status') {
    const errors = [...node.querySelectorAll('.error')].filter(child => child.closest('.thing') === node && !child.matches('.option.error') && visible(child) && child.textContent.trim());
    const message = errors.map(child => child.textContent).join(' ').toLowerCase();
    if (/sign in|logged in|session expired/.test(message)) return result('AUTH', 'Reddit authorization is no longer available.', { status: 401, fatal: true });
    if (/permission|forbidden|not authorized/.test(message)) return result('PERMISSION', 'Reddit denied permission for this operation.', { status: 403, fatal: true });
    if (/try again|wait|too much|ratelimit/.test(message)) {
      const wait = /(?:in|wait)\s+(\d+)\s*(second|minute|hour)/i.exec(message);
      const retryAfterMs = wait ? Number(wait[1]) * ({ second: 1000, minute: 60000, hour: 3600000 }[wait[2]]) : 60000;
      return result('RATELIMIT', 'Reddit asked Wipeditt to wait.', { status: 429, retryAfterMs });
    }
    if (errors.length) return result('REDDIT_REJECTED', 'Reddit rejected this edit. Review the item in the browser.', { status: 400 });
    const area = own(node, '.usertext-edit textarea[name="text"]');
    const body = own(node, '.usertext-body .md');
    return { data: { settled: !!area && !visible(area) && body?.textContent?.trim() === input.text.trim() } };
  }
  return result('COMMAND', 'Unsupported browser action.');
}
