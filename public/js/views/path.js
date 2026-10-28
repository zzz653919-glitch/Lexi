import { h, icon, modal, spinner } from '../ui.js';
import { get, patch } from '../api.js';
import { navigate } from '../app.js';
import { startAttempt } from './start.js';

export default async function pathView({ query }) {
  const data = await get('/path' + (query.get('courseId') ? '?courseId=' + encodeURIComponent(query.get('courseId')) : ''));
  if (!data.course) return { el: h('div', { class: 'card empty' }, h('img', { src: '/img/mascot.svg', alt: '' }), h('h2', {}, 'No course is published yet'), h('p', {}, 'An administrator needs to publish a course first.')), title: 'Learn', nav: 'learn' };
  const profile = await get('/me/profile');
  const rec = data.recommended;
  let selected = (rec && data.levels.find((l) => l.code === rec.level)) || data.levels.find((l) => l.unlocked) || data.levels[0];
  const holder = h('div', {});
  const tabs = h('div', { class: 'level-tabs', role: 'tablist', 'aria-label': 'Levels' });

  function openLesson(l, level) {
    if (l.state === 'locked') {
      return modal({ title: l.title, content: h('div', {}, h('p', { class: 'chip bad' }, icon('lock'), 'Locked'), h('p', {}, l.lockReason || 'Finish the earlier lessons first.')), actions: [{ label: 'OK', value: true }] });
    }
    modal({
      title: l.title,
      content: h('div', {}, l.description ? h('p', { class: 'muted' }, l.description) : null,
        h('div', { class: 'chips' }, h('span', { class: 'chip info' }, `${l.exercises} exercises`), h('span', { class: 'chip warn' }, icon('bolt'), `+${l.xp} XP`), l.state === 'completed' ? h('span', { class: 'chip ok' }, icon('check'), `Best ${l.accuracy}%`) : null)),
      actions: [{ label: 'Close', value: false, kind: 'secondary' }, { label: l.inProgress ? 'Continue' : l.state === 'completed' ? 'Practise again' : 'Start lesson', value: true }],
    }).then((go) => { if (go) startAttempt(l.id); });
  }

  function draw() {
    tabs.replaceChildren(...data.levels.map((lv) => h('button', { type: 'button', role: 'tab', class: 'level-tab', 'aria-selected': String(lv === selected), 'aria-disabled': String(!lv.unlocked), onclick: () => { selected = lv; draw(); } },
      lv.unlocked ? null : icon('lock'), lv.code, h('span', { class: 'muted small' }, `${lv.done}/${lv.total}`))));
    const lv = selected;
    const parts = [];
    if (!lv.unlocked) parts.push(h('div', { class: 'notice' }, `Level ${lv.code} opens when you finish ${lv.threshold}% of the previous level. You can still look around.`));
    let n = 0;
    for (const u of lv.units) {
      parts.push(h('div', { class: 'unit-banner' }, h('h3', {}, u.title), h('p', {}, `${u.description || ''} ${u.done}/${u.total} lessons`.trim())));
      const path = h('div', { class: 'path' });
      u.lessons.forEach((l) => {
        const cur = rec && rec.lessonId === l.id;
        const off = Math.round(Math.sin(n * 1.15) * 64); n++;
        const node = h('button', { type: 'button', class: `node ${l.state}${cur ? ' current' : ''}`, 'aria-label': `${l.title}, ${l.state === 'completed' ? 'completed' : l.state === 'locked' ? 'locked' : cur ? 'start here' : 'available'}`, onclick: () => openLesson(l, lv) }, icon(l.state === 'completed' ? 'check' : l.state === 'locked' ? 'lock' : 'play'));
        path.append(h('div', { class: 'node-wrap', style: { '--off': off + 'px' } }, cur ? h('span', { class: 'start-pill' }, l.inProgress ? 'Continue' : 'Start') : null, node, h('span', { class: 'node-label' }, l.title)));
      });
      parts.push(path);
    }
    holder.replaceChildren(...parts);
  }
  draw();

  const switcher = profile.courses.length > 1 ? h('label', { class: 'field', style: { margin: 0 } }, h('span', { class: 'sr-only' }, 'Course'), h('select', { class: 'input', onchange: async (e) => { await patch('/me', { courseId: Number(e.target.value) }); navigate('/learn?courseId=' + e.target.value); } },
    profile.courses.map((c) => h('option', { value: c.id, selected: c.id === data.course.id }, c.title)))) : null;
  const total = data.totals;
  const el = h('div', { class: 'learn-layout' },
    h('div', {}, h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, data.course.title), h('p', { class: 'muted', style: { margin: 0 } }, data.course.description)), switcher),
      data.course.track === 'ielts' ? h('div', { class: 'notice' }, 'This is practice material for academic-style tasks. It is not an official IELTS test and does not predict a band score.') : null,
      tabs, holder),
    h('aside', { class: 'path-side' }, h('div', { class: 'card' }, h('h2', {}, 'Course progress'), h('div', { class: 'progress' }, h('i', { style: { width: (total.lessons ? Math.round(100 * total.done / total.lessons) : 0) + '%' } })), h('p', { class: 'muted small', style: { marginTop: '8px' } }, `${total.done} of ${total.lessons} lessons completed`)),
      rec ? h('div', { class: 'card' }, h('h3', {}, 'Up next'), h('p', { style: { marginBottom: '8px' } }, rec.title), h('button', { class: 'btn small block', onclick: () => startAttempt(rec.lessonId) }, rec.resume ? 'Continue' : 'Start')) : null,
      h('div', { class: 'card' }, h('h3', {}, 'Levels'), h('p', { class: 'muted small' }, 'Levels follow the CEFR scale (A1–C1) as a guide. They are not an official placement or certificate.'))));
  return { el, title: 'Learn', nav: 'learn' };
}
