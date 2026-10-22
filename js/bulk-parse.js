/* Bulk vocabulary parsing and checking (no DOM). Turns pasted text (Excel / Google Sheets / CSV / TSV /
   plain lists) into rows { en, uz, example } and validates them. Each output row comes from exactly one
   input line, so a translation can never drift onto another word. */
VL.bulk = (function () {
  const MAX_ROWS = 5000;
  const MAX_EN = 200, MAX_EXAMPLE = 300;
  const DASHES = [' — ', ' – ', ' - ', ' = ', '—', '–', ' | ', '|'];
  const HEADER_EN = new Set(['english', 'en', 'word', 'words', 'inglizcha', "inglizcha so'z", 'inglizcha soz', 'английский', 'слово']);
  const HEADER_OTHER = new Set(['uzbek', 'uz', 'translation', 'translations', "o'zbekcha", 'ozbekcha', "o'zbekcha tarjima", 'ozbekcha tarjima', 'tarjima', 'узбекский', 'перевод', '№', '#', 'no', 'no.', 'n', 'example', 'misol', 'collection', "to'plam", 'пример']);

  const clean = (s) => String(s == null ? '' : s).replace(/[   ]/g, ' ').replace(/\s+/g, ' ').trim();
  const unquote = (s) => { const t = clean(s); return t.length > 1 && t[0] === '"' && t[t.length - 1] === '"' ? clean(t.slice(1, -1).replace(/""/g, '"')) : t; };
  const dupKey = (s) => clean(s).toLowerCase();

  // Splits one line on a single-character delimiter, honouring "quoted, fields".
  function splitQuoted(line, delim) {
    const out = []; let cur = '', quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (quoted) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') quoted = false; else cur += ch; }
      else if (ch === '"' && cur.trim() === '') { quoted = true; cur = ''; }
      else if (ch === delim) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  }

  const count = (line, sep) => { let n = 0, i = line.indexOf(sep); while (i !== -1) { n++; i = line.indexOf(sep, i + sep.length); } return n; };

  /* Picks the separator that explains the text best: tab if any line has one (Excel paste), otherwise the
     candidate that splits most lines into exactly two parts (ties: the one that appears earlier in the lines). */
  function detectSeparator(lines) {
    if (lines.some((l) => l.includes('\t'))) return 'tab';
    const candidates = [{ id: 'semicolon', seps: [';'] }, { id: 'comma', seps: [','] }, { id: 'dash', seps: DASHES }];
    let best = null;
    candidates.forEach((c, priority) => {
      let single = 0, support = 0, firstSum = 0;
      lines.forEach((l) => {
        for (const sep of c.seps) {
          const k = count(l, sep);
          if (k > 0) { support++; if (k === 1) single++; firstSum += l.indexOf(sep); return; }
        }
      });
      if (!support) return;
      const score = { id: c.id, single, support, avgFirst: firstSum / support, priority };
      if (!best || score.single > best.single || (score.single === best.single && (score.avgFirst < best.avgFirst - 0.5 || (Math.abs(score.avgFirst - best.avgFirst) <= 0.5 && score.priority < best.priority)))) best = score;
    });
    return best ? best.id : 'none';
  }

  function splitLine(line, sep) {
    if (sep === 'none') return [line];
    if (sep === 'tab') return line.split('\t');
    if (sep === 'semicolon') return line.includes('"') ? splitQuoted(line, ';') : line.split(';');
    if (sep === 'comma') {
      if (line.includes('"')) return splitQuoted(line, ',');
      const i = line.indexOf(','); // translations may contain commas: split at the first one only
      return i === -1 ? [line] : [line.slice(0, i), line.slice(i + 1)];
    }
    for (const d of DASHES) { const i = line.indexOf(d); if (i > 0) return [line.slice(0, i), line.slice(i + d.length)]; }
    return [line];
  }

  /* parse(text, { separator: 'auto'|'tab'|'semicolon'|'comma'|'dash'|'none', max })
     -> { rows:[{ en, uz, example, line }], separator, blank, hadHeader, droppedNumbers, truncated } */
  function parse(text, opts) {
    const o = opts || {};
    const max = o.max || MAX_ROWS;
    const raw = String(text == null ? '' : text).replace(/^﻿/, '').split(/\r\n|\n|\r/);
    let blank = 0;
    const lines = [];
    raw.forEach((l, i) => {
      if (!clean(l) || /^#/.test(l.trim()) || /^\/\//.test(l.trim())) { blank++; return; }
      lines.push({ text: l.replace(/\s+$/, ''), no: i + 1 });
    });
    const sep = !o.separator || o.separator === 'auto' ? detectSeparator(lines.map((l) => l.text)) : o.separator;
    let cellRows = lines.map((l) => ({ no: l.no, cells: splitLine(l.text, sep).map(unquote) }));

    // header row (English | Uzbek translation | ...)
    let hadHeader = false;
    if (cellRows.length) {
      const first = cellRows[0].cells.map((c) => c.toLowerCase());
      const hasEn = first.some((c) => HEADER_EN.has(c));
      const multi = first.length >= 2 && first.filter((c) => HEADER_EN.has(c) || HEADER_OTHER.has(c)).length >= 2;
      if (multi || (first.length === 1 && (first[0] === 'english' || first[0] === 'inglizcha')) || (hasEn && first.length >= 2)) { hadHeader = true; cellRows.shift(); }
    }

    // a leading row-number column ("1", "2." ...) copied from a table
    let droppedNumbers = false;
    const multiCol = cellRows.filter((r) => r.cells.length >= 2);
    if (multiCol.length && multiCol.filter((r) => /^\d+[.)]?$/.test(r.cells[0])).length / multiCol.length >= 0.8) {
      cellRows = cellRows.map((r) => (/^\d+[.)]?$/.test(r.cells[0]) ? { no: r.no, cells: r.cells.slice(1) } : r));
      droppedNumbers = true;
    }
    // numbered English-only list: "1. problem"
    if (!droppedNumbers && cellRows.length && cellRows.filter((r) => /^\d+\s*[.)]\s+\S/.test(r.cells[0])).length / cellRows.length >= 0.8) {
      cellRows = cellRows.map((r) => ({ no: r.no, cells: [r.cells[0].replace(/^\d+\s*[.)]\s+/, ''), ...r.cells.slice(1)] }));
      droppedNumbers = true;
    }

    const rows = [];
    let truncated = false;
    for (const r of cellRows) {
      const [en = '', uz = '', example = ''] = r.cells;
      if (!en && !uz && !example) { blank++; continue; }
      if (rows.length >= max) { truncated = true; break; }
      rows.push({ en: clean(en), uz: clean(uz), example: clean(example), line: r.no });
    }
    return { rows, separator: sep, blank, hadHeader, droppedNumbers, truncated };
  }

  /* Checks rows against each other and against words already saved in the target collection.
     existing: Map(dupKey -> word) or null. Returns one status per row:
     { kind: 'ok'|'error'|'dup', code: 'ready'|'noEn'|'noUz'|'long'|'dupList'|'dupExisting', ref } */
  function validate(rows, existing) {
    const seen = new Map();
    return rows.map((r, i) => {
      const en = clean(r.en), uz = clean(r.uz);
      if (!en) return { kind: 'error', code: 'noEn' };
      if (!uz) return { kind: 'error', code: 'noUz' };
      if (en.length > MAX_EN || uz.length > MAX_EN || clean(r.example).length > MAX_EXAMPLE) return { kind: 'error', code: 'long' };
      const k = dupKey(en);
      if (seen.has(k)) return { kind: 'dup', code: 'dupList', ref: seen.get(k) + 1 };
      seen.set(k, i);
      const have = existing && existing.get(k);
      if (have) return { kind: 'dup', code: 'dupExisting', ref: have };
      return { kind: 'ok', code: 'ready' };
    });
  }

  /* Dictionary for "fill empty translations": your own words first, then the ready-made decks and samples.
     No online service or AI is involved. */
  function libraryDictionary() {
    const dict = new Map();
    const add = (en, uz) => { const k = dupKey(en); if (k && uz && !dict.has(k)) dict.set(k, uz); };
    if (VL.store) VL.store.state.words.forEach((w) => add(w.en, w.uz));
    if (VL.decks) Object.keys(VL.decks).forEach((lv) => Object.keys(VL.decks[lv]).forEach((tp) => VL.decks[lv][tp].forEach(([en, uz]) => add(en, uz))));
    if (VL.sample) VL.sample.forEach((g) => g.words.forEach(([en, uz]) => add(en, uz)));
    return dict;
  }

  return { MAX_ROWS, parse, detectSeparator, validate, libraryDictionary, dupKey, clean };
})();
