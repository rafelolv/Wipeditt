export function el(tag, attributes = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'text') node.textContent = value;
    else if (key === 'class') node.className = value;
    else if (key in node && !key.startsWith('aria')) node[key] = value;
    else node.setAttribute(key, value);
  }
  for (const child of children.flat()) if (child !== null && child !== undefined) node.append(child);
  return node;
}
export function safeLink(value) {
  try {
    const url = new URL(value, 'https://www.reddit.com');
    return url.protocol === 'https:' && ['www.reddit.com', 'old.reddit.com', 'reddit.com'].includes(url.hostname) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
