import { h, icon, get, post, put, del, toast, confirmDialog, formDialog, field, wireForm, formErrorBox, table, pager, qs, tag, t, session, ApiError } from '../common.js';

const LEVELS = ['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const SKILLS = ['vocabulary', 'grammar', 'reading', 'usage', 'completion', 'expressions', 'listening'];
const STATUSES = ['draft', 'published', 'archived'];
const lvOpts = (all) => (all ? [{ value: '', label: t('adm.as.any') }] : []).concat(LEVELS.map((l) => ({ value: l, label: t('level.' + l + '.short') })));
const stOpts = (all) => (all ? [{ value: '', label: t('adm.as.any') }] : []).concat(STATUSES.map((s) => ({ value: s, label: t('adm.status.' + s) })));

export default async function assessment({ query }) {
  const tab = ['questions', 'coverage', 'grammar', 'rules', 'stats'].includes(query.get('tab')) ? query.get('tab') : 'questions';
  const isAdmin = session.user.role === 'admin';
  const box = h('div', { class: 'stack' });
  const tabs = h('div', { class: 'tabs', role: 'tablist' }, ['questions', 'coverage', 'grammar'].concat(isAdmin ? ['rules', 'stats'] : ['stats']).map((k) =>
    h('a', { class: 'btn small ' + (k === tab ? '' : 'secondary'), role: 'tab', 'aria-selected': String(k === tab), href: '/admin/assessment?tab=' + k }, t('adm.as.tab_' + k))));
  const el = h('div', { class: 'stack' }, h('div', { class: 'page-head' }, h('h1', {}, t('adm.as.title'))), tabs, box);

  /* ---------- questions ---------- */
  async function questions() {
    const f = { level: '', skill: '', status: '', q: '', page: 1 };
    const list = h('div');
    const filters = h('div', { class: 'row filters' },
      ...[['level', lvOpts(true)], ['skill', [{ value: '', label: t('adm.as.any') }].concat(SKILLS.map((s) => ({ value: s, label: t('adm.as.skill_' + s) })))], ['status', stOpts(true)]].map(([k, o]) => {
        const x = field({ label: t('adm.as.f_' + k), name: k, type: 'select', options: o, value: '' }); x.input.addEventListener('change', () => { f[k] = x.input.value; f.page = 1; load(); }); return x.el; }));
    const search = field({ label: t('common.search'), name: 'q', value: '' }); let timer;
    search.input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { f.q = search.input.value; f.page = 1; load(); }, 300); });
    filters.append(search.el, h('button', { class: 'btn', type: 'button', onclick: () => edit(null) }, icon('plus'), t('adm.as.add_question')));
    async function load() {
      const d = await get('/admin/assessment/questions' + qs(f));
      list.replaceChildren(table([
        { label: t('adm.as.f_level'), render: (r) => r.level }, { label: t('adm.as.f_skill'), render: (r) => t('adm.as.skill_' + r.skill) },
        { label: t('adm.as.f_prompt'), render: (r) => r.prompt }, { label: t('adm.as.f_status'), render: (r) => tag(r.status) },
        { label: t('adm.as.f_correct'), render: (r) => (r.percentCorrect === null ? '—' : r.percentCorrect + '%') },
        { label: '', render: (r) => h('div', { class: 'row' }, h('button', { class: 'btn secondary small', type: 'button', onclick: () => edit(r.id) }, t('common.edit')),
          h('button', { class: 'btn danger small', type: 'button', onclick: () => remove(r) }, t('common.delete'))) }], d.items), pager(d, (p) => { f.page = p; load(); }));
    }
    async function remove(r) { if (await confirmDialog(t('adm.as.delete_title'), r.prompt, t('common.delete'), true)) { await del('/admin/assessment/questions/' + r.id, { confirm: true }); toast(t('adm.deleted'), 'success', 1800); load(); } }
    async function edit(id) {
      const q = id ? await get('/admin/assessment/questions/' + id) : { skill: 'vocabulary', level: 'A1', format: 'choice', prompt: '', passage: '', answer: '', audio_text: '', explanation: '', status: 'draft', options: [] };
      const ordered = q.options.slice().sort((a, b) => (b.is_correct ? 1 : 0) - (a.is_correct ? 1 : 0));
      const saved = await formDialog({ title: id ? t('adm.as.edit_question') : t('adm.as.add_question'), wide: true,
        fields: [
          { name: 'skill', label: t('adm.as.f_skill'), type: 'select', options: SKILLS.map((s) => ({ value: s, label: t('adm.as.skill_' + s) })), value: q.skill },
          { name: 'level', label: t('adm.as.f_level'), type: 'select', options: lvOpts(false), value: q.level },
          { name: 'format', label: t('adm.as.f_format'), type: 'select', options: [{ value: 'choice', label: t('adm.as.format_choice') }, { value: 'type', label: t('adm.as.format_type') }], value: q.format },
          { name: 'prompt', label: t('adm.as.f_prompt'), type: 'textarea', value: q.prompt, rows: 2 },
          { name: 'passage', label: t('adm.as.f_passage'), type: 'textarea', value: q.passage, rows: 4, hint: t('adm.as.passage_hint') },
          { name: 'audio_text', label: t('adm.as.f_audio'), value: q.audio_text, hint: t('adm.as.audio_hint') },
          { name: 'options', label: t('adm.as.f_options'), type: 'textarea', rows: 5, value: ordered.map((o) => o.text).join('\n'), hint: t('adm.as.options_hint') },
          { name: 'answer', label: t('adm.as.f_answer'), value: q.answer, hint: t('adm.as.answer_hint') },
          { name: 'explanation', label: t('adm.as.f_explanation'), value: q.explanation },
          { name: 'status', label: t('adm.as.f_status'), type: 'select', options: stOpts(false), value: q.status },
        ],
        save: async (v) => {
          const body = { ...v, options: v.options.split('\n').map((x) => x.trim()).filter(Boolean).map((text, i) => ({ text, is_correct: i === 0 })) };
          return id ? put('/admin/assessment/questions/' + id, body) : post('/admin/assessment/questions', body);
        } });
      if (saved) { toast(t('adm.saved'), 'success', 1800); load(); }
    }
    box.append(filters, list); await load();
  }

  /* ---------- coverage ---------- */
  async function coverage() {
    const c = await get('/admin/assessment/coverage');
    const head = h('tr', {}, h('th', {}, ''), c.skills.map((s) => h('th', { scope: 'col' }, t('adm.as.skill_' + s))));
    const rows = c.levels.map((l) => h('tr', {}, h('th', { scope: 'row' }, l), c.skills.map((s) => { const n = (c.cells[l] && c.cells[l][s]) || 0; return h('td', { class: n ? '' : 'muted' }, String(n)); })));
    box.append(h('p', { class: c.ready ? 'chip ok' : 'chip warn' }, c.ready ? t('adm.as.ready') : t('adm.as.not_ready')),
      h('p', { class: 'muted' }, t('adm.as.coverage_help', { n: c.total })), h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', {}, head), h('tbody', {}, rows))),
      c.warnings.length ? h('div', {}, h('h2', {}, t('adm.as.warnings')), h('ul', {}, c.warnings.map((w) => h('li', {}, t('adm.as.warning', { level: w.level, skill: t('adm.as.skill_' + w.skill), have: w.have, need: w.need }))))) : null);
  }

  /* ---------- grammar ---------- */
  async function grammar() {
    const d = await get('/admin/grammar');
    const list = h('div');
    const render = (items) => list.replaceChildren(table([{ label: t('adm.as.f_level'), render: (r) => r.level }, { label: t('adm.as.f_title'), render: (r) => r.title }, { label: t('adm.as.f_practice'), render: (r) => r.practiceCount }, { label: t('adm.as.f_status'), render: (r) => tag(r.status) },
      { label: '', render: (r) => h('div', { class: 'row' }, h('button', { class: 'btn secondary small', type: 'button', onclick: () => edit(r.id) }, t('common.edit')), h('button', { class: 'btn danger small', type: 'button', onclick: () => remove(r) }, t('common.delete'))) }], items));
    async function reload() { render((await get('/admin/grammar')).items); }
    async function remove(r) { if (await confirmDialog(t('adm.as.delete_grammar'), r.title, t('common.delete'), true)) { await del('/admin/grammar/' + r.id, { confirm: true }); reload(); } }
    async function edit(id) {
      const g = id ? await get('/admin/grammar/' + id) : { level: 'A1', title: '', explanation: '', examples: [], practice: [], translations: {}, status: 'draft' };
      const tr = (lang, k) => (g.translations[lang] && g.translations[lang][k]) || '';
      const saved = await formDialog({ title: id ? t('adm.as.edit_grammar') : t('adm.as.add_grammar'), wide: true,
        fields: [
          { name: 'level', label: t('adm.as.f_level'), type: 'select', options: lvOpts(false), value: g.level },
          { name: 'title', label: t('adm.as.f_title'), value: g.title }, { name: 'explanation', label: t('adm.as.f_explanation'), type: 'textarea', rows: 3, value: g.explanation },
          { name: 'tr_uz_title', label: t('adm.as.f_title') + ' (uz)', value: tr('uz', 'title') }, { name: 'tr_uz_explanation', label: t('adm.as.f_explanation') + ' (uz)', type: 'textarea', rows: 3, value: tr('uz', 'explanation') },
          { name: 'tr_ru_title', label: t('adm.as.f_title') + ' (ru)', value: tr('ru', 'title') }, { name: 'tr_ru_explanation', label: t('adm.as.f_explanation') + ' (ru)', type: 'textarea', rows: 3, value: tr('ru', 'explanation') },
          { name: 'examples', label: t('adm.as.f_examples'), type: 'textarea', rows: 3, value: g.examples.join('\n'), hint: t('adm.as.examples_hint') },
          { name: 'practice', label: t('adm.as.f_practice'), type: 'textarea', rows: 5, value: g.practice.map((p) => p.join(' | ')).join('\n'), hint: t('adm.as.practice_hint') },
          { name: 'status', label: t('adm.as.f_status'), type: 'select', options: stOpts(false), value: g.status },
        ],
        save: async (v) => {
          const body = { level: v.level, title: v.title, explanation: v.explanation, status: v.status, examples: v.examples.split('\n'), practice: v.practice.split('\n').map((l) => l.split('|').map((x) => x.trim()).filter(Boolean)).filter((p) => p.length),
            translations: { uz: { title: v.tr_uz_title, explanation: v.tr_uz_explanation }, ru: { title: v.tr_ru_title, explanation: v.tr_ru_explanation } } };
          return id ? put('/admin/grammar/' + id, body) : post('/admin/grammar', body);
        } });
      if (saved) { toast(t('adm.saved'), 'success', 1800); reload(); }
    }
    render(d.items);
    box.append(h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: () => edit(null) }, icon('plus'), t('adm.as.add_grammar'))), list);
  }

  /* ---------- thresholds (administrators) ---------- */
  async function rules() {
    const { settings: s } = await get('/admin/settings');
    const num = (k, extra = {}) => field({ label: t('adm.as.set_' + k), name: k, type: 'number', value: s[k], hint: t('adm.as.set_' + k + '_hint'), ...extra });
    const f = {
      placement_min_questions: num('placement_min_questions', { min: 8, max: 40 }), placement_max_questions: num('placement_max_questions', { min: 10, max: 60 }),
      placement_precision: num('placement_precision', { min: 15, max: 90 }), placement_min_per_skill: num('placement_min_per_skill', { min: 1, max: 10 }),
      placement_start_level: field({ label: t('adm.as.set_placement_start_level'), name: 'placement_start_level', type: 'select', value: s.placement_start_level, options: lvOpts(false) }),
      placement_cutoffs: field({ label: t('adm.as.set_placement_cutoffs'), name: 'placement_cutoffs', value: s.placement_cutoffs.join(', '), hint: t('adm.as.set_placement_cutoffs_hint') }),
      placement_valid_days: num('placement_valid_days', { min: 7, max: 730 }),
      adapt_enabled: field({ label: t('adm.as.set_adapt_enabled'), name: 'adapt_enabled', type: 'checkbox', value: s.adapt_enabled }),
      adapt_min_answers: num('adapt_min_answers', { min: 10, max: 500 }), adapt_up_accuracy: num('adapt_up_accuracy', { min: 60, max: 100 }), adapt_min_lessons: num('adapt_min_lessons', { min: 1, max: 100 }),
      adapt_min_days: num('adapt_min_days', { min: 0, max: 365 }), adapt_low_accuracy: num('adapt_low_accuracy', { min: 10, max: 80 }),
      daily_items_short: num('daily_items_short', { min: 6, max: 60 }), daily_items_normal: num('daily_items_normal', { min: 6, max: 60 }), daily_items_long: num('daily_items_long', { min: 6, max: 80 }),
    };
    const err = formErrorBox();
    const form = h('form', { novalidate: true }, err, h('section', { class: 'card' }, h('h2', {}, t('adm.as.rules_placement')), h('div', { class: 'two-col' }, ['placement_min_questions', 'placement_max_questions', 'placement_precision', 'placement_min_per_skill', 'placement_start_level', 'placement_cutoffs', 'placement_valid_days'].map((k) => f[k].el))),
      h('section', { class: 'card' }, h('h2', {}, t('adm.as.rules_adapt')), h('div', { class: 'two-col' }, ['adapt_enabled', 'adapt_min_answers', 'adapt_up_accuracy', 'adapt_min_lessons', 'adapt_min_days', 'adapt_low_accuracy', 'daily_items_short', 'daily_items_normal', 'daily_items_long'].map((k) => f[k].el))),
      h('button', { class: 'btn', type: 'submit' }, t('adm.set.save')));
    wireForm(form, f, err, async () => {
      const body = {};
      for (const [k, x] of Object.entries(f)) body[k] = x.input.type === 'checkbox' ? x.input.checked : k === 'placement_cutoffs' ? x.value.split(',').map((n) => Number(n.trim())) : k === 'placement_start_level' ? x.value : Number(x.value);
      await put('/admin/settings', body); toast(t('adm.saved'), 'success', 2000);
    });
    box.append(form);
  }

  /* ---------- statistics (anonymised) ---------- */
  async function stats() {
    const d = await get('/admin/assessment/stats'), a = d.assessments;
    const stat = (v, label) => h('div', { class: 'card stat' }, h('div', {}, h('b', {}, String(v)), h('span', {}, label)));
    box.append(h('p', { class: 'muted small' }, t('adm.as.anon_note')),
      h('div', { class: 'stat-row' }, stat(a.completed, t('adm.as.st_completed')), stat(a.abandoned, t('adm.as.st_abandoned')), stat(a.avgQuestions === null ? '—' : a.avgQuestions, t('adm.as.st_avg_questions')), stat(a.avgPercent === null ? '—' : a.avgPercent + '%', t('adm.as.st_avg_percent')), stat(d.autoLevelUps, t('adm.as.st_auto'))),
      h('section', { class: 'card' }, h('h2', {}, t('adm.as.st_distribution')), table([{ label: t('adm.as.f_level'), render: (r) => r.level }, { label: t('adm.as.st_tests'), render: (r) => r.tests }, { label: t('adm.as.st_learners'), render: (r) => r.learners }], d.levelDistribution)),
      h('section', { class: 'card' }, h('h2', {}, t('adm.as.st_suspicious')), h('p', { class: 'muted small' }, t('adm.as.st_suspicious_help')),
        table([{ label: t('adm.as.f_level'), render: (r) => r.level }, { label: t('adm.as.f_prompt'), render: (r) => r.prompt }, { label: t('adm.as.st_asked'), render: (r) => r.asked }, { label: t('adm.as.f_correct'), render: (r) => r.percentCorrect + '%' }], d.suspicious)));
  }

  await { questions, coverage, grammar, rules, stats }[tab]();
  return { el, title: t('adm.as.title'), nav: 'assessment' };
}
