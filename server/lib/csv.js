/* Minimal RFC 4180 CSV reader/writer. */
function parse(text) {
  const rows = []; let row = [], field = '', q = false, i = 0;
  const s = String(text).replace(/^﻿/, '');
  while (i < s.length) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { field += '"'; i += 2; continue; } q = false; i++; continue; }
      field += c; i++; continue;
    }
    if (c === '"' && field === '') { q = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\n' || c === '\r') { if (c === '\r' && s[i + 1] === '\n') i++; row.push(field); field = ''; if (row.some((x) => x !== '') || row.length > 1) rows.push(row); row = []; i++; continue; }
    field += c; i++;
  }
  row.push(field); if (row.some((x) => x !== '') || row.length > 1) rows.push(row);
  return rows;
}
/* CSV cells that start with = + - @ are prefixed so a spreadsheet does not run them as formulas (CSV injection) */
const cell = (v) => { let s = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const stringify = (header, rows) => [header.map(cell).join(',')].concat(rows.map((r) => header.map((h) => cell(r[h])).join(','))).join('\r\n') + '\r\n';
const unformula = (s) => (/^'[=+\-@\t\r]/.test(s) ? s.slice(1) : s);
/* rows -> objects keyed by the header row */
function objects(text) {
  const rows = parse(text);
  if (!rows.length) return [];
  const head = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, unformula((r[i] || '').trim())])));
}
module.exports = { parse, stringify, objects };
