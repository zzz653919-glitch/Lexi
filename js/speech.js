/* Pronunciation via the browser's built-in Text-to-Speech. Everything else keeps working
   when speech is unavailable: buttons simply are not shown. */
VL.speech = (function () {
  const synth = window.speechSynthesis;
  const supported = !!(synth && window.SpeechSynthesisUtterance);
  let voice = null;

  // Prefer natural-sounding US/UK English voices over the default one.
  function pickVoice() {
    if (!supported) return;
    const voices = synth.getVoices().filter((v) => /^en([-_]|$)/i.test(v.lang));
    if (!voices.length) return;
    const score = (v) => {
      let s = 0;
      if (/^en[-_]US/i.test(v.lang)) s += 3; else if (/^en[-_]GB/i.test(v.lang)) s += 2;
      if (/natural|neural|online|google|aria|jenny|samantha|daniel|premium|enhanced/i.test(v.name)) s += 4;
      if (v.localService) s += 1;
      return s;
    };
    voice = voices.slice().sort((a, b) => score(b) - score(a))[0];
  }
  if (supported) {
    pickVoice();
    if (synth.addEventListener) synth.addEventListener('voiceschanged', pickVoice);
  }

  function speak(text) {
    if (!supported || !text) return false;
    try {
      synth.cancel();
      const u = new SpeechSynthesisUtterance(String(text));
      u.lang = voice ? voice.lang : 'en-US';
      if (voice) u.voice = voice;
      u.rate = 0.9;
      synth.speak(u);
      return true;
    } catch (e) { return false; }
  }

  // Small speaker button; empty string when speech is not available.
  function button(text, cls) {
    if (!supported) return '';
    return '<button type="button" class="speak-btn ' + (cls || '') + '" data-speak="' + VL.util.esc(text) + '" aria-label="' + VL.util.esc(VL.t('speak.aria', { w: text })) + '">' + VL.ui.icon('volume') + '</button>';
  }

  // One delegated listener makes every [data-speak] button work.
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-speak]');
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    if (!speak(b.dataset.speak)) VL.ui.toast(VL.t('speak.fail'), 'info');
  }, true);

  return { supported, speak, button };
})();
