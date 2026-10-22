/* CSV / TXT parsing and serialising for vocabulary import & export. */
VL.csv = (function () {
  const HEADER_EN = ['english', 'en', 'word', 'inglizcha', 'inglizcha so\'z'];
  const HEADER_UZ = ['uzbek', 'uz', 'translation', 'o\'zbekcha', 'ozbekcha', 'tarjima'];
  const DASH_SEPARATORS = [' — ', ' – ', ' - ', ' = ', '—', '–', '|'];

  // Split a single line on a delimiter, honouring "quoted ""fields""".
  function splitFields(line, delim) {
    const out = [];
    let cur = '', quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (quoted) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') quoted = false;
        else cur += ch;
      } else if (ch === '"' && cur === '') quoted = true;
      else if (ch === delim) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  }

  function splitLine(line) {
    if (line.includes('\t')) return splitFields(line, '\t');
    if (line.includes('"')) {
      for (const delim of [',', ';']) {
        const parts = splitFields(line, delim);
        if (parts.length > 1) return parts;
      }
    }
    for (const sep of DASH_SEPARATORS) {
      const i = line.indexOf(sep);
      if (i > 0) return [line.slice(0, i).trim(), line.slice(i + sep.length).trim()];
    }
    if (line.includes(';')) return splitFields(line, ';');
    if (line.includes(',')) return splitFields(line, ',');
    return [line.trim()];
  }

  /* Returns { rows: [{en, uz, collection, line}], errors: [{line, text, reason}], hadHeader } */
  function parseImport(text, opts) {
    const useCollectionColumn = !!(opts && opts.useCollectionColumn);
    const rows = [], errors = [];
    let hadHeader = false;
    const lines = String(text).replace(/^﻿/, '').split(/\r\n|\n|\r/);
    lines.forEach((raw, idx) => {
      const lineNo = idx + 1;
      const line = raw.trim();
      if (!line || line.startsWith('#') || line.startsWith('//')) return;
      const parts = splitLine(line);
      if (parts.length < 2) { errors.push({ line: lineNo, text: line, reason: 'nosep' }); return; }
      if (rows.length === 0 && !hadHeader && HEADER_EN.includes(parts[0].toLowerCase()) && HEADER_UZ.includes(parts[1].toLowerCase())) { hadHeader = true; return; }
      let en = parts[0], uz, collection = '';
      if (parts.length >= 3 && useCollectionColumn) { uz = parts[1]; collection = parts[2]; }
      else uz = parts.slice(1).filter(Boolean).join(', ');
      if (!en) { errors.push({ line: lineNo, text: line, reason: 'emptyEn' }); return; }
      if (!uz) { errors.push({ line: lineNo, text: line, reason: 'emptyUz' }); return; }
      if (en.length > 200 || uz.length > 200) { errors.push({ line: lineNo, text: line.slice(0, 60) + '…', reason: 'long' }); return; }
      rows.push({ en, uz, collection, line: lineNo });
    });
    return { rows, errors, hadHeader };
  }

  const field = (s) => (/[",\r\n;]/.test(s) || s !== s.trim() ? '"' + s.replace(/"/g, '""') + '"' : s);

  function stringify(rows) {
    const lines = [['english', 'uzbek', 'collection'].join(',')];
    rows.forEach((r) => lines.push([field(r.en), field(r.uz), field(r.collection || '')].join(',')));
    return '﻿' + lines.join('\r\n') + '\r\n'; // BOM so Excel reads Uzbek letters correctly
  }

  return { parseImport, stringify };
})();
