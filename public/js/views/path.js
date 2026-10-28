import { h, icon, modal, spinner } from '../ui.js';
import { get, patch } from '../api.js';
import { navigate } from '../app.js';
import { t, n } from '../i18n.js';
import { startAttempt } from './start.js';

const lockText = (reason) => (reason ? t(reason.key, reason.params) : t('path.lock_default'));

export default async function pathView({ query }) {
  const data = await get('/path' + (query.get('courseId') ? '?courseId=' + encodeURIComponent(query.get('courseId')) : ''));
  if (!data.course) return { el: h('div', { class: 'card empty' }, h('img', { src: '/img/mascot.svg', alt: '' }), h('h2', {}, t('path.no_course')), h('p', {}, t('path.no_course_text'))), title: t('nav.learn'), nav: 'learn' };
  const profile = await get('/me/profile');
  const rec = data.recommended;
  let selected = (rec && data.levels.find((l) => l.code === rec.level)) || data.levels.find((l) => l.unlocked) || data.levels[0];
  const holder = h('div', {});
  const tabs = h('div', { class: 'level-tabs', role: 'tablist', 'aria-label': t('path.levels') });

  function openLesson(l) {
    if (l.state === 'locked') {
      return modal({ title: l.title, content: h('div', {}, h('p', { class: 'chip bad' }, icon('lock'), t('path.locked')), h('p', {}, lockText(l.lockReason))), actions: [{ label: t('common.ok'), value: true }] });
    }
    modal({
      title: l.title,
      content: h('div', {}, l.description ? h('p', { class: 'muted' }, l.description) : null,
        h('div', { class: 'chips' }, h('span', { class: 'chip info' }, n('count.exercises', l.exercises)), h('span', { class: 'chip warn' }, icon('bolt'), t('path.xp_reward', { n: l.xp })), l.state === 'completed' ? h('span', { class: 'chip ok' }, icon('check'), t('path.best', { n: l.accuracy })) : null)),
      actions: [{ label: t('common.close'), value: false, kind: 'secondary' }, { label: l.inProgress ? t('common.continue') : l.state === 'completed' ? t('path.practise_again') : t('dashboard.start_lesson'), value: true }],
    }).then((go) => { if (go) startAttempt(l.id); });
  }

  function draw() {
    tabs.replaceChildren(...data.levels.map((lv) => h('button', { type: 'button', role: 'tab', class: 'level-tab', 'aria-selected': String(lv === selected), 'aria-disabled': String(!lv.unlocked), onclick: () => { selected = lv; draw(); } },
      lv.unlocked ? null : icon('lock'), lv.code, h('span', { class: 'muted small' }, `${lv.done}/${lv.total}`))));
    const lv = selected;
    const parts = [];
    if (!lv.unlocked) parts.push(h('div', { class: 'notice' }, t('path.level_locked_note', { level: lv.code, pct: lv.threshold })));
    let idx = 0;
    for (const u of lv.units) {
      parts.push(h('div', { class: 'unit-banner' }, h('h3', {}, u.title), h('p', {}, `${u.description || ''} ${t('dashboard.lessons_progress', { done: u.done, total: u.total })}`.trim())));
      const path = h('div', { class: 'path' });
      u.lessons.forEach((l) => {
        const cur = rec && rec.lessonId === l.id;
        const off = Math.round(Math.sin(idx * 1.15) * 64); idx++;
        const stateText = l.state === 'completed' ? t('path.state_completed') : l.state === 'locked' ? t('path.state_locked') : cur ? t('path.state_start_here') : t('path.state_available');
        const node = h('button', { type: 'button', class: `node ${l.state}${cur ? ' current' : ''}`, 'aria-label': `${l.title}, ${stateText}`, onclick: () => openLesson(l) }, icon(l.state === 'completed' ? 'check' : l.state === 'locked' ? 'lock' : 'play'));
        path.append(h('div', { class: 'node-wrap', style: { '--off': off + 'px' } }, cur ? h('span', { class: 'start-pill' }, l.inProgress ? t('common.continue') : t('common.start')) : null, node, h('span', { class: 'node-label' }, l.title)));
      });
      parts.push(path);
    }
    holder.replaceChildren(...parts);
  }
  draw();

  const switcher = profile.courses.length > 1 ? h('label', { class: 'field', style: { margin: 0 } }, h('span', { class: 'sr-only' }, t('dashboard.course')), h('select', { class: 'input', onchange: async (e) => { await patch('/me', { courseId: Number(e.target.value) }); navigate('/learn?courseId=' + e.target.value); } },
    profile.courses.map((c) => h('option', { value: c.id, selected: c.id === data.course.id }, c.title)))) : null;
  const total = data.totals;
  const el = h('div', { class: 'learn-layout' },
    h('div', {}, h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, data.course.title), h('p', { class: 'muted', style: { margin: 0 } }, data.course.description)), switcher),
      data.course.track === 'ielts' ? h('div', { class: 'notice' }, t('path.ielts_notice')) : null,
      tabs, holder),
    h('aside', { class: 'path-side' }, h('div', { class: 'card' }, h('h2', {}, t('path.course_progress')), h('div', { class: 'progress' }, h('i', { style: { width: (total.lessons ? Math.round(100 * total.done / total.lessons) : 0) + '%' } })), h('p', { class: 'muted small', style: { marginTop: '8px' } }, t('path.lessons_completed', { done: total.done, total: total.lessons }))),
      rec ? h('div', { class: 'card' }, h('h3', {}, t('path.up_next')), h('p', { style: { marginBottom: '8px' } }, rec.title), h('button', { class: 'btn small block', onclick: () => startAttempt(rec.lessonId) }, rec.resume ? t('common.continue') : t('common.start'))) : null,
      h('div', { class: 'card' }, h('h3', {}, t('path.levels')), h('p', { class: 'muted small' }, t('path.levels_note')))));
  return { el, title: t('nav.learn'), nav: 'learn' };
}
