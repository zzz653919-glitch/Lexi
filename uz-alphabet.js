/* Uzbek Latin alphabet update (Law O'RQ-1184 of 21 October 2026): four letters get a single-character form.
     O‘ o‘ → Ö ö     G‘ g‘ → Ğ ğ     Sh sh → Ş ş     Ch ch → Ç ç
   The apostrophe-like mark after other letters is the tutuq belgisi (ma’no, a’lo) and stays as it is.
   toNew(text)      converts Uzbek text written in the 1995 alphabet (any apostrophe variant: ‘ ʻ ' ` ’) to the new one.
                    {placeholders}, <html tags>, &entities;, URLs and time-zone names (Asia/Tashkent) are left untouched.
   foldOld(text)    the reverse direction, used only to compare answers so that both spellings are accepted.
   Works in Node (module.exports) and in the browser (window.UZ_ALPHABET). */
(function (root) {
  const APOS = "[‘ʻ'`’ʼ]";
  const PROTECT = /(\{[^{}]*\}|<[^<>]*>|&[a-z#0-9]+;|https?:\/\/\S+|\b[A-Z][a-z]+\/[A-Za-z_]+)/g;

  function convertPlain(s) {
    return s
      .replace(new RegExp('O' + APOS, 'g'), 'Ö').replace(new RegExp('o' + APOS, 'g'), 'ö')
      .replace(new RegExp('G' + APOS, 'g'), 'Ğ').replace(new RegExp('g' + APOS, 'g'), 'ğ')
      // SH / CH inside an all-caps word stay one capital letter; Sh / Ch at a word start become Ş / Ç
      .replace(/SH|Sh/g, 'Ş').replace(/sh/g, 'ş')
      .replace(/CH|Ch/g, 'Ç').replace(/ch/g, 'ç');
  }

  function toNew(text) {
    if (text == null) return text;
    const s = String(text);
    return s.split(PROTECT).map((part, i) => (i % 2 ? part : convertPlain(part))).join('');
  }

  function foldOld(text) {
    if (text == null) return text;
    return String(text)
      .replace(/Ö/g, "O'").replace(/ö/g, "o'").replace(/Ğ/g, "G'").replace(/ğ/g, "g'")
      .replace(/Ş/g, 'Sh').replace(/ş/g, 'sh').replace(/Ç/g, 'Ch').replace(/ç/g, 'ch');
  }

  const api = { toNew, foldOld };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.UZ_ALPHABET = api;
})(typeof window !== 'undefined' ? window : globalThis);
