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
  const own = (node, selector) => [...node.querySelectorAll(selector)].find(child => child.closest('.thing[data-fullname]') === node);
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
    const id = node.dataset.fullname;
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
    // Classic Reddit emits this native editing action only for an editable
    // item owned by the signed-in author. Use it when the author label is
    // absent, never to override conflicting or explicitly deleted authors.
    if (!author && !conflict && !invalidLink && !removedAuthor && edit && textArea && !evidence.length && !['[deleted]', '[removed]'].includes(text.trim())) {
      author = current.name;
      authorEvidence = 'own-edit-control';
    }
    return {
      id, author, authorEvidence, authorConflict: conflict, authorId: author ? `reddit:${author.toLowerCase()}` : '', subreddit,
      type: id.startsWith('t1_') ? 'comment' : 'post', created, score,
      edited: !!own(node, 'time.edited-timestamp, .edited-timestamp'), text, permalink,
      editable: self && !!edit && !!textArea && !node.classList.contains('archived') && !node.classList.contains('locked') && !['[deleted]', '[removed]'].includes(text),
      deleted: false, needsBody: self && !textArea && !!edit
    };
  };
  const find = id => [...document.querySelectorAll('.thing[data-fullname]')].find(node => node.dataset.fullname === id);
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
  if (!node) return result('CONTENT_UNAVAILABLE', 'Reddit did not show the requested item. No change was made.');
  const item = normalize(node);
  if (!item) return result('CONTENT_UNAVAILABLE', 'Content metadata is not recognized.');
  if (operation === 'get') return { data: item };
  if (item.authorId !== current.id || item.author.toLowerCase() !== current.name.toLowerCase()) return result('OWNERSHIP', 'This content does not belong to the signed-in account.');
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
    const errors = [...node.querySelectorAll('.error')].filter(child => child.closest('.thing[data-fullname]') === node && visible(child) && child.textContent.trim());
    const message = errors.map(child => child.textContent).join(' ').toLowerCase();
    if (/try again|wait|too much|ratelimit/.test(message)) {
      const wait = /(?:in|wait)\s+(\d+)\s*(second|minute|hour)/i.exec(message);
      const retryAfterMs = wait ? Number(wait[1]) * ({ second: 1000, minute: 60000, hour: 3600000 }[wait[2]]) : 60000;
      return result('RATELIMIT', 'Reddit asked Wipeditt to wait.', { retryAfterMs });
    }
    if (errors.length) return result('REDDIT_REJECTED', 'Reddit rejected this edit. Review the item in the browser.', { status: 400 });
    const area = own(node, '.usertext-edit textarea[name="text"]');
    const body = own(node, '.usertext-body .md');
    return { data: { settled: !!area && !visible(area) && body?.textContent?.trim() === input.text.trim() } };
  }
  return result('COMMAND', 'Unsupported browser action.');
}
