import { h, icon, get, post, patch, del, api, table, tag, formDialog, toast, iconBtn, crumbs, confirmDialog, t } from '../common.js';
import { catFields } from './kids.js';

/* one picture-card preview: image > colour swatch > emoji */
const preview = (x) => (x.image_url ? h('img', { src: x.image_url, alt: '', width: 40, height: 40, style: { objectFit: 'contain', borderRadius: '8px' } })
  : /^#[0-9a-fA-F]{6}$/.test(x.pic || '') ? h('span', { 'aria-hidden': 'true', style: { display: 'inline-block', width: '34px', height: '34px', borderRadius: '50%', background: x.pic, border: '2px solid #0002' } })
  : h('span', { 'aria-hidden': 'true', style: { fontSize: '1.8rem' } }, x.pic || '—'));

/* an image / audio uploader; keeps the chosen url in state[key] */
function uploader(state, key, accept, label) {
  const info = h('span', { class: 'muted small' });
  const input = h('input', { type: 'file', accept, 'aria-label': label, 'data-upload': key });
  const show = () => info.replaceChildren(state[key] ? h('span', {}, t('adm.kids.uploaded') + ' ', key === 'audio_url' ? h('audio', { controls: true, src: state[key], style: { verticalAlign: 'middle', maxWidth: '100%' } }) : h('img', { src: state[key], alt: '', height: 40, style: { verticalAlign: 'middle', borderRadius: '8px' } }), ' ', h('button', { type: 'button', class: 'btn secondary small', onclick: () => { state[key] = ''; show(); } }, t('adm.kids.remove'))) : '');
  input.addEventListener('change', async () => {
    const f = input.files[0]; if (!f) return;
    try { const buf = await f.arrayBuffer(); const r = await api('POST', '/admin/kids/upload', buf, { raw: true, headers: { 'Content-Type': 'application/octet-stream', 'X-Filename': f.name } }); state[key] = r.url; show(); toast(t('adm.kids.uploaded'), 'success', 2000); }
    catch (e) { toast(e.message || t('adm.kids.upload_failed'), 'error', 6000); }
    input.value = '';
  });
  show();
  return h('div', { class: 'field' }, h('span', { class: 'label' }, label), h('div', { class: 'row' }, input), info);
}

