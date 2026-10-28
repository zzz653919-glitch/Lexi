import { startMistakes } from './start.js';
import { h, spinner } from '../ui.js';
import { navigate } from '../app.js';
import { post } from '../api.js';

export default async function practice() {
  try { const a = await post('/practice/mistakes'); navigate('/attempt/' + a.attemptId, true); return { el: spinner(), title: 'Practice', nav: 'learn' }; }
  catch (e) {
    return { el: h('div', { class: 'card empty' }, h('img', { src: '/img/mascot.svg', alt: '' }), h('h2', {}, e.message), h('a', { class: 'btn', href: '/learn' }, 'Back to the path')), title: 'Practice', nav: 'learn' };
  }
}
