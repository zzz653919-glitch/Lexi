/* Answer checking for translations, kept separate from the UI so every exercise (and the old Practice page)
   uses the same rules. No AI and no network: everything is decided locally from the stored vocabulary.

   A word can carry: a main translation (several can be separated by ";"), extra correct translations,
   translations that are only correct in a given context ("boy bermoq | o'yinda"), a note about its meaning
   in context, and a part of speech.

   Rules (see tests/answer-check.test.js for examples):
   - capital letters, extra spaces, simple punctuation and apostrophe styles (o' o‘ oʻ) never matter;
   - an Uzbek verb is accepted in both common forms: yo'qotmoq = yo'qotish, boshlamoq = boshlash;
   - every stored translation is accepted, but a context-only translation is accepted only in that context;
   - an answer is never accepted just because it looks similar: one-letter slips are accepted only in long
     answers, only in "careful" mode, and never when the typed text is itself a different known word. */
VL.answers = (function () {
  const Q = VL.quiz;
  const POS = ['noun', 'verb', 'adjective', 'adverb', 'preposition', 'pronoun', 'conjunction', 'phrase', 'phrasal verb', 'other'];
  const MAX_ALTS = 12;

  /* ---------- text helpers ---------- */
  const clean = (s) => String(s == null ? '' : s).replace(/[   ]/g, ' ').replace(/\s+/g, ' ').trim();
  // comparison form: lower case, one apostrophe style, no accents/punctuation, single spaces
  function norm(s, lenient) {
    return Q.normalize(s, lenient).replace(/[.,!?;:"“”()\[\]\-–—]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const endsWithVowel = (stem) => /[aeiou]'?$/.test(stem) || /o'$/.test(stem);

  /* Uzbek verb: the infinitive (-moq), the verbal noun (-ish / -sh) and the participle (-gan / -kan / -qan,
     "buzilmoq" = "buzilish" = "buzilgan") are treated as forms of the same word.
     Returns the other forms of a normalised phrase (only its last word changes). */
  function verbForms(phrase) {
    const parts = phrase.split(' ');
    const last = parts.pop();
    let stem = null;
    if (last.length >= 5 && last.endsWith('moq')) stem = last.slice(0, -3);
    else if (last.length >= 6 && last.endsWith('ish')) stem = last.slice(0, -3);
    else if (last.length >= 5 && last.endsWith('sh') && /[aeiou]'?$/.test(last.slice(0, -2))) stem = last.slice(0, -2);
    else if (last.length >= 6 && /(gan|kan|qan)$/.test(last)) stem = last.slice(0, -3);
    if (!stem || stem.length < 2) return [];
    const part = stem + (/k$/.test(stem) ? 'kan' : /q$/.test(stem) ? 'qan' : 'gan');
    const forms = [stem + 'moq', stem + (endsWithVowel(stem) ? 'sh' : 'ish'), part].filter((f) => f !== last);
    return forms.map((f) => parts.concat(f).join(' '));
  }

  /* Everyday Uzbek words/phrases that are interchangeable in an answer ("haddan ortiq ko'p" = "juda ko'p").
     Only pairs whose meaning is the same in a translation exercise (not near-synonyms such as happy/glad). */
  const SYNONYMS = [
    // intensifiers, quantity
    ['juda', 'haddan ortiq', 'haddan tashqari', 'nihoyatda', "g'oyat", 'behad'],
    ['kam', 'oz'], ['bir oz', 'biroz', 'ozgina'], ['hamma', 'barcha'], ['boshqa', "o'zga"],
    // time and frequency
    ['bugun', 'hozirgi kunda'], ['hozir', 'hozirda', 'ayni paytda'], ['hamisha', 'doim', 'doimo'], ["ba'zan", "ba'zida"],
    ["tez-tez", "ko'pincha"], ['darhol', 'zudlik bilan'], ['qish', 'qish fasli'], ['yoz', 'yoz fasli'], ['bahor', 'bahor fasli'], ['kuz', 'kuz fasli'],
    // linking words, replies
    ['lekin', 'ammo', 'biroq'], ['va', 'hamda'], ['agar', 'basharti'], ['albatta', 'shubhasiz'], ['ehtimol', 'balki'],
    ['salom', 'assalomu alaykum'], ['xayr', "xayr-xo'sh"], ['rahmat', 'tashakkur'],
    // adjectives
    ['katta', 'yirik'], ['kichik', 'kichkina'], ['chiroyli', "go'zal", "ko'rkam"], ['sekin', 'asta'], ['xavfli', 'havfli'],
    ['qiyin', 'mushkul'], ['oson', 'yengil'], ['kuchli', 'qudratli'], ['zaif', 'kuchsiz'], ['tinch', 'sokin', 'osoyishta'],
    ['boy', 'badavlat'], ["kambag'al", 'qashshoq'], ['aqlli', 'zehnli'], ['dangasa', 'yalqov'], ['mazali', 'totli', 'lazzatli'], ['muhim', 'ahamiyatli'],
    // nouns
    ['odam', 'kishi', 'inson'], ["o'qituvchi", 'ustoz', 'muallim'], ['shifokor', 'doktor', 'vrach'], ['mashina', 'avtomobil'],
    ['dunyo', 'olam', 'jahon'], ['mamlakat', 'davlat'], ['ovqat', 'taom'], ['nonushta', 'ertalabki ovqat'], ['yordam', "ko'mak"], ['samolyot', 'tayyora'],
    // verbs (infinitive forms; -ish / -gan forms are handled by verbForms)
    ['izlamoq', 'qidirmoq'], ['tugatmoq', 'yakunlamoq', 'tamomlamoq'], ['sotib olmoq', 'xarid qilmoq'], ['tuzatmoq', "ta'mirlamoq"],
    ['tushunmoq', 'anglamoq'], ["o'ylamoq", 'fikr qilmoq'], ['aytmoq', 'demoq'], ['qaramoq', 'boqmoq'], ['dam olmoq', 'hordiq chiqarmoq'],
    ['yordam bermoq', "ko'maklashmoq"],
  ];
  const swapSynonyms = (phrase) => {
    const out = [];
    const padded = ' ' + phrase + ' ';
    SYNONYMS.forEach((group) => group.forEach((a) => {
      if (!padded.includes(' ' + a + ' ')) return;
      group.forEach((b) => { if (b !== a) out.push(padded.replace(' ' + a + ' ', ' ' + b + ' ').trim()); });
    }));
    return out;
  };

  const withoutParens = (s) => s.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();

  // "text | context" lines -> [{ text, context }]
  function parseAlts(text) {
    return String(text == null ? '' : text).split(/\r?\n/).map((line) => {
      const i = line.indexOf('|');
      const t = clean(i === -1 ? line : line.slice(0, i));
      const c = i === -1 ? '' : clean(line.slice(i + 1));
      return t ? { text: t, context: c } : null;
    }).filter(Boolean);
  }
  const formatAlts = (alts) => (alts || []).map((a) => (a.context ? a.text + ' | ' + a.context : a.text)).join('\n');

  /* ---------- what a word accepts ---------- */
  // normalised keys (with grammatical forms) for a list of display strings
  function keysFor(texts, lenient) {
    const keys = new Map(); // key -> display text it came from
    texts.forEach((text) => {
      const base = norm(text, lenient);
      if (!base) return;
      const variants = new Set([base, norm(withoutParens(text), lenient)]);
      Array.from(variants).forEach((v) => verbForms(v).forEach((f) => variants.add(f)));
      Array.from(variants).forEach((v) => swapSynonyms(v).forEach((f) => variants.add(f)));
      variants.forEach((v) => { if (v && !keys.has(v)) keys.set(v, text); });
    });
    return keys;
  }

  const altsOf = (word) => (Array.isArray(word.alts) ? word.alts : []);
  const contextsOf = (word) => Array.from(new Set(altsOf(word).filter((a) => a.context).map((a) => a.context)));

  /* general: main translation(s) + extra translations that are right in any context
     contextual: { context -> [texts] } */
  function accepted(word) {
    const main = Q.acceptedAnswers(word.uz);
    const general = main.concat(altsOf(word).filter((a) => !a.context).map((a) => a.text));
    const contextual = {};
    altsOf(word).filter((a) => a.context).forEach((a) => { (contextual[a.context] = contextual[a.context] || []).push(a.text); });
    return { primary: main[0] || clean(word.uz), general, contextual };
  }

  // lines for "the right answer was ..." feedback: [main, "also accepted" list]
  function describe(word, context) {
    const a = accepted(word);
    if (context && a.contextual[context]) return { main: a.contextual[context][0], others: a.contextual[context].slice(1) };
    const others = a.general.filter((x) => norm(x) !== norm(a.primary));
    return { main: a.primary, others: others.slice(0, 4), contextual: Object.keys(a.contextual).map((c) => ({ context: c, texts: a.contextual[c] })) };
  }

  /* ---------- typo policy ---------- */
  function editDistance(a, b) {
    const m = a.length, n = b.length;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }
  const typoMode = () => (VL.store && VL.store.state.settings.typoMode) || 'careful';

  // all translations of all words, so a typo that spells a different known word is never accepted
  function knownTranslationKeys(exceptWordId) {
    const set = new Set();
    if (!VL.store) return set;
    VL.store.state.words.forEach((w) => {
      if (w.id === exceptWordId) return;
      const a = accepted(w);
      keysFor(a.general.concat(Object.values(a.contextual).flat())).forEach((_, k) => set.add(k));
    });
    return set;
  }

  /* ---------- checking a typed translation (English -> Uzbek) ---------- */
  /* opts: { context, lenient, typo: 'careful'|'strict' }
     -> { verdict, matched, note }   verdict: correct | typo | close | contextOnly | generalOnly | wrong | empty */
  function checkTranslation(input, word, opts) {
    const o = opts || {};
    const lenient = o.lenient !== undefined ? o.lenient : true;
    const typed = norm(input, lenient);
    if (!typed) return { verdict: 'empty' };
    const a = accepted(word);
    const ctx = o.context || '';
    const generalKeys = keysFor(a.general, lenient);
    const ctxKeys = new Map();
    Object.keys(a.contextual).forEach((c) => keysFor(a.contextual[c], lenient).forEach((txt, k) => { if (!ctxKeys.has(k)) ctxKeys.set(k, { text: txt, context: c }); }));

    const inContextKeys = ctx ? keysFor(a.contextual[ctx] || [], lenient) : generalKeys;
    const parts = String(input).split(/[;,]/).map((x) => norm(x, lenient)).filter(Boolean);
    const hit = (key) => inContextKeys.has(key);
    if (hit(typed) || (parts.length > 1 && parts.every(hit))) return { verdict: 'correct', matched: inContextKeys.get(typed) || inContextKeys.get(parts[0]) };

    // right word, wrong context
    if (!ctx && ctxKeys.has(typed)) return { verdict: 'contextOnly', matched: ctxKeys.get(typed).text, context: ctxKeys.get(typed).context };
    if (ctx && generalKeys.has(typed)) return { verdict: 'generalOnly', matched: generalKeys.get(typed) };

    // spelling slips: one letter off. Never accepted because of "similar letters" alone.
    let best = null;
    inContextKeys.forEach((txt, key) => {
      if (key.length < 5 || Math.abs(key.length - typed.length) > 1) return;
      if (editDistance(typed, key) === 1) best = best || { key, txt };
    });
    if (best) {
      const mode = o.typo || typoMode();
      const longEnough = best.key.length >= 9 && typed.length >= 8;
      const otherWord = knownTranslationKeys(word.id).has(typed);
      if (mode === 'careful' && longEnough && !otherWord) return { verdict: 'typo', matched: best.txt };
      return { verdict: 'close', matched: best.txt };
    }
    return { verdict: 'wrong' };
  }

  /* A second way to say the same Uzbek word, used as the prompt of the last mixed-exercise step
     (yo'qotmoq -> Yo'qotish). null when the word has no other form. */
  function promptVariant(word) {
    const main = Q.acceptedAnswers(word.uz)[0] || '';
    const base = norm(main, false);
    const forms = verbForms(base);
    const pick = forms.find((f) => /(ish|sh)$/.test(f)) || forms[0];
    if (pick && pick !== base) return pick.charAt(0).toUpperCase() + pick.slice(1);
    const alt = altsOf(word).find((a) => !a.context);
    return alt ? alt.text : null;
  }

  /* ---------- Uzbek -> English: which English words fit this Uzbek prompt? ---------- */
  function englishFor(promptText, word) {
    const key = norm(promptText, true);
    const list = [{ en: word.en, word, own: true }];
    if (!VL.store) return list;
    VL.store.state.words.forEach((w) => {
      if (w.id === word.id) return;
      const a = accepted(w);
      const keys = keysFor(a.general.concat(Object.values(a.contextual).flat()), true);
      if (keys.has(key)) list.push({ en: w.en, word: w, own: false });
    });
    return list;
  }

  /* checks a typed English word for an Uzbek prompt: the word itself, its alternatives ("to run / run"),
     and other words of the vocabulary that have the same Uzbek translation (uy = home = house). */
  function checkEnglish(input, word, promptText, opts) {
    const o = opts || {};
    const lenient = o.lenient !== undefined ? o.lenient : true;
    if (!norm(input, lenient)) return { verdict: 'empty' };
    const cands = englishFor(promptText || word.uz, word);
    for (const c of cands) {
      if (Q.check(input, c.en, lenient)) return c.own ? { verdict: 'correct', matched: c.en } : { verdict: 'correct', matched: c.en, synonymOf: c.word };
    }
    const typed = norm(input, lenient);
    const mode = o.typo || typoMode();
    for (const c of cands) {
      for (const alt of Q.acceptedAnswers(c.en)) {
        const k = norm(alt.replace(/^to /i, ''), lenient);
        const t2 = typed.replace(/^to /, '');
        if (k.length >= 5 && t2.length >= 4 && editDistance(t2, k) === 1) {
          const otherKnown = VL.store && VL.store.state.words.some((w) => w.id !== c.word.id && Q.acceptedAnswers(w.en).some((x) => norm(x, lenient) === t2));
          if (mode === 'careful' && k.length >= 8 && !otherKnown) return { verdict: 'typo', matched: c.en };
          return { verdict: 'close', matched: c.en };
        }
      }
    }
    return { verdict: 'wrong' };
  }

  /* one entry point for the exercises: dir 'en-uz' (answer in Uzbek) or 'uz-en' (answer in English) */
  function checkWord(input, word, opts) {
    const o = opts || {};
    return o.dir === 'uz-en' ? checkEnglish(input, word, o.prompt, o) : checkTranslation(input, word, o);
  }

  /* ---------- validation of what the user enters in the word dialog ---------- */
  function validateExtras(extras) {
    const alts = extras.alts || [];
    if (alts.length > MAX_ALTS) return 'err.altsMany';
    if (alts.some((a) => a.text.length > 200 || a.context.length > 100)) return 'err.altLong';
    if ((extras.sense || '').length > 200) return 'err.senseLong';
    if (extras.pos && !POS.includes(extras.pos)) return 'err.posBad';
    return null;
  }

  return { promptVariant, POS, MAX_ALTS, norm, verbForms, parseAlts, formatAlts, accepted, describe, contextsOf, checkTranslation, checkEnglish, checkWord, editDistance, validateExtras, englishFor };
})();
