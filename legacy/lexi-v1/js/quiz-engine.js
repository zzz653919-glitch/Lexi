/* Pure quiz logic (no DOM): answer normalisation, checking and queue building. */
VL.quiz = (function () {
  const APOSTROPHES = /[ʻʼ‘’′ʹ`´]/g; // ʻ ʼ ‘ ’ ′ ʹ ` ´ -> '

  function normalize(s, lenient) {
    let t = String(s == null ? '' : s).normalize('NFC').replace(APOSTROPHES, "'");
    t = t.replace(/\s+/g, ' ').trim().toLowerCase().replace(/[.!?]+$/, '').trim();
    if (lenient) t = t.normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC');
    return t;
  }

  const stripParens = (s) => s.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  const stripTo = (s) => s.replace(/^to /, '');

  // Reduce a string to the comparable forms of one answer.
  function forms(piece, lenient) {
    const base = normalize(piece, lenient);
    const set = new Set([base, stripParens(base)]);
    set.forEach((f) => set.add(stripTo(f)));
    set.delete('');
    return set;
  }

  // "salom; assalomu alaykum" or "run, flee" -> individual accepted answers.
  function acceptedAnswers(expected) {
    return String(expected).split(/[;,/|]/).map((s) => s.trim()).filter(Boolean);
  }

  function check(input, expected, lenient) {
    const typed = normalize(input, lenient);
    if (!typed) return false;
    const accepted = new Set();
    forms(expected, lenient).forEach((f) => accepted.add(f));
    acceptedAnswers(expected).forEach((a) => forms(a, lenient).forEach((f) => accepted.add(f)));
    const matches = (piece) => { for (const f of forms(piece, lenient)) if (accepted.has(f)) return true; return false; };
    if (matches(input)) return true;
    // Several answers typed at once: every one of them has to be acceptable.
    const parts = acceptedAnswers(input);
    return parts.length > 1 && parts.every(matches);
  }

  /* config: { words, direction: 'en-uz'|'uz-en'|'mixed', limit: number|0 }
     Each word appears at most once, so nothing repeats until the list is used up. */
  function buildQueue(config) {
    let list = VL.util.shuffle(config.words);
    if (config.limit > 0) list = list.slice(0, config.limit);
    return list.map((w) => ({
      wordId: w.id,
      dir: config.direction === 'mixed' ? (Math.random() < 0.5 ? 'en-uz' : 'uz-en') : config.direction,
    }));
  }

  return { normalize, check, acceptedAnswers, buildQueue };
})();
