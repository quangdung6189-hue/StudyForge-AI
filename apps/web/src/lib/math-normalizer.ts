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
  result = result.replace(/(\$\$[\s\S]*?\$\$|\$[^\$\n]+?\$)/g, (match) => {
    preservedMath.push(match);
    return `___SF_MATH_${preservedMath.length - 1}___`;
  });

  // Pattern 2: Mathematical formula lines like "Q = 2Lm.", "Q = L^(2)m.", "v = v_0 + at"
  // If the line looks like an equation: e.g. Variable = Expression with exponents
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

  // Ohm symbol: 100 Ω, 100 ôm, 100 ohm -> $100\ \Omega$
  result = result.replace(/(\d+(?:[.,]\d+)?)\s*(?:Ω|ôm|ohm)\b/giu, (_, num) => `$${num}\\ \\Omega$`);

  // Micro units: 10 μF, 2 μm, 5 μs -> $10\ \mu\text{F}$
  result = result.replace(/(\d+(?:[.,]\d+)?)\s*μ([A-Za-z]+)\b/gu, (_, num, unit) => `$${num}\\ \\mu\\text{${unit}}$`);


  // If whole expression is an equation (e.g. "Q = L^{2}m" or "Q = Lm^{2}" or "E = mc^2")
  // Wrap into $ ... $ for proper KaTeX rendering
  result = result.replace(/(^|[\s,;:(])([A-Za-zΔλΩωμπα-ωΑ-Ω0-9()]+\s*=\s*[^,\n;]+(?:\^\{[^}]+\}|_\{[^}]+\}|\^|_)[^,\n;]*)([\s,;:.)]|$)/gu, (match, prefix, eq, suffix) => {
    // Only wrap if it contains formula signs like =, ^, _, /, \times and doesn't look like plain sentence
    const trimmed = eq.trim();
    if (trimmed.includes('=') && (trimmed.includes('^') || trimmed.includes('_') || trimmed.includes('\\') || /\b[A-Z]\s*=\s*[A-Za-z0-9^_{}]+/.test(trimmed))) {
      return `${prefix}$${trimmed}$${suffix}`;
    }
    return match;
  });

  // Also convert standalone unit expressions like "m/s^2", "m/s^(2)", "kg.m/s^2"
  result = result.replace(/\b(m\/s)\s*\^\s*\(?(\d+)\)?/g, '$1^$2');
  result = result.replace(/\b(cm\/s)\s*\^\s*\(?(\d+)\)?/g, '$1^$2');
  result = result.replace(/\b(rad\/s)\s*\^\s*\(?(\d+)\)?/g, '$1^$2');

  // Restore preserved math blocks
  result = result.replace(/___SF_MATH_(\d+)___/g, (_, idx) => preservedMath[Number(idx)] ?? '');

  return result;
}

/** Check if string contains LaTeX math markers or potential math expressions */
export function hasMathContent(text: string): boolean {
  if (!text) return false;
  return /(\$|\\frac|\\tfrac|\\sqrt|\\int|\\sum|\\vec|\\Delta|\\Omega|\\left|\b[A-Za-z]\s*=\s*[^=]+|\^\{|_\{|\^[0-9(]|_[0-9(]|°C|độ\s*C|Ω|μ[A-Za-z])/u.test(text);
}
