/**
 * Convert Office Open XML Math (OMML - m:oMath) elements to standard LaTeX equations.
 */

const SYMBOL_MAP: Record<string, string> = {
  '×': ' \\times ', '÷': ' \\div ', '±': ' \\pm ', '∓': ' \\mp ',
  '≤': ' \\le ', '≥': ' \\ge ', '≠': ' \\ne ', '≈': ' \\approx ',
  '≡': ' \\equiv ', '∝': ' \\propto ', '∞': ' \\infty ', '·': ' \\cdot ',
  '•': ' \\cdot ', '…': ' \\dots ', '∂': ' \\partial ', '∇': ' \\nabla ',
  '∈': ' \\in ', '∉': ' \\notin ', '⊂': ' \\subset ', '⊆': ' \\subseteq ',
  '∪': ' \\cup ', '∩': ' \\cap ', '∅': ' \\emptyset ', '→': ' \\to ',
  '←': ' \\leftarrow ', '↔': ' \\leftrightarrow ', '⇒': ' \\Rightarrow ',
  '⇔': ' \\Leftrightarrow ', '°': '^\\circ',
  'α': ' \\alpha ', 'β': ' \\beta ', 'γ': ' \\gamma ', 'δ': ' \\delta ',
  'ε': ' \\varepsilon ', 'θ': ' \\theta ', 'λ': ' \\lambda ', 'μ': ' \\mu ',
  'π': ' \\pi ', 'ρ': ' \\rho ', 'σ': ' \\sigma ', 'τ': ' \\tau ',
  'φ': ' \\varphi ', 'ω': ' \\omega ', 'Δ': ' \\Delta ', 'Ω': ' \\Omega ',
  'Φ': ' \\Phi ', 'Ψ': ' \\Psi ', 'Σ': ' \\Sigma ',
  '∫': ' \\int ', '∑': ' \\sum ', '∏': ' \\prod ', '√': ' \\sqrt '
};

function cleanTagName(name: string): string {
  const idx = name.indexOf(':');
  return idx >= 0 ? name.slice(idx + 1) : name;
}

function childElements(node: Element): Element[] {
  const result: Element[] = [];
  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes[i];
    if (child && child.nodeType === 1) result.push(child as Element);
  }
  return result;
}