export default async function kidsCategory({ params }) {
  const id = params.id;
  const holder = h('div', {});
  let cat = null;
  const load = async () => {
    const d = await get(`/admin/kids/categories/${id}/words`); cat = d.category;
    const editCard = async (w) => {
      const st = { image_url: w ? w.image_url : '', audio_url: w ? w.audio_url : '' };
      const r = await formDialog({ title: w ? t('adm.kids.edit_card') : t('adm.kids.add_card'), wide: true, fields: [
        { name: 'en', label: t('adm.kids.f_en'), value: w ? w.en : '', required: true, maxlength: 120 }, { name: 'uz', label: t('adm.kids.f_uz'), value: w ? w.uz : '', maxlength: 200 }, { name: 'ru', label: t('adm.kids.f_ru'), value: w ? w.ru : '', maxlength: 200 },
        { name: 'pic', label: t('adm.kids.f_pic'), value: w ? w.pic : '', maxlength: 60, hint: t('adm.kids.f_pic_hint') }, { name: 'extra', label: t('adm.kids.f_extra'), value: w ? w.extra : '', maxlength: 40, hint: t('adm.kids.f_extra_hint') },
        { name: 'position', label: t('adm.kids.f_position'), type: 'number', value: w ? w.position : '', min: 0 },
        { name: 'status', label: t('adm.kids.f_status'), type: 'select', value: w ? w.status : 'published', options: ['published', 'draft'].map((s) => ({ value: s, label: t('adm.status.' + s) })) }],
        extra: h('div', {}, uploader(st, 'image_url', '.png,.jpg,.jpeg,.webp,.gif,image/png,image/jpeg,image/webp,image/gif', t('adm.kids.upload_image')), uploader(st, 'audio_url', '.mp3,.ogg,.wav,audio/*', t('adm.kids.upload_audio'))),
        save: (v) => (w ? patch('/admin/kids/words/' + w.id, { ...v, ...st, position: Number(v.position) || 0 }) : post(`/admin/kids/categories/${id}/words`, { ...v, ...st, position: Number(v.position) || 0 })) });
      if (r) { toast(t('adm.kids.saved'), 'success'); load(); }
    };
    const editQ = async (q) => {
      const st = { image_url: q ? q.image_url : '', audio_url: q ? q.audio_url : '' };
      const r = await formDialog({ title: q ? t('adm.kids.edit_question') : t('adm.kids.add_question'), wide: true, fields: [
        { name: 'prompt', label: t('adm.kids.f_prompt'), value: q ? q.prompt : '', required: true, maxlength: 200 }, { name: 'prompt_uz', label: t('adm.kids.f_prompt_uz'), value: q ? q.prompt_uz : '', maxlength: 200 }, { name: 'prompt_ru', label: t('adm.kids.f_prompt_ru'), value: q ? q.prompt_ru : '', maxlength: 200 },
        { name: 'pic', label: t('adm.kids.f_pic'), value: q ? q.pic : '', maxlength: 60, hint: t('adm.kids.f_pic_hint') },
        { name: 'correct', label: t('adm.kids.f_correct'), value: q ? q.correct : '', required: true, maxlength: 80 }, { name: 'wrong1', label: t('adm.kids.f_wrong', { n: 1 }), value: q ? q.wrong1 : '', required: true, maxlength: 80 },
        { name: 'wrong2', label: t('adm.kids.f_wrong', { n: 2 }), value: q ? q.wrong2 : '', maxlength: 80 }, { name: 'wrong3', label: t('adm.kids.f_wrong', { n: 3 }), value: q ? q.wrong3 : '', maxlength: 80 },
        { name: 'status', label: t('adm.kids.f_status'), type: 'select', value: q ? q.status : 'published', options: ['published', 'draft'].map((s) => ({ value: s, label: t('adm.status.' + s) })) }],
        extra: h('div', {}, uploader(st, 'image_url', '.png,.jpg,.jpeg,.webp,.gif,image/png,image/jpeg,image/webp,image/gif', t('adm.kids.upload_image')), uploader(st, 'audio_url', '.mp3,.ogg,.wav,audio/*', t('adm.kids.upload_audio'))),
        save: (v) => (q ? patch('/admin/kids/questions/' + q.id, { ...v, ...st }) : post(`/admin/kids/categories/${id}/questions`, { ...v, ...st })) });
      if (r) { toast(t('adm.kids.saved'), 'success'); load(); }
    };
    const remove = (url, text) => async () => { if (!(await confirmDialog(t('adm.kids.delete'), text, t('common.delete'), true))) return; try { await del(url); toast(t('adm.kids.deleted'), 'success'); load(); } catch (e) { toast(e.message, 'error', 6000); } };
    holder.replaceChildren(
      h('div', { class: 'page-head' }, h('h1', {}, h('span', { 'aria-hidden': 'true' }, cat.emoji + ' '), cat.title_en), h('div', { class: 'row' }, tag(cat.status),
        h('a', { class: 'btn secondary small', href: '/kids/learn/' + cat.slug }, t('adm.kids.preview')),
        h('button', { class: 'btn secondary small', onclick: async () => { const r = await formDialog({ title: t('adm.kids.edit_category'), fields: catFields(cat), save: (v) => patch('/admin/kids/categories/' + id, { ...v, position: Number(v.position) || 0 }) }); if (r) { toast(t('adm.kids.saved'), 'success'); load(); } } }, icon('edit'), t('common.edit')))),
      h('section', { class: 'card' }, h('div', { class: 'page-head' }, h('h2', {}, t('adm.kids.cards_title')), h('button', { class: 'btn small', id: 'kids-add-card', onclick: () => editCard(null) }, icon('plus'), t('adm.kids.add_card'))), table([
        { label: t('adm.kids.col_picture'), render: preview }, { label: t('adm.kids.col_word'), render: (w) => h('div', {}, h('b', {}, w.en), w.extra ? h('span', { class: 'muted small' }, ' · ' + w.extra) : null) },
        { label: t('adm.kids.f_uz'), render: (w) => w.uz }, { label: t('adm.kids.f_ru'), render: (w) => w.ru },
        { label: t('adm.kids.col_media'), render: (w) => [w.image_url ? '🖼️' : '', w.audio_url ? '🔊' : ''].filter(Boolean).join(' ') || '—' },
        { label: t('adm.col.status'), render: (w) => tag(w.status) },
        { label: '', cls: 'actions', render: (w) => h('div', { class: 'row' }, iconBtn('edit', t('common.edit'), () => editCard(w)), iconBtn('trash', t('common.delete'), remove('/admin/kids/words/' + w.id, w.en), 'danger')) },
      ], d.words, { empty: t('adm.kids.no_cards') })),
      h('section', { class: 'card' }, h('div', { class: 'page-head' }, h('h2', {}, t('adm.kids.questions_title')), h('button', { class: 'btn small', id: 'kids-add-question', onclick: () => editQ(null) }, icon('plus'), t('adm.kids.add_question'))), h('p', { class: 'muted small' }, t('adm.kids.questions_hint')), table([
        { label: t('adm.kids.col_picture'), render: preview }, { label: t('adm.kids.f_prompt'), render: (q) => q.prompt }, { label: t('adm.kids.f_correct'), render: (q) => q.correct },
        { label: t('adm.col.status'), render: (q) => tag(q.status) },
        { label: '', cls: 'actions', render: (q) => h('div', { class: 'row' }, iconBtn('edit', t('common.edit'), () => editQ(q)), iconBtn('trash', t('common.delete'), remove('/admin/kids/questions/' + q.id, q.prompt), 'danger')) },
      ], d.questions, { empty: t('adm.kids.no_questions') })));
  };
  await load();
  const el = h('div', {}, crumbs({ label: t('adm.nav.kids'), href: '/admin/kids' }, { label: cat.title_en }), holder);
  return { el, title: cat.title_en, nav: 'kids' };
}
