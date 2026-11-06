import { h, get, table, tag, t, fmt } from '../common.js';

/* the state of the curriculum: for each level how much is written, published, tested and filled with vocabulary */
export default async function curriculum() {
  const d = await get('/admin/curriculum');
  const num = (v) => fmt.number(v || 0);
  const card = (v, label) => h('div', { class: 'stat-card' }, h('b', {}, v), h('span', {}, label));
  if (!d.course) return { el: h('div', {}, h('div', { class: 'page-head' }, h('h1', {}, t('adm.nav.curriculum'))), h('p', { class: 'muted' }, t('adm.cur.none'))), title: t('adm.nav.curriculum'), nav: 'curriculum' };
  const pct = (a, b) => (b ? Math.round(100 * a / b) : 0);
  const bar = (a, b, label) => h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': b, 'aria-valuenow': a, 'aria-label': label }, h('i', { style: { width: pct(a, b) + '%' } }));
  const el = h('div', {},
    h('div', { class: 'page-head' }, h('h1', {}, t('adm.nav.curriculum')), h('a', { class: 'btn secondary small', href: '/admin/courses/' + d.course.id }, t('adm.cur.open_course'))),
    h('p', { class: 'muted' }, t('adm.cur.intro')),
    h('div', { class: 'stat-grid' }, card(num(d.totals.lessons), t('adm.cur.lessons')), card(`${num(d.totals.published)} / ${num(d.totals.lessons)}`, t('adm.cur.published')), card(num(d.totals.drafts), t('adm.cur.drafts')),
      card(num(d.totals.topicTests), t('adm.cur.topic_tests')), card(num(d.totals.exams), t('adm.cur.exams')), card(num(d.totals.exercises), t('adm.cur.exercises')), card(num(d.vocabulary.total), t('adm.cur.words')), card(`${d.totals.levelsComplete} / ${d.levels.length}`, t('adm.cur.levels_complete'))),
    h('section', { class: 'card' }, h('h2', {}, t('adm.cur.levels')), table([
      { label: t('adm.cur.level'), render: (l) => h('b', {}, l.title) },
      { label: t('adm.cur.lessons'), render: (l) => `${num(l.published)} / ${num(l.lessons)}` },
      { label: t('adm.cur.written'), render: (l) => bar(l.published, l.lessons, `${l.code} ${t('adm.cur.written')}`) },
      { label: t('adm.cur.topics'), render: (l) => num(l.topics) },
      { label: t('adm.cur.topic_tests'), render: (l) => num(l.topicTests) },
      { label: t('adm.cur.exam'), render: (l) => l.exams ? tag('published') : tag('draft') },
      { label: t('adm.cur.exercises'), render: (l) => num(l.exercises) },
      { label: t('adm.cur.words'), render: (l) => num(l.words) },
      { label: t('adm.cur.learners'), render: (l) => `${num(l.learners)} / ${num(l.examPassed)}` },
      { label: t('adm.cur.state'), render: (l) => l.complete ? tag('published') : tag('draft') },
    ], d.levels)),
    h('section', { class: 'card' }, h('h2', {}, t('adm.cur.skills')), table([
      { label: t('adm.cur.level'), render: (l) => h('b', {}, l.code) },
      ...['listening', 'reading', 'writing', 'speaking', 'mixed'].map((k) => ({ label: t('adm.cur.skill_' + k), render: (l) => num(l.skills[k]) })),
    ], d.levels)),
    h('section', { class: 'card' }, h('h2', {}, t('adm.cur.vocab')), h('p', { class: 'muted small' }, t('adm.cur.vocab_note', { total: num(d.vocabulary.total), ipa: num(d.vocabulary.withIpa) })),
      table([{ label: t('adm.cur.kind'), render: (k) => t('adm.cur.kind_' + k.kind) }, { label: t('adm.cur.count'), render: (k) => num(k.n) }], d.vocabulary.kinds)));
  return { el, title: t('adm.nav.curriculum'), nav: 'curriculum' };
}
