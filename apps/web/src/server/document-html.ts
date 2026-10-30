import { DOMParser } from '@xmldom/xmldom';

/** Convert Mammoth's semantic HTML to plain text, preserving numbered lists and table cells.
 * Never render uploaded HTML in the browser and never load external resources.
 */
export function documentHtmlToText(html: string): { text: string; hasImages: boolean } {
  if (html.length > 8_000_000) throw new Error('Document HTML too large');
  const document = new DOMParser({ errorHandler: { warning() {}, error() {}, fatalError() { throw new Error('Invalid document structure'); } } }).parseFromString(`<html><body>${html}</body></html>`, 'text/html');
  let hasImages = false;
  function walk(node: Node, depth = 0): string {
    if (node.nodeType === 3) return node.nodeValue ?? '';
    if (node.nodeType !== 1 && node.nodeType !== 9) return '';
    const element = node as Element, tag = element.tagName?.toLowerCase();
    const children = () => Array.from(node.childNodes).map(child => walk(child, depth)).join('');
    if (tag === 'script' || tag === 'style') return '';
    if (tag === 'img') { hasImages = true; return ''; }
    if (tag === 'br') return '\n';
    if (tag === 'sup') return `^(${children()})`;
    if (tag === 'sub') return `_(${children()})`;
    if (tag === 'ol' || tag === 'ul') {
      const items = Array.from(node.childNodes).filter(child => child.nodeType === 1 && (child as Element).tagName.toLowerCase() === 'li');
      const start = Number(element.getAttribute('start')) || 1;
      return '\n' + items.map((item, index) => {
        const value = Array.from(item.childNodes).map(child => walk(child, depth + 1)).join('').trim();
        const explicit = /^(?:Câu\s*\d+|[A-Fa-f][.)]|\d+[.)])/iu.test(value);
        const prefix = depth === 0 ? `Câu ${start + index}. ` : `${String.fromCharCode(65 + index)}. `;
        return (explicit ? '' : prefix) + value;
      }).join('\n') + '\n';
    }
    if (tag === 'tr') {
      const cells = Array.from(node.childNodes).filter(child => child.nodeType === 1).map(child => walk(child, depth).trim()).filter(Boolean);
      const opt = cells.filter(c => /^[A-Fa-f][.)]\s+/u.test(c));
      const joiner = cells.length >= 2 && opt.length >= 2 ? '\n' : '\t';
      return '\n' + cells.join(joiner) + '\n';
    }
    if (tag === 'td' || tag === 'th') return children().trim();
    const value = children();
    return /^(p|h[1-6]|div|table|blockquote)$/.test(tag ?? '') ? `\n${value}\n` : value;
  }
  const raw = walk(document).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  const lines = raw.split('\n');
  const out: string[] = [];
  for (const ln of lines) {
    if (/^[A-Fa-f][.)]\s+/u.test(ln) && /\t\s*[A-Fa-f][.)]\s+/u.test(ln)) out.push(...ln.split(/\t+/));
    else out.push(ln);
  }
  return { text: out.join('\n'), hasImages };
}
