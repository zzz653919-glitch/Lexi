/* Lesson engine, part 2 (no DOM): exercise item factories, the guided-lesson sequence, answer checking for
   sentences and the mistake-review scheduler. Extends VL.learn from learn-engine.js. */
(function () {
  const E = VL.learn;
  const { uid, shuffle } = VL.util;
  const primary = E.primary;
  const RANK = { A1: 1, A2: 2, B1: 3, B2: 4 };
  const LEVEL_OF_RANK = ['', 'A1', 'A2', 'B1', 'B2'];
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /* ---------- sentence normalisation & checking ---------- */
  const CONTRACTIONS = [
    ["i'm", 'i am'], ["you're", 'you are'], ["he's", 'he is'], ["she's", 'she is'], ["it's", 'it is'], ["we're", 'we are'], ["they're", 'they are'],
    ["that's", 'that is'], ["there's", 'there is'], ["don't", 'do not'], ["doesn't", 'does not'], ["didn't", 'did not'], ["can't", 'cannot'], ["won't", 'will not'],
    ["isn't", 'is not'], ["aren't", 'are not'], ["wasn't", 'was not'], ["weren't", 'were not'], ["haven't", 'have not'], ["hasn't", 'has not'],
    ["i've", 'i have'], ["we've", 'we have'], ["they've", 'they have'], ["you've", 'you have'], ["i'll", 'i will'], ["we'll", 'we will'], ["they'll", 'they will'],
    ["she'll", 'she will'], ["he'll", 'he will'], ["it'll", 'it will'], ["i'd", 'i would'],
  ];
  const UZ_SUBJECTS = new Set(['men', 'sen', 'u', 'biz', 'siz', 'ular']);

  function normSentence(text, lang, lenient) {
    let s = VL.quiz.normalize(text, lenient).replace(/[.,!?;:"“”()]/g, ' ').replace(/\s+/g, ' ').trim();
    if (lang === 'en') {
      CONTRACTIONS.forEach(([a, b]) => { s = s.split(a).join(b); });
      s = s.replace(/\bcan not\b/g, 'cannot');
    }
    return s.replace(/\s+/g, ' ').trim();
  }
  function stripSubject(s) {
    const parts = s.split(' ');
    return parts.length > 1 && UZ_SUBJECTS.has(parts[0]) ? parts.slice(1).join(' ') : s;
  }

  /* Checks a typed sentence against the accepted alternatives.
     -> { correct, typo (one letter off, still accepted), closest (nearest accepted sentence) } */
  function checkSentence(input, alternatives, lang, lenient) {
    const user = normSentence(input, lang, lenient);
    if (!user) return { correct: false, typo: false, closest: alternatives[0] };
    let closest = alternatives[0], best = Infinity;
    for (const alt of alternatives) {
      const cand = normSentence(alt, lang, lenient);
      if (user === cand) return { correct: true, typo: false, closest: alt };
      if (lang === 'uz' && stripSubject(user) === stripSubject(cand)) return { correct: true, typo: false, closest: alt };
    }
    for (const alt of alternatives) {
      const cand = normSentence(alt, lang, lenient);
      const d = Math.min(E.editDistance(user, cand), lang === 'uz' ? E.editDistance(stripSubject(user), stripSubject(cand)) : Infinity);
      if (d < best) { best = d; closest = alt; }
      if (d === 1 && cand.length >= 12) return { correct: true, typo: true, closest: alt };
    }
    return { correct: false, typo: false, closest };
  }

  // Words of an English sentence as tiles (final punctuation removed).
  const sentenceTokens = (en) => en.replace(/[.?!]+$/, '').split(/\s+/).filter(Boolean);

  /* ---------- tile helpers ---------- */
  function tilesFrom(tokens, uppercase) {
    const make = () => shuffle(tokens.map((text, i) => ({ id: 't' + i, text: uppercase ? text.toUpperCase() : text })));
    let tiles = make();
    for (let k = 0; k < 12 && tiles.every((t, i) => t.id === 't' + i) && tokens.length > 1 && new Set(tokens).size > 1; k++) tiles = make();
    return tiles;
  }

  /* ---------- item factories (all return plain JSON so a paused lesson can be saved) ---------- */
  const base = (type, extra) => Object.assign({ id: uid(), type, wordIds: [], sentenceId: null, dir: 'en-uz', retry: false }, extra);

  const mk = {
    learn: (w) => base('learn', { wordIds: [w.id] }),
    choose(w, all, avoidIndex) {
      const options = E.choices(w, all);
      if (!options) return null;
      if (avoidIndex != null && options.findIndex((o) => o.correct) === avoidIndex) options.push(options.shift()); // never the same slot twice in a row
      return base('choose', { wordIds: [w.id], options });
    },
    scramble(w) {
      const en = w.en.trim();
      if (!/^\p{L}{3,12}$/u.test(en)) return null;
      return base('scramble', { wordIds: [w.id], tiles: tilesFrom(Array.from(en), true) });
    },
    wordType: (type, w) => base(type, { wordIds: [w.id], dir: type === 'reverse' ? 'uz-en' : type === 'type' ? (Math.random() < 0.5 ? 'en-uz' : 'uz-en') : 'en-uz' }),
    fill(w) { const mask = E.maskWord(w.en); return mask ? base('fill', { wordIds: [w.id], mask }) : null; },
    match: (words) => E.makeMatch(words),
    listenWord(w, all) {
      const others = shuffle(all.filter((x) => x.id !== w.id && !/\s/.test(x.en.trim()) && x.en.toLowerCase() !== w.en.toLowerCase()));
      const seen = new Set([w.en.toLowerCase()]);
      const wrong = [];
      for (const x of others) { if (!seen.has(x.en.toLowerCase())) { seen.add(x.en.toLowerCase()); wrong.push(x.en); } if (wrong.length === 3) break; }
      if (wrong.length < 3 || /\s/.test(w.en.trim())) return base('listen', { wordIds: [w.id], variant: 'type' });
      return base('listen', { wordIds: [w.id], variant: 'choose', options: shuffle([w.en].concat(wrong)).map((text) => ({ text, correct: text === w.en })) });
    },
    listenSentence: (s) => base('listen', { sentenceId: s.id, variant: 'sentence' }),
    sentEnUz: (s) => base('sentEnUz', { sentenceId: s.id, dir: 'en-uz' }),
    sentUzEn: (s) => base('sentUzEn', { sentenceId: s.id, dir: 'uz-en' }),
    order(s) {
      const tokens = sentenceTokens(s.en);
      if (tokens.length < 3) return null;
      return base('order', { sentenceId: s.id, dir: 'uz-en', tiles: tilesFrom(tokens, false) });
    },
    cloze(s) {
      if (!s.cloze) return null;
      return base('cloze', { sentenceId: s.id, options: shuffle(s.cloze.options.slice()).map((text) => ({ text, correct: text === s.cloze.answer })) });
    },
  };

  /* ---------- sentence picking ---------- */
  function levelFor(words) {
    let rank = 1;
    words.forEach((w) => {
      const c = VL.store.collection(w.collectionId);
      const lv = c && c.deckKey ? c.deckKey.split('.')[0] : null;
      if (lv && RANK[lv]) rank = Math.max(rank, RANK[lv]);
    });
    return LEVEL_OF_RANK[rank];
  }

  function pickSentences(focus, level, count, seen) {
    const keys = new Set();
    focus.forEach((w) => keys.add(w.en.trim().toLowerCase()));
    const maxRank = RANK[level] || 1;
    const scored = VL.sentences.filter((s) => RANK[s.level] <= maxRank).map((s) => ({
      s,
      score: (s.words.some((k) => keys.has(k)) ? 10 : 0) + (s.level === level ? 3 : 0) + (seen.includes(s.id) ? -12 : 0) + Math.random() * 2,
    })).sort((a, b) => b.score - a.score);
    return scored.slice(0, count).map((x) => x.s);
  }

  /* ---------- guided lesson ---------- */
  /* cfg: { words (pool), length 10..15, speech: bool, history: [sentence ids used lately] }
     The lesson introduces new words first, then mixes ten kinds of exercises (word and sentence based),
     never repeating the same kind or the same word back to back. Mistakes are added near the end while playing. */
  function buildGuided(cfg, allWords) {
    const N = clamp(cfg.length || 12, 10, 15);
    const k = Math.min(cfg.words.length, N <= 10 ? 3 : N <= 12 ? 4 : 5);
    const focus = VL.srs.pick(cfg.words, k);
    if (!focus.length) return { items: [], wordIds: [], newCount: 0 };
    const level = levelFor(focus);
    const sents = pickSentences(focus, level, 5, cfg.history || []);
    const clozeS = sents.filter((s) => s.cloze);
    const learns = focus.filter((w) => !w.reps).slice(0, 3).map(mk.learn);
    const need = N - learns.length;

    const W = (i) => focus[i % focus.length];
    const factories = [
      () => mk.choose(W(0), allWords),
      () => { const w = focus.find((x) => /^\p{L}{3,12}$/u.test(x.en.trim())); return w ? mk.scramble(w) : null; },
      () => (sents[0] ? mk.sentEnUz(sents[0]) : null),
      () => (cfg.speech ? mk.listenWord(W(1), allWords) : null),
      () => (clozeS[0] ? mk.cloze(clozeS[0]) : null),
      () => mk.wordType('translate', W(1)),
      () => { const extra = cfg.words.filter((w) => !focus.includes(w)); const group = focus.concat(extra).slice(0, 5); return group.length >= 3 ? mk.match(group) : null; },
      () => { const s = sents[1] || sents[0]; return s ? mk.order(s) : null; },
      () => { const s = sents[2] || sents[0]; return s ? mk.sentUzEn(s) : null; },
      () => (cfg.speech && sents[0] ? mk.listenSentence(sents[3] || sents[0]) : null),
      // second round
      () => mk.choose(W(2), allWords),
      () => { const w = focus.filter((x) => /^\p{L}{3,12}$/u.test(x.en.trim()))[1]; return w ? mk.scramble(w) : null; },
      () => (clozeS[1] ? mk.cloze(clozeS[1]) : null),
      () => mk.wordType('reverse', W(2)),
      () => mk.fill(W(3)),
      () => { const s = sents[3] || sents[1]; return s ? mk.order(s) : null; },
      () => mk.choose(W(3), allWords),
    ];
    const rest = [];
    for (const f of factories) { if (rest.length >= need) break; const it = f(); if (it) rest.push(it); }
    return { items: sequence(learns, rest), wordIds: focus.map((w) => w.id), newCount: learns.length, sentenceIds: sents.map((s) => s.id) };
  }

  /* Orders the items: each new word is introduced right before it is used, no two neighbours share a
     type or a word, and the order differs from lesson to lesson. */
  function sequence(learns, rest) {
    const total = learns.length + rest.length;
    const introduced = new Set();
    const newIds = new Set(learns.map((l) => l.wordIds[0]));
    const pending = learns.slice();
    const remaining = rest.slice();
    const out = [];
    let prev = null;
    const clash = (a, b) => b && (a.type === b.type || a.wordIds.some((id) => b.wordIds.includes(id)));
    const usable = (it) => it.wordIds.every((id) => !newIds.has(id) || introduced.has(id));

    while (out.length < total) {
      let pick = null;
      const wantLearn = pending.length && (out.length === 0 || (prev && prev.type !== 'learn' && out.length >= 2 && (Math.random() < 0.5 || out.length >= Math.floor(total * 0.45))));
      if (wantLearn) { pick = pending.shift(); introduced.add(pick.wordIds[0]); }
      else {
        const ok = remaining.filter(usable);
        const fresh = ok.filter((it) => !clash(it, prev));
        let pool = fresh.length ? fresh : ok;
        // right after meeting a word, practise that very word
        if (prev && prev.type === 'learn') { const same = pool.filter((it) => it.wordIds.includes(prev.wordIds[0])); if (same.length) pool = same; }
        if (!pool.length) { if (pending.length) { pick = pending.shift(); introduced.add(pick.wordIds[0]); } else break; }
        else {
          // earlier (higher priority) items are more likely, but the order is not fixed
          const weights = pool.map((it) => 1 + Math.max(0, remaining.length - remaining.indexOf(it)));
          let r = Math.random() * weights.reduce((a, b) => a + b, 0), i = 0;
          while (i < pool.length - 1 && (r -= weights[i]) > 0) i++;
          pick = pool[i];
          remaining.splice(remaining.indexOf(pick), 1);
        }
      }
      out.push(pick); prev = pick;
    }
    return repair(out, newIds);
  }

  // two neighbours clash when they are the same kind or practise the same word (right after "learn" that is wanted)
  const clashPair = (a, b) => !!a && !!b && (a.type === b.type || (a.type !== 'learn' && a.type !== 'match' && b.type !== 'match' && a.wordIds.some((id) => b.wordIds.includes(id))));
  function depsOk(list, newIds) {
    const intro = new Set();
    return list.every((it) => { if (it.type === 'learn') { intro.add(it.wordIds[0]); return true; } return it.wordIds.every((id) => !newIds.has(id) || intro.has(id)); });
  }
  // fixes neighbours that still clash by swapping them with items elsewhere in the lesson
  function repair(list, newIds) {
    const bad = (i) => (i > 0 && clashPair(list[i - 1], list[i]));
    for (let pass = 0; pass < 4; pass++) {
      let changed = false;
      for (let i = 1; i < list.length; i++) {
        if (!bad(i)) continue;
        for (let j = 0; j < list.length && bad(i); j++) {
          if (j === i) continue;
          [list[i], list[j]] = [list[j], list[i]];
          const fine = !bad(i) && !(i + 1 < list.length && clashPair(list[i], list[i + 1])) && !bad(j) && !(j + 1 < list.length && clashPair(list[j], list[j + 1])) && depsOk(list, newIds);
          if (fine) changed = true; else [list[i], list[j]] = [list[j], list[i]];
        }
      }
      if (!changed) break;
    }
    return list;
  }

  /* ---------- mistake review ---------- */
  /* After a wrong answer: a different kind of exercise for the same word or sentence. */
  function reviewItemFor(item, allWords, speech) {
    if (item.sentenceId) {
      const s = VL.sentenceById(item.sentenceId);
      if (!s) return null;
      const options = ['cloze', 'order', 'sentEnUz', 'sentUzEn'].filter((t) => t !== item.type && (t !== 'cloze' || s.cloze));
      const type = options[Math.floor(Math.random() * options.length)];
      const it = mk[type](s);
      if (it) it.retry = true;
      return it;
    }
    const w = VL.store.word(item.wordIds[0]);
    if (!w) return null;
    const types = ['choose', 'scramble', 'translate', 'reverse', 'fill'].concat(speech ? ['listenWord'] : []).filter((t) => t !== item.type && !(t === 'listenWord' && item.type === 'listen'));
    for (const type of shuffle(types)) {
      const it = type === 'choose' ? mk.choose(w, allWords) : type === 'scramble' ? mk.scramble(w) : type === 'fill' ? mk.fill(w) : type === 'listenWord' ? mk.listenWord(w, allWords) : mk.wordType(type, w);
      if (it) { it.retry = true; return it; }
    }
    return null;
  }

  // Puts a review item near the end of the queue without placing it next to a similar one.
  function insertReview(items, index, it) {
    let pos = Math.max(index + 2, items.length - 1 - Math.floor(Math.random() * 2));
    pos = Math.min(pos, items.length);
    const similar = (a, b) => a && b && (a.type === b.type || a.wordIds.some((id) => b.wordIds.includes(id)) || (a.sentenceId && a.sentenceId === b.sentenceId));
    while (pos < items.length && (similar(items[pos - 1], it) || similar(items[pos], it))) pos++;
    items.splice(pos, 0, it);
    return pos;
  }

  /* A lesson that practises one kind of exercise only (the "Practise one exercise type" cards). */
  function buildSingle(type, cfg, allWords) {
    const size = cfg.size || 10;
    const legacy = ['choose', 'type', 'translate', 'fill', 'match', 'reverse', 'review', 'mixed'];
    if (legacy.includes(type)) {
      const b = E.buildLesson({ type, size, words: cfg.words }, allWords);
      return { items: b.items, wordIds: [], newCount: b.newCount, sentenceIds: [] };
    }
    const eligible = type === 'scramble' ? cfg.words.filter((w) => /^\p{L}{3,12}$/u.test(w.en.trim())) : cfg.words;
    if (type === 'scramble') {
      const chosen = VL.srs.pick(eligible, size);
      return { items: chosen.map((w) => mk.scramble(w)).filter(Boolean), wordIds: chosen.map((w) => w.id), newCount: chosen.filter((w) => !w.reps).length, sentenceIds: [] };
    }
    if (type === 'listen') {
      if (!cfg.speech) return { items: [], wordIds: [], newCount: 0, sentenceIds: [] };
      const chosen = VL.srs.pick(eligible, Math.ceil(size / 2));
      const sents = pickSentences(chosen, levelFor(chosen), Math.floor(size / 2), cfg.history || []);
      const items = sequence([], chosen.map((w) => mk.listenWord(w, allWords)).concat(sents.map((s) => mk.listenSentence(s))));
      return { items, wordIds: chosen.map((w) => w.id), newCount: chosen.filter((w) => !w.reps).length, sentenceIds: sents.map((s) => s.id) };
    }
    // sentence based: sentEnUz, sentUzEn, order, cloze
    const focus = VL.srs.pick(cfg.words, Math.min(cfg.words.length, 5));
    const sents = pickSentences(focus, levelFor(focus), size, cfg.history || []);
    const make = { sentEnUz: mk.sentEnUz, sentUzEn: mk.sentUzEn, order: mk.order, cloze: mk.cloze }[type];
    const items = sents.map((s) => make(s)).filter(Boolean).slice(0, size);
    return { items, wordIds: focus.map((w) => w.id), newCount: 0, sentenceIds: sents.map((s) => s.id) };
  }


  /* ---------- custom sessions ---------- */
  const CUSTOM_TYPES = ['translate', 'choose', 'scramble', 'order', 'listen', 'fill', 'match'];
  const CUSTOM_DEFAULT = ['translate', 'choose', 'scramble', 'fill', 'listen', 'match'];

  /* cfg: { words (the session's words), count: 5|10|15|20|'all', types: [custom types], speech: bool }
     Builds exactly `count` exercises (for 'all': one per word, at least 5 when there are only a few words).
     With few words the words are reused, but a word never comes twice in a row and each reuse gets a different
     kind of exercise; with many words nothing repeats. Matching counts as one exercise (up to 4 words). */
  function buildCustom(cfg, allWords) {
    const words = cfg.words.filter(Boolean);
    if (!words.length) return { items: [], wordIds: [], newCount: 0, sentenceIds: [] };
    const want = CUSTOM_TYPES.filter((t) => (cfg.types || []).includes(t));
    const types = (want.length ? want : CUSTOM_DEFAULT).filter((t) => t !== 'listen' || cfg.speech);
    const total = cfg.count === 'all' ? Math.max(words.length, 1) : Math.max(1, Number(cfg.count) || 10);
    const used = new Map(); // wordId -> types already used for it
    const items = [];
    const sentenceIds = [];
    let deck = [], last = null;
    const nextWord = () => {
      if (!deck.length) {
        deck = shuffle(words.slice());
        if (last && deck.length > 1 && deck[deck.length - 1].id === last.id) deck.unshift(deck.pop()); // popped first -> avoid repeat across rounds
      }
      last = deck.pop();
      return last;
    };
    const sentenceFor = (w) => {
      const key = w.en.trim().toLowerCase();
      const hits = (VL.sentences || []).filter((s) => s.words.includes(key) && !sentenceIds.includes(s.id));
      return hits.length ? hits[Math.floor(Math.random() * hits.length)] : null;
    };
    const make = (type, w) => {
      if (type === 'translate') return mk.wordType((used.get(w.id) || []).includes('translate') ? 'reverse' : 'translate', w);
      if (type === 'choose') return mk.choose(w, allWords);
      if (type === 'scramble') return mk.scramble(w);
      if (type === 'fill') return mk.fill(w);
      if (type === 'listen') return mk.listenWord(w, allWords);
      if (type === 'order') { const s = sentenceFor(w); const it = s ? mk.order(s) : null; if (it) sentenceIds.push(s.id); return it; }
      if (type === 'match') {
        const others = shuffle(words.filter((x) => x.id !== w.id)).concat(shuffle(allWords.filter((x) => x.id !== w.id && !words.includes(x))));
        const group = [w].concat(others.slice(0, 3));
        return group.length >= 2 ? mk.match(group) : null;
      }
      return null;
    };
    for (let i = 0; i < total; i++) {
      const w = nextWord();
      const prev = items.length ? items[items.length - 1].type : null;
      const tried = used.get(w.id) || [];
      // prefer a kind this word has not had yet and that differs from the previous exercise
      const order = shuffle(types.slice()).sort((a, b) => (tried.includes(a) - tried.includes(b)) || ((a === prev) - (b === prev)));
      let it = null, kind = null;
      for (const t of order.concat(['translate', 'choose'])) { it = make(t, w); if (it) { kind = t; break; } }
      if (!it) continue;
      used.set(w.id, tried.concat(kind));
      items.push(it);
    }
    const ids = Array.from(new Set(items.flatMap((it) => it.wordIds)));
    return { items, wordIds: ids, newCount: words.filter((w) => !w.reps).length, sentenceIds };
  }


  /* ---------- mixed exercise: six steps for every word, one word after another ---------- */
  const MIX_STEPS = ['choose', 'type', 'translate', 'fill', 'match', 'reverse'];

  /* cfg: { words }. For each word: 1 choose the translation, 2 type the translation (en->uz), 3 translate
     the Uzbek word into English, 4 fill the missing letters, 5 match pairs, 6 Uzbek (another form) -> English.
     Always exactly 6 items per word, in this order; the word is finished before the next one starts. */
  function buildMixed(cfg, allWords) {
    const words = cfg.words.filter(Boolean);
    const items = [];
    words.forEach((w, i) => {
      const others = words.slice(i + 1).concat(words.slice(0, i)).concat(shuffle(allWords.filter((x) => !words.includes(x))));
      const group = [w].concat(others.slice(0, 3));
      const steps = {
        choose: () => mk.choose(w, allWords),
        type: () => Object.assign(mk.wordType('type', w), { dir: 'en-uz' }),
        translate: () => Object.assign(mk.wordType('translate', w), { dir: 'uz-en' }),
        fill: () => mk.fill(w),
        match: () => (group.length >= 2 ? Object.assign(mk.match(group), { focusId: w.id }) : null),
        reverse: () => { const it = Object.assign(mk.wordType('reverse', w), { dir: 'uz-en' }); const v = VL.answers && VL.answers.promptVariant(w); if (v) it.prompt = v; return it; },
      };
      items.push(Object.assign(base('study', { wordIds: [w.id] }), { mixStep: 0, mixWord: i }));
      MIX_STEPS.forEach((k, step) => {
        // a step that cannot be built (e.g. a one-letter word has nothing to fill) becomes a typed translation, so every word keeps six exercises
        const it = steps[k]() || Object.assign(mk.wordType('type', w), { dir: step % 2 ? 'uz-en' : 'en-uz' });
        it.mixStep = step + 1; it.mixWord = i;
        items.push(it);
      });
    });
    return { items, wordIds: words.map((w) => w.id), newCount: words.filter((w) => !w.reps).length, sentenceIds: [] };
  }

  Object.assign(E, { buildMixed, MIX_STEPS, buildCustom, CUSTOM_TYPES, CUSTOM_DEFAULT, buildSingle, checkSentence, normSentence, sentenceTokens, tilesFrom, mk, levelFor, pickSentences, buildGuided, sequence, reviewItemFor, insertReview, GUIDED_LENGTHS: [10, 12, 15] });
})();