function findFirstChild(node: Element, tag: string): Element | undefined {
  const lowerTag = tag.toLowerCase();
  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes[i];
    if (child && child.nodeType === 1 && cleanTagName((child as Element).tagName).toLowerCase() === lowerTag) {
      return child as Element;
    }
  }
  return undefined;
}
export function ommlToLatex(node: Element): string {
  const tag = cleanTagName(node.tagName).toLowerCase();
  switch (tag) {
    case 'omath':
    case 'omathpara': {
      return childElements(node).map(child => ommlToLatex(child)).filter(Boolean).join('');
    }
    case 'r': {
      let text = '';
      for (const child of childElements(node)) {
        if (cleanTagName(child.tagName).toLowerCase() === 't') {
          text += child.textContent ?? '';
        }
      }
      let converted = '';
      for (const char of text) converted += SYMBOL_MAP[char] ?? char;
      return converted;
    }
    case 't': {
      const val = node.textContent ?? '';
      let converted = '';
      for (const char of val) converted += SYMBOL_MAP[char] ?? char;
      return converted;
    }
    case 'f': {
      const numNode = findFirstChild(node, 'num'), denNode = findFirstChild(node, 'den');
      const num = numNode ? childElements(numNode).map(ommlToLatex).join('').trim() : '';
      const den = denNode ? childElements(denNode).map(ommlToLatex).join('').trim() : '';
      return `\\frac{${num || '1'}}{${den || '1'}}`;
    }
    case 'ssup': {
      const eNode = findFirstChild(node, 'e'), supNode = findFirstChild(node, 'sup');
      const base = eNode ? childElements(eNode).map(ommlToLatex).join('').trim() : '';
      const sup = supNode ? childElements(supNode).map(ommlToLatex).join('').trim() : '';
      return `${base ? `{${base}}` : ''}^{${sup}}`;
    }
    case 'ssub': {
      const eNode = findFirstChild(node, 'e'), subNode = findFirstChild(node, 'sub');
      const base = eNode ? childElements(eNode).map(ommlToLatex).join('').trim() : '';
      const sub = subNode ? childElements(subNode).map(ommlToLatex).join('').trim() : '';
      return `${base ? `{${base}}` : ''}_{${sub}}`;
    }
    case 'ssubsup': {
      const eNode = findFirstChild(node, 'e'), subNode = findFirstChild(node, 'sub'), supNode = findFirstChild(node, 'sup');
      const base = eNode ? childElements(eNode).map(ommlToLatex).join('').trim() : '';
      const sub = subNode ? childElements(subNode).map(ommlToLatex).join('').trim() : '';
      const sup = supNode ? childElements(supNode).map(ommlToLatex).join('').trim() : '';
      return `${base ? `{${base}}` : ''}_{${sub}}^{${sup}}`;
    }


    case 'rad': {
      const degNode = findFirstChild(node, 'deg'), eNode = findFirstChild(node, 'e');
      const deg = degNode ? childElements(degNode).map(ommlToLatex).join('').trim() : '';
      const base = eNode ? childElements(eNode).map(ommlToLatex).join('').trim() : '';
      return deg && deg !== '2' ? `\\sqrt[${deg}]{${base}}` : `\\sqrt{${base}}`;
    }
    case 'd': {
      const dPr = findFirstChild(node, 'dpr');
      let beg = '(', end = ')';
      if (dPr) {
        const begNode = findFirstChild(dPr, 'begchr'), endNode = findFirstChild(dPr, 'endchr');
        if (begNode?.getAttribute('m:val')) beg = begNode.getAttribute('m:val')!;
        else if (begNode?.getAttribute('val')) beg = begNode.getAttribute('val')!;
        if (endNode?.getAttribute('m:val')) end = endNode.getAttribute('m:val')!;
        else if (endNode?.getAttribute('val')) end = endNode.getAttribute('val')!;
      }
      const eNode = findFirstChild(node, 'e');
      const content = eNode ? childElements(eNode).map(ommlToLatex).join('').trim() : '';
      if (beg === '(' && end === ')') return `\\left(${content}\\right)`;
      if (beg === '[' && end === ']') return `\\left[${content}\\right]`;
      if (beg === '{' && end === '}') return `\\left\\{${content}\\right\\}`;
      if (beg === '|' && end === '|') return `\\left|${content}\\right|`;
      return `${beg}${content}${end}`;
    }
    case 'func': {
      const fNameNode = findFirstChild(node, 'fname'), eNode = findFirstChild(node, 'e');
      const fName = fNameNode ? childElements(fNameNode).map(ommlToLatex).join('').trim() : '';
      const arg = eNode ? childElements(eNode).map(ommlToLatex).join('').trim() : '';
      if (/^(sin|cos|tan|cot|ln|log|lim|exp)$/i.test(fName)) return `\\${fName.toLowerCase()}{${arg}}`;
      return `${fName}{${arg}}`;
    }
    case 'limlow': {
      const eNode = findFirstChild(node, 'e'), limNode = findFirstChild(node, 'lim');
      const base = eNode ? childElements(eNode).map(ommlToLatex).join('').trim() : '';
      const lim = limNode ? childElements(limNode).map(ommlToLatex).join('').trim() : '';
      return `${base}_{${lim}}`;
    }
    case 'nary': {
      const naryPr = findFirstChild(node, 'narypr');
      let chr = '∫';
      if (naryPr) {
        const chrNode = findFirstChild(naryPr, 'chr');
        chr = chrNode?.getAttribute('m:val') ?? chrNode?.getAttribute('val') ?? '∫';
      }
      const subNode = findFirstChild(node, 'sub'), supNode = findFirstChild(node, 'sup'), eNode = findFirstChild(node, 'e');
      const sub = subNode ? childElements(subNode).map(ommlToLatex).join('').trim() : '';
      const sup = supNode ? childElements(supNode).map(ommlToLatex).join('').trim() : '';
      const body = eNode ? childElements(eNode).map(ommlToLatex).join('').trim() : '';
      const op = chr === '∑' ? '\\sum' : chr === '∏' ? '\\prod' : '\\int';
      let limits = '';
      if (sub && sup) limits = `_{${sub}}^{${sup}}`;
      else if (sub) limits = `_{${sub}}`;
      else if (sup) limits = `^{${sup}}`;
      return `${op}${limits} ${body}`;
    }
    case 'acc': {
      const accPr = findFirstChild(node, 'accpr');
      let chr = '→';
      if (accPr) {
        const chrNode = findFirstChild(accPr, 'chr');
        chr = chrNode?.getAttribute('m:val') ?? chrNode?.getAttribute('val') ?? '→';
      }
      const eNode = findFirstChild(node, 'e');
      const content = eNode ? childElements(eNode).map(ommlToLatex).join('').trim() : '';
      if (chr === '→' || chr === '⃗') return `\\vec{${content}}`;
      if (chr === '^' || chr === '̂') return `\\hat{${content}}`;
      if (chr === '.' || chr === '̇') return `\\dot{${content}}`;
      if (chr === '¯' || chr === '̄') return `\\bar{${content}}`;
      return `\\vec{${content}}`;
    }
    case 'm': {
      const rows = childElements(node).filter(c => cleanTagName(c.tagName).toLowerCase() === 'mr');
      const rowStrings = rows.map(r => {
        const cells = childElements(r).filter(c => cleanTagName(c.tagName).toLowerCase() === 'e');
        return cells.map(c => childElements(c).map(ommlToLatex).join('').trim()).join(' & ');
      });
      return `\\begin{pmatrix} ${rowStrings.join(' \\\\ ')} \\end{pmatrix}`;
    }
    case 'e': case 'num': case 'den': case 'sup': case 'sub':
      return childElements(node).map(ommlToLatex).join('');
    default:
      return childElements(node).map(ommlToLatex).join('');
  }
}

export function formatOmmlAsLatex(node: Element): string {
  const rawLatex = ommlToLatex(node).trim();
  if (!rawLatex) return '';
  return `$${rawLatex}$`;
}
