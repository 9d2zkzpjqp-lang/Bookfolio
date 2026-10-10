// Bookfolio RC8: plain-text formatting for book catalogue descriptions.
// Decode HTML references as TEXT only; never insert a catalogue description as HTML.
function decodeEntities(input) {
  let text = String(input ?? '');
  for (let i = 0; i < 2; i++) {
    if (!/&(?:#(?:x[\da-f]+|\d+)|[a-z][a-z0-9]+);?/i.test(text)) break;
    let next;
    if (typeof document !== 'undefined' && document.createElement) {
      const textarea = document.createElement('textarea');
      textarea.innerHTML = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      next = textarea.value;
    } else {
      // Narrow fallback for non-browser tests. Browsers handle all named HTML entities.
      const named = {nbsp:' ',amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',ndash:'–',mdash:'—',hellip:'…',rsquo:'’',lsquo:'‘',ldquo:'“',rdquo:'”',bull:'•'};
      next = text.replace(/&(#(?:x[\da-f]+|\d+)|[a-z][a-z0-9]+);/gi, (original, code) => {
        if (code[0] === '#') {
          const hex = code[1]?.toLowerCase() === 'x';
          const n = parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10);
          return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : original;
        }
        return named[code.toLowerCase()] ?? original;
      });
    }
    if (text === next) break;
    text = next;
  }
  return text;
}

export function normalizeBookDescription(input) {
  return decodeEntities(input)
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/(?:p|div|section|article|li|h[1-6])\s*>/gi, '\n\n')
    .replace(/<\s*li\b[^>]*>/gi, '\n• ')
    .replace(/<\s*(?:p|div|section|article|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
