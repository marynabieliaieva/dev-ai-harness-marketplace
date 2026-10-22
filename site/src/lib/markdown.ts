// The only place repository markdown becomes HTML: marked renders it, DOMPurify sanitizes it
// before anything inserts it into the page. Repository content is not trusted HTML.

import DOMPurify from 'dompurify';
import { marked } from 'marked';

marked.setOptions({ gfm: true, breaks: false });

let linkBase = '';

// Runs on every sanitized element: external links open in a new tab without an opener;
// relative links and images point at the file on GitHub.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    const href = node.getAttribute('href') ?? '';
    if (href.startsWith('#')) return;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(href) && linkBase) node.setAttribute('href', resolve(linkBase, href));
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
  if (node.tagName === 'IMG') {
    const src = node.getAttribute('src') ?? '';
    if (!/^[a-z][a-z0-9+.-]*:/i.test(src) && linkBase) node.setAttribute('src', resolve(linkBase.replace('/blob/', '/raw/'), src));
    node.setAttribute('loading', 'lazy');
  }
});

function resolve(base: string, href: string) {
  try {
    return new URL(href, base).toString();
  } catch {
    return base;
  }
}

/**
 * @param md markdown from the repository
 * @param base GitHub URL of the file the markdown came from, for relative links
 */
export function renderMarkdown(md: string, base = ''): string {
  linkBase = base;
  const html = marked.parse(md, { async: false });
  const clean = DOMPurify.sanitize(html, { USE_PROFILES: { html: true }, FORBID_TAGS: ['style', 'form', 'input', 'button'] });
  linkBase = '';
  return clean;
}
