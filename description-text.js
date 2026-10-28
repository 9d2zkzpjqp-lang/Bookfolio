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


// RC10: Remove *clearly identifiable* editorial endorsements preceding the
// actual synopsis in Apple Books. The stored catalogue text is never changed.
// Uncertain cases fall back to the entire original description.
function isPromotionalIntro(paragraph) {
  const s = String(paragraph || '').trim();
  if (!s || s.length > 850) return false;
  const award = /\b(?:best\s*book(?:\s*of\s*the\s*year)?|book\s*of\s*the\s*year|bestseller|editors?['’]?\s*choice|must[\s-]*read|summer\s*read|prize\s*winner|award\s*winner|award\s*finalist|prize\s*finalist|shortlisted\s*for|longlisted\s*for)\b/i;
  // Awards and publisher superlatives, sometimes separated by * or •.
  if (/^(?:[\s*•]*)(?:a\s+)?(?:new\s+york\s+times|pulitzer|kirkus|national\s+book|#\s*1|no\.?\s*1)\b/i.test(s) && award.test(s)) return true;
  if (/^[*•]\s*.+/s.test(s) && award.test(s)) return true;
  // Short review quotations explicitly attributed to a newspaper or reviewer.
  const outlet = /(?:\b(?:the\s+)?(?:guardian|daily\s+mail|new\s+york\s+times|the\s+atlantic|chicago\s+tribune|times\s+literary\s+supplement|the\s+economist|financial\s+times|kirkus\s+reviews|publishers\s+weekly|the\s+new\s+yorker|washington\s+post)\b)[.!\s]*$/i;
  if (s.length < 420 && outlet.test(s) && (/['‘’“”"]/.test(s) || /\b(?:plotted|brilliant|poignant|superb|funny|masterpiece|dazzling|riveting|captivating|moving|caustic)\b/i.test(s))) return true;
  if (s.length < 600 && /^['‘“"]/.test(s) && /(?:—|-|–)\s*(?:the\s+)?(?:atlantic|new\s+york\s+times|guardian|chicago\s+tribune)/i.test(s)) return true;
  // One paragraph containing multiple short, credited press quotations.
  if (/^['‘“\"]/.test(s) && (s.match(/[•] /g)||[]).length >= 2 && /\b(?:New York Times|Atlantic|Chicago Tribune|Guardian)\b/i.test(s)) return true;
  return false;
}

export function prepareDescriptionForDisplay(input, source) {
  const original = normalizeBookDescription(input);
  const fallback = {text: original, omittedIntro: ''};
  if (source !== 'Apple Books' || !original) return fallback;
  const parts = original.split(/\n{2,}/).map(x => x.trim()).filter(Boolean);
  if (parts.length < 2) return fallback;
  let cut = 0;
  while (cut < parts.length - 1 && isPromotionalIntro(parts[cut])) cut++;
  // Don't discard text unless there is an actual substantial plot paragraph.
  if (!cut || !parts[cut] || parts[cut].length < 100) return fallback;
  return {text: parts.slice(cut).join('\n\n'), omittedIntro: parts.slice(0, cut).join('\n\n')};
}
