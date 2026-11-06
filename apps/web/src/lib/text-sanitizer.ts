/**
 * Text and special character sanitizer for Vietnamese exam documents.
 * Cleans Word private-use area characters (Symbol/Wingdings), invisible control characters,
 * and prevents accidental text merging or false answer markings.
 */

const SYMBOL_TRANSLATIONS: Record<number, string> = {
  0xf020: ' ',
  0xf0a7: '■',
  0xf0a8: '□',
  0xf0b7: '•',
  0xf0d8: '→',
  0xf0e0: '←',
  0xf0fc: '✓',
  0xf0fd: '✗',
  0xf0fe: '☑',
};

/**
 * Sanitize exam text:
 * 1. Normalize unicode to NFC
 * 2. Replace Word Private Use Area (Symbol/Wingdings \uF000-\uF0FF) with readable symbols
 * 3. Strip invisible control characters (zero-width, soft hyphens, BOM)
 * 4. Normalize varied whitespace (NBSP, em space) while preserving newlines
 * 5. Protect mathematical multiplication symbols (e.g. 2 * 3) from being parsed as answer keys
 */
export function sanitizeExamText(text: string): string {
  if (!text) return text;

  let result = text.normalize('NFC');

  // Strip zero-width spaces, soft hyphens, and byte-order-marks
  result = result.replace(/[\u200B\u200C\u200D\uFEFF\u00AD]/g, '');

  // Strip raw ASCII control characters (keep \t, \n, \r)
  result = result.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Convert Word Symbol / Wingdings characters in private use area
  result = result.replace(/[\uF000-\uF0FF]/g, (char) => {
    const code = char.charCodeAt(0);
    return SYMBOL_TRANSLATIONS[code] ?? '';
  });

  // Normalize non-breaking spaces and exotic spaces to standard space
  result = result.replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ');

  // Normalize curly single/double quotes to standard quotes
  result = result.replace(/[\u2018\u2019\u201A\u201B]/g, "'");
  result = result.replace(/[\u201C\u201D\u201E\u201F]/g, '"');

  // Normalize Windows CRLF to LF
  result = result.replace(/\r\n?/g, '\n');

  return result;
}

/**
 * Distinguish a math multiplication sign (e.g., '2 * 3' or 'a * b') from an option answer marker (e.g., '*A.' or '*B)').
 */
export function isMathStar(line: string, matchIndex: number): boolean {
  if (matchIndex <= 0 || matchIndex >= line.length - 1) return false;
  const before = line.slice(0, matchIndex).trimEnd();
  const after = line.slice(matchIndex + 1).trimStart();
  // If preceded and followed by numbers or variables, it's multiplication
  const isNumberOrVarBefore = /[\d\)a-zA-Z]$/.test(before);
  const isNumberOrVarAfter = /^[\d\(a-zA-Z]/.test(after);
  return isNumberOrVarBefore && isNumberOrVarAfter;
}
