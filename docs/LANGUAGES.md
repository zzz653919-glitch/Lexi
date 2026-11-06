# Languages (uz · ru · en)

One centralized system, no duplicated pages:
* **Texts:** `locales/uz.json`, `locales/ru.json`, `locales/en.json` (same keys in all three, same `{placeholders}`; Uzbek in the new alphabet Ŏ Ğ Ş Ç). Code never contains interface text: it calls `t('key', params)` (`public/js/i18n.js`, rules in `shared/i18n-core.js`, also used by the server for API messages and e-mails).
* **Switcher:** `public/js/lang-switcher.js` (flag + name, listbox, keyboard support; compact on phones). It is in the guest pages, the learner layout, the Kids header and the admin panel. Choosing a language re-renders the page at once (no reload), saves it in `localStorage` (`lexi.lang`) and, when signed in, on the account (`uiLanguage`). Default: Uzbek.
* **Learning content:** English exercises, words and answers stay English. Their explanations and translations follow the interface language: choosing Uzbek or Russian also sets the account's translation language (it can still be changed in the profile; English keeps the last one).
* **Administrators** can edit any text without code in Admin → Translations (overrides are stored in the database); course, lesson, Kids and vocabulary content have uz / ru fields.
* The page language (`<html lang>`), the title and the meta description follow the selected language.

Tests: `tests/api/i18n.test.js` (parity, placeholders, alphabet, server texts) and `tests/ui/multilang.ui.js` (crawls every page of the site — guest, learner, lessons, placement test, Kids, admin — in each language on desktop and phone: no raw keys, no untranslated interface text, the switcher changes everything without a reload and is remembered).
