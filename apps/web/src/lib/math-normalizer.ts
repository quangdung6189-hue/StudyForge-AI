/**
 * Math & STEM (Math, Physics, Chemistry, Biology) normalizer for converting pseudo-math symbols,
 * superscripts, subscripts, Unicode formula characters, chemical formulas, genetics notation,
 * and scientific notations to standard LaTeX ($...$) rendered by KaTeX formula fonts.
 */

const UNICODE_SUB_MAP: Record<string, string> = {
  '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
  '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
  '₊': '+', '₋': '-', '₌': '=', '₍': '(', '₎': ')',
};

const UNICODE_SUP_MAP: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
  '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
  '⁺': '+', '⁻': '-', '⁼': '=', '⁽': '(', '⁾': ')',
};

/**
 * Clean and normalize mathematical, physical, chemical, and biological expressions
 * in exam questions and options so they render with KaTeX formula fonts instead of ordinary text.
 */
export function normalizeMathText(text: string): string {
  if (!text) return text;

  let result = text;

  // Pattern 1: Already wrapped in $ ... $ or $$ ... $$ - preserve them
  const preservedMath: string[] = [];
  const protect = (str: string) => str.replace(/(\$\$[\s\S]*?\$\$|\$[^\$\n]+?\$)/g, (match) => {
    preservedMath.push(match);
    return `___SF_MATH_${preservedMath.length - 1}___`;
  });

  result = protect(result);

  // Convert Unicode subscript sequences (e.g. H₂SO₄, CO₂, v₀, x₁) to _(..) so downstream rules unify them
  result = result.replace(/([A-Za-z0-9)\]])([₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎]+)/gu, (_, base, subs: string) => {
    const mapped = [...subs].map(c => UNICODE_SUB_MAP[c] ?? c).join('');
    return `${base}_(${mapped})`;
  });

  // Convert Unicode superscript sequences (e.g. x², Fe³⁺, SO₄²⁻, 10⁻³) to ^(..)
  result = result.replace(/([A-Za-z0-9)\]}])([⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾]+)/gu, (_, base, sups: string) => {
    const mapped = [...sups].map(c => UNICODE_SUP_MAP[c] ?? c).join('');
    return `${base}^(${mapped})`;
  });

  // Convert Chemistry formulas with explicit _(..) or ^(..) like H_(2)O, H_(2)SO_(4), Fe^(3+), SO_(4)^(2-), Ca(OH)_(2)
  // into upright LaTeX chemical formulas wrapped in $...$
  result = result.replace(/\b((?:[A-Z][a-z]?|\([A-Za-z0-9]+\))(?:_\(\d+\)|\^\(\d*[+\-]\)|_\(\d+\)\^\(\d*[+\-]\))+([A-Z][a-z]?(?:_\(\d+\)|\^\(\d*[+\-]\))*)*)/g, (match) => {
    // Only treat as chemical formula if it starts with a valid chemical element or group and has numbers/charges
    if (!/^(?:H|He|Li|Be|B|C|N|O|F|Ne|Na|Mg|Al|Si|P|S|Cl|Ar|K|Ca|Cr|Mn|Fe|Co|Ni|Cu|Zn|Br|Ag|Cd|Sn|I|Ba|Pt|Au|Hg|Pb|\()/.test(match)) {
      return match;
    }
    const latexChem = match
      .replace(/_\(([^)]+)\)/g, '_{$1}')
      .replace(/\^\(([^)]+)\)/g, '^{$1}')
      .replace(/([A-Za-z]+)/g, '\\text{$1}');
    return `$${latexChem}$`;
  });
  result = protect(result);

  // Biology sex-linked and blood-group alleles: X^(A)X^(a), X^(a)Y, I^(A)I^(B), I^(O)I^(O)
  result = result.replace(/\b([XI])\^\(([A-Za-z0-9+\-]+)\)(?:([XI])\^\(([A-Za-z0-9+\-]+)\)|(Y))?(?=[\s,;:.)!?]|$)/g, (_, b1, s1, b2, s2, y) => {
    let out = `\\text{${b1}}^{\\text{${s1}}}`;
    if (b2 && s2) out += `\\text{${b2}}^{\\text{${s2}}}`;
    else if (y) out += `\\text{Y}`;
    return `$${out}$`;
  });
  result = protect(result);

  // Biology generation & chromosome notations: F_(1), F_(2), 2n = 46, 2n + 1, 2n - 1, 5' -> 3', 3' -> 5'
  result = result.replace(/\b([FP])_\(([1234])\)/g, (_, gen, num) => `$\\text{${gen}}_{${num}}$`);
  result = result.replace(/\b([234]n\s*(?:=\s*\d+|[+\-]\s*[12]))\b/g, '$$$1$$');
  result = result.replace(/\b([35]')\s*(?:->|→)\s*([35]')/g, '$$$1 \\to $2$$');
  result = protect(result);

  // Chemistry & Physics standalone reaction arrows and symbols outside $...$
  result = result.replace(/\s*(?:⇌|⇄|<=>)\s*/g, ' $\\rightleftharpoons$ ');
  result = result.replace(/\s*--\(t°\)-->\s*/g, ' $\\xrightarrow{t^\\circ}$ ');
  result = protect(result);

  // Pattern 2: Mathematical formula lines like "Q = 2Lm.", "Q = L^(2)m.", "v = v_0 + at"
  result = result.replace(/([A-Za-zΔλΩωμπα-ωΑ-Ω])\s*\^\s*\(([^)]+)\)/gu, '$1^{$2}');
  result = result.replace(/([A-Za-zΔλΩωμπα-ωΑ-Ω])\s*_\s*\(([^)]+)\)/gu, '$1_{$2}');

  // Standalone numbers with exponents: 10^(-3) -> 10^{-3}
  result = result.replace(/(\d+)\s*\^\s*\(([^\)]+)\)/g, '$1^{$2}');
  result = result.replace(/(\d+)\s*_\s*\(([^\)]+)\)/g, '$1_{$2}');

  // Physics vectors: vec(v), vec(F), vec(a), vec(p)
  result = result.replace(/\bvec\(([A-Za-z]+)\)/gu, '\\vec{$1}');

  // Physics Delta: Δt, Δx, Δl, ΔT
  result = result.replace(/(^|[\s,;:(])Δ([A-Za-z])\b/gu, '$1\\Delta $2');

  // Degree Celsius: 37°C, 37 °C, 37 độ C -> $37^\circ\text{C}$
  result = result.replace(/(\d+(?:[.,]\d+)?)\s*(?:°C|độ\s*C)\b/gu, (_, num) => `$${num}^\\circ\\text{C}$`);
  result = protect(result);

  // Ohm symbol: 100 Ω, 100 ôm, 100 ohm -> $100\ \Omega$
  result = result.replace(/(\d+(?:[.,]\d+)?)\s*(?:Ω|ôm|ohm)\b/giu, (_, num) => `$${num}\\ \\Omega$`);
  result = protect(result);

  // Micro units: 10 μF, 2 μm, 5 μs -> $10\ \mu\text{F}$
  result = result.replace(/(\d+(?:[.,]\d+)?)\s*μ([A-Za-z]+)\b/gu, (_, num, unit) => `$${num}\\ \\mu\\text{${unit}}$`);
  result = protect(result);

  // Also convert standalone unit expressions like "m/s^2", "m/s^(2)", "kg.m/s^2"
  result = result.replace(/\b(m\/s)\s*\^\s*\(?(\d+)\)?/g, '$1^$2');
  result = result.replace(/\b(cm\/s)\s*\^\s*\(?(\d+)\)?/g, '$1^$2');
  result = result.replace(/\b(rad\/s)\s*\^\s*\(?(\d+)\)?/g, '$1^$2');

  // If whole expression is an equation (e.g. "Q = L^{2}m" or "Q = Lm^{2}" or "E = mc^2" or "g = 10 m/s^2")
  // Wrap into $ ... $ for proper KaTeX rendering, but NEVER swallow prose or cross sentence boundaries!
  result = result.replace(/(^|[\s,;:(])((?:\\Delta\s+)?[A-Za-zΔλΩωμπα-ωΑ-Ω][A-Za-z0-9()_^{}]*\s*=\s*[0-9A-Za-zΔλΩωμπα-ωΑ-Ω\^_{}\/\\+\-*% ]+?)(?=(?:\.(?:\s+|$)|[\n;!?]|$))/gu, (match, prefix, eq) => {
    const trimmed = eq.trim();
    // Abort if it contains Vietnamese accented letters or preserved placeholders
    if (/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/iu.test(trimmed) || trimmed.includes('___SF_MATH_')) {
      return match;
    }
    // Only wrap if it contains formula indicators (^, _, \, or variable = expression)
    if (
      trimmed.includes('=') &&
      (/\b(?:\\Delta\s+)?[A-Za-zΔλΩωμπα-ωΑ-Ω]/.test(trimmed)) &&
      (trimmed.includes('^') || trimmed.includes('_') || trimmed.includes('\\') || /[0-9]/.test(trimmed))
    ) {
      return `${prefix}$${trimmed}$`;
    }
    return match;
  });
  result = protect(result);

  // Normalize subscript comparisons in stems and options:
  // e.g. "V_(1) < V_(2)", "V_{1} = 2V_{2}", "V_{1} > V_{2}" -> "$V_1 < V_2$"
  result = result.replace(/(^|[\s,;:(])([A-Za-z](?:_\{?[0-9A-Za-z]+\}?|\([0-9A-Za-z]+\))\s*(?:<|>|<=|>=|=|==|!=)\s*[0-9A-Za-z](?:_\{?[0-9A-Za-z]+\}?|\([0-9A-Za-z]+\))?(?:\s*(?:<|>|<=|>=|=|==|!=)\s*[0-9A-Za-z](?:_\{?[0-9A-Za-z]+\}?|\([0-9A-Za-z]+\))?)?)(?=[\s,;:.)!?]|$)/gu, (_match, prefix, comp) => {
    let cleanComp = comp.replace(/_\{?([0-9A-Za-z]+)\}?/g, '_$1');
    cleanComp = cleanComp.replace(/\(([0-9A-Za-z]+)\)/g, '_$1');
    return `${prefix}$${cleanComp}$`;
  });
  result = protect(result);

  // Wrap remaining standalone LaTeX/exponential tokens (like \vec{F}, \Delta t, x^{2}, 10^{-3}, v_{0}) in $...$
  // so they ALWAYS render with KaTeX formula fonts instead of ordinary text!
  result = result.replace(/(^|[\s,;:(])(\\vec\{[A-Za-z]+\}|\\Delta\s+[A-Za-z]|[0-9A-Za-z]+(?:\^\{[^}]+\}|_\{[^}]+\})+[0-9A-Za-z^_{}]*)(?=[\s,;:.)!?]|$)/gu, (_, prefix, token) => {
    if (token.includes('___SF_MATH_')) return `${prefix}${token}`;
    return `${prefix}$${token}$`;
  });
  result = protect(result);

  // Restore preserved math blocks
  result = result.replace(/___SF_MATH_(\d+)___/g, (_, idx) => preservedMath[Number(idx)] ?? '');

  return result;
}

