import { h, spinner } from '../ui.js';
import { navigate } from '../app.js';
import { post } from '../api.js';
import { t } from '../i18n.js';

export default async function practice() {
  try { const a = await post('/practice/mistakes'); navigate('/attempt/' + a.attemptId, true); return { el: spinner(), title: t('practice.title'), nav: 'learn' }; }
  catch (e) {
    return { el: h('div', { class: 'card empty' }, h('img', { src: '/img/mascot.svg', alt: '' }), h('h2', {}, e.message), h('a', { class: 'btn', href: '/learn' }, t('practice.back_to_path'))), title: t('practice.title'), nav: 'learn' };
  }
}
