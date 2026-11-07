/**
 * Math normalizer for converting pseudo-math symbols, superscripts, subscripts,
 * and scientific notations to standard LaTeX ($...$).
 */

/**
 * Clean and normalize mathematical expressions in exam questions and options.
 * Example: 'Q = L^(2)m.' -> 'Q = L^2m' or '$Q = L^2 m$'
 * Example: '10^(-5)' -> '$10^{-5}$'
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
  result = result.replace(/(^|[\s,;:(])([A-Za-z](?:_\{?[0-9A-Za-z]+\}?|\([0-9A-Za-z]+\))\s*(?:<|>|<=|>=|=|==|!=)\s*[0-9A-Za-z](?:_\{?[0-9A-Za-z]+\}?|\([0-9A-Za-z]+\))?(?:\s*(?:<|>|<=|>=|=|==|!=)\s*[0-9A-Za-z](?:_\{?[0-9A-Za-z]+\}?|\([0-9A-Za-z]+\))?)?)(?=[\s,;:.)!?]|$)/gu, (match, prefix, comp) => {
    let cleanComp = comp.replace(/_\{?([0-9A-Za-z]+)\}?/g, '_$1');
    cleanComp = cleanComp.replace(/\(([0-9A-Za-z]+)\)/g, '_$1');
    return `${prefix}$${cleanComp}$`;
  });
  result = protect(result);

  // Restore preserved math blocks
  result = result.replace(/___SF_MATH_(\d+)___/g, (_, idx) => preservedMath[Number(idx)] ?? '');

  return result;
}


/** Check if string contains LaTeX math markers or potential math expressions */
export function hasMathContent(text: string): boolean {
  if (!text) return false;
  return /(\$|\\frac|\\tfrac|\\sqrt|\\int|\\sum|\\vec|\\Delta|\\Omega|\\left|\b[A-Za-z]\s*=\s*[^=]+|\^\{|_\{|\^[0-9(]|_[0-9(]|°C|độ\s*C|Ω|μ[A-Za-z])/u.test(text);
}