/**
 * Convert plain-text STEM formulas in an exam document into explicit $LaTeX$ blocks
 * so teachers can upgrade raw text formulas to formula font with one click.
 */
export function convertPlainFormulasToLatex(text: string): string {
  if (!text) return text;
  let out = normalizeMathText(text);
  // Common plain-text chemical formulas when preceded by whitespace/punctuation
  const COMMON_CHEMICALS: Record<string, string> = {
    'H2SO4': '$\\text{H}_2\\text{SO}_4$',
    'HNO3': '$\\text{HNO}_3$',
    'H2CO3': '$\\text{H}_2\\text{CO}_3$',
    'H3PO4': '$\\text{H}_3\\text{PO}_4$',
    'H2O': '$\\text{H}_2\\text{O}$',
    'CO2': '$\\text{CO}_2$',
    'SO2': '$\\text{SO}_2$',
    'NO2': '$\\text{NO}_2$',
    'NH3': '$\\text{NH}_3$',
    'CH4': '$\\text{CH}_4$',
    'Ca(OH)2': '$\\text{Ca(OH)}_2$',
    'Ba(OH)2': '$\\text{Ba(OH)}_2$',
    'BaCl2': '$\\text{BaCl}_2$',
    'BaSO4': '$\\text{BaSO}_4$',
    'CaCO3': '$\\text{CaCO}_3$',
    'Na2CO3': '$\\text{Na}_2\\text{CO}_3$',
    'NaHCO3': '$\\text{NaHCO}_3$',
    'Al2O3': '$\\text{Al}_2\\text{O}_3$',
    'Fe2O3': '$\\text{Fe}_2\\text{O}_3$',
    'Fe3O4': '$\\text{Fe}_3\\text{O}_4$',
    'CuSO4': '$\\text{CuSO}_4$',
    'AgNO3': '$\\text{AgNO}_3$',
    'KMnO4': '$\\text{KMnO}_4$',
    'KClO3': '$\\text{KClO}_3$',
    'MnO2': '$\\text{MnO}_2$',
    'C2H5OH': '$\\text{C}_2\\text{H}_5\\text{OH}$',
    'CH3COOH': '$\\text{CH}_3\\text{COOH}$',
  };
  const preserved: string[] = [];
  out = out.replace(/(\$\$[\s\S]*?\$\$|\$[^\$\n]+?\$)/g, (m) => {
    preserved.push(m);
    return `___SF_CHEM_${preserved.length - 1}___`;
  });
  for (const [plain, latex] of Object.entries(COMMON_CHEMICALS)) {
    const escaped = plain.replace(/[()]/g, '\\$&');
    out = out.replace(new RegExp(`(^|[\\s,;:(])${escaped}(?=[\\s,;:.)!?]|$)`, 'g'), `$1${latex}`);
  }
  out = out.replace(/___SF_CHEM_(\d+)___/g, (_, idx) => preserved[Number(idx)] ?? '');
  return out;
}

/** Check if string contains LaTeX math markers or potential STEM formula expressions */
export function hasMathContent(text: string): boolean {
  if (!text) return false;
  return /(\$|\\frac|\\tfrac|\\sqrt|\\int|\\sum|\\vec|\\Delta|\\Omega|\\left|\\rightleftharpoons|\\xrightarrow|\b[A-Za-z]\s*=\s*[^=]+|\^\{|_\{|\^[0-9(]|_[0-9(]|°C|độ\s*C|Ω|μ[A-Za-z]|[₀-₉⁰-⁹⁺⁻]|[234]n\s*[=+\-]|⇌|⇄)/u.test(text);
}
