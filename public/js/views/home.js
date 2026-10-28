import { h, icon, avatar, toast } from '../ui.js';
import { get, post, session, ApiError } from '../api.js';
import { navigate, switcher } from '../app.js';
import { t, n, fmt } from '../i18n.js';
import { startAttempt } from './start.js';
import { achievementIcon } from './achievements.js';
import { levelBadge, levelName, skillName } from './level-info.js';

function landing() {
  const site = session.config ? session.config.siteName : 'Lexi Learn';
  const tag = (session.config && session.config.tagline) || t('app.tagline');
  const feature = (ic, title, text) => h('div', { class: 'card' }, h('div', { class: 'stat' }, h('div', { class: 'ico' }, icon(ic)), h('div', {}, h('b', { style: { fontSize: '1.05rem' } }, title), h('span', {}, text))));
  const el = h('main', { class: 'landing' },
    h('div', { class: 'landing-nav' }, h('a', { class: 'brand', href: '/', style: { padding: 0 } }, h('img', { src: '/img/logo.svg', alt: '', width: 34, height: 34 }), site),
      h('div', { class: 'row' }, switcher('compact'), h('a', { class: 'btn secondary small', href: '/login' }, t('common.sign_in')), session.config && session.config.registrationOpen ? h('a', { class: 'btn small', href: '/register' }, t('auth.get_started')) : null)),
    h('section', { class: 'hero' }, h('div', {}, h('h1', {}, tag), h('p', { class: 'muted', style: { fontSize: '1.1rem' } }, t('auth.landing_text')),
      h('div', { class: 'row' }, session.config && session.config.registrationOpen ? h('a', { class: 'btn', href: '/register' }, t('auth.start_learning')) : null, h('a', { class: 'btn secondary', href: '/login' }, t('auth.i_have_account')))),
      h('img', { src: '/img/mascot.svg', alt: t('auth.mascot_alt') })),
    h('div', { class: 'grid three' }, feature('path', t('auth.feature_path'), t('auth.feature_path_text')), feature('bolt', t('auth.feature_motivation'), t('auth.feature_motivation_text')), feature('cards', t('auth.feature_words'), t('auth.feature_words_text'))));
  return { el, title: '', nav: '', bare: true };
}

const bar = (pct) => h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(pct) }, h('i', { style: { width: Math.round(pct) + '%' } }));
function weekChart(week) {
  const max = Math.max(10, ...week.map((x) => x.xp));
  return h('div', { class: 'week', role: 'img', 'aria-label': t('dashboard.week_aria', { list: week.map((x) => fmt.number(x.xp)).join(', ') }) },
    week.map((x) => h('div', { class: 'bar' + (x.xp ? '' : ' zero') }, h('span', {}, x.xp ? fmt.number(x.xp) : ''), h('i', { style: { height: Math.max(4, Math.round(80 * x.xp / max)) + 'px' } }), h('span', {}, fmt.weekday(x.date + 'T12:00:00')))));
}

export default async function home() {
  if (!session.user) return landing();
  const d = await get('/dashboard');
  const u = d.user;
  const goalPct = Math.min(100, Math.round(100 * d.today.xp / d.today.goal));
  const rec = d.recommended;

  const startRec = async (btn) => { btn.disabled = true; try { await startAttempt(rec.lessonId); } finally { btn.disabled = false; } };
  const contBtn = h('button', { class: 'btn', type: 'button' }, rec ? (rec.resume ? t('dashboard.continue_lesson') : t('dashboard.start_lesson')) : t('dashboard.view_course'));
  contBtn.addEventListener('click', () => (rec ? startRec(contBtn) : navigate('/learn')));

  const dl = d.daily, lr = d.learning;
  const startDaily = async (btn) => {
    btn.disabled = true;
    try { const st = await post('/daily/start'); navigate('/daily/' + st.attemptId); }
    catch (e) { toast(e instanceof ApiError ? e.message : t('app.error_text'), 'error', 5000); btn.disabled = false; }
  };
  const dailyBtn = h('button', { class: 'btn', type: 'button' }, dl.inProgress ? t('daily.continue') : dl.completedToday ? t('daily.again') : t('daily.start'));
  dailyBtn.addEventListener('click', () => startDaily(dailyBtn));
  const retake = h('button', { class: 'btn small', type: 'button' }, t('reassess.button'));
  retake.addEventListener('click', async () => { retake.disabled = true; try { await post('/assessment/start', {}); navigate('/placement'); } catch (e) { retake.disabled = false; toast(e instanceof ApiError ? e.message : t('app.error_text'), 'error', 5000); } });
  const rec2 = lr.recommendation;
  const levelUp = lr.lastChange && lr.lastChange.source === 'auto' && Date.now() - Date.parse(lr.lastChange.at) < 3 * 86400000;
  const banners = [
    levelUp ? h('div', { class: 'notice level-up', role: 'status' }, icon('star'), t('daily.level_up', { level: t('level.' + lr.level + '.short') })) : null,
    rec2 && rec2.reassess ? h('div', { class: 'notice reassess', role: 'note' }, h('span', {}, t('reassess.' + rec2.reason, { accuracy: rec2.accuracy, days: rec2.days })), retake) : null,
  ].filter(Boolean);

  const el = h('div', { class: 'stack' },
    h('div', { class: 'page-head' }, h('div', { class: 'hello' }, h('img', { src: '/img/mascot.svg', alt: '' }), h('div', {}, h('h1', {}, t('dashboard.hello', { name: u.displayName })), h('p', { class: 'muted', style: { margin: 0 } }, d.today.goalMet ? t('dashboard.goal_reached') : t('dashboard.xp_to_goal', { n: Math.max(0, d.today.goal - d.today.xp) }))))),
    h('section', { class: 'card continue-card', 'aria-labelledby': 'cont-h' },
      h('span', { class: 'eyebrow' }, d.course ? `${d.course.title}${rec ? ' · ' + rec.level : ''}` : t('dashboard.no_course')),
      h('h2', { id: 'cont-h' }, rec ? rec.title : d.course ? t('dashboard.all_done') : t('dashboard.no_published')),
      rec ? h('p', { style: { margin: 0, opacity: .9 } }, t('dashboard.unit', { title: rec.unit })) : null, contBtn),
    ...banners,
    lr.level ? h('section', { class: 'card daily-card', 'aria-labelledby': 'daily-h' },
      h('div', { class: 'row between' }, h('span', { class: 'eyebrow' }, t('daily.eyebrow')), h('a', { class: 'level-link', href: '/profile', title: t('level.change_hint') }, levelBadge(lr.level), h('span', { class: 'sr-only' }, levelName(lr.level)))),
      h('h2', { id: 'daily-h' }, dl.completedToday ? t('daily.done_title') : t('daily.title')),
      h('p', { class: 'muted' }, dl.inProgress ? t('daily.in_progress', { done: dl.inProgress.position, total: dl.inProgress.total }) : t('daily.text', { items: dl.items })),
      dl.reviewDue ? h('p', { class: 'small muted' }, t('daily.review_due', { n: dl.reviewDue })) : null,
      lr.weaknesses.length ? h('p', { class: 'small muted' }, t('daily.focus', { skills: lr.weaknesses.map(skillName).join(', ') })) : null,
      dailyBtn) : null,
    h('div', { class: 'stat-row' },
      h('div', { class: 'card stat' }, h('div', { class: 'ico', style: { color: 'var(--flame)' } }, icon('flame')), h('div', {}, h('b', {}, fmt.number(d.streak.current)), h('span', {}, d.streak.activeToday ? t('dashboard.streak_today') : t('dashboard.streak')))),
      h('div', { class: 'card stat' }, h('div', { class: 'ico', style: { color: 'var(--gold-ink)' } }, icon('bolt')), h('div', {}, h('b', {}, fmt.number(u.xpTotal)), h('span', {}, t('dashboard.total_xp')))),
      d.hearts.enabled ? h('div', { class: 'card stat' }, h('div', { class: 'ico', style: { color: 'var(--danger)' } }, icon('heart')), h('div', {}, h('b', {}, `${d.hearts.hearts} / ${d.hearts.max}`), h('span', {}, d.hearts.nextAt ? t('dashboard.next_heart', { time: fmt.time(d.hearts.nextAt) }) : t('dashboard.hearts')))) : null),
    h('div', { class: 'grid two' },
      h('section', { class: 'card', 'aria-labelledby': 'goal-h' }, h('h2', { id: 'goal-h' }, t('dashboard.daily_goal')),
        h('div', { class: 'row' }, h('div', { class: 'ring' + (d.today.goalMet ? ' met' : ''), style: { '--p': goalPct }, role: 'img', 'aria-label': t('dashboard.goal_percent', { p: goalPct }) }, h('div', {}, d.today.goalMet ? icon('check') : `${goalPct}%`)),
          h('div', {}, h('b', { style: { fontSize: '1.3rem' } }, t('dashboard.xp_of_goal', { xp: d.today.xp, goal: d.today.goal })), h('p', { class: 'muted small', style: { margin: 0 } }, t('dashboard.today_activity', { lessons: n('count.lessons', d.today.lessons), answers: n('count.answers', d.today.answers) }))))),
      h('section', { class: 'card', 'aria-labelledby': 'week-h' }, h('h2', { id: 'week-h' }, t('dashboard.week')), weekChart(d.week))),
    h('div', { class: 'grid two' },
      h('section', { class: 'card', 'aria-labelledby': 'prog-h' }, h('h2', { id: 'prog-h' }, t('dashboard.progress')),
        d.unit ? h('div', {}, h('div', { class: 'row between' }, h('b', {}, t('dashboard.unit', { title: d.unit.title })), h('span', { class: 'muted small' }, t('dashboard.lessons_progress', { done: d.unit.done, total: d.unit.total }))), bar(d.unit.total ? 100 * d.unit.done / d.unit.total : 0)) : null,
        d.level ? h('div', { style: { marginTop: '12px' } }, h('div', { class: 'row between' }, h('b', {}, t('dashboard.level', { code: d.level.code })), h('span', { class: 'muted small' }, `${d.level.pct}%`)), bar(d.level.pct)) : null,
        h('div', { style: { marginTop: '12px' } }, h('div', { class: 'row between' }, h('b', {}, t('dashboard.course')), h('span', { class: 'muted small' }, t('dashboard.lessons_progress', { done: d.lessons.done, total: d.lessons.lessons }))), bar(d.lessons.lessons ? 100 * d.lessons.done / d.lessons.lessons : 0))),
      h('section', { class: 'card', 'aria-labelledby': 'rev-h' }, h('h2', { id: 'rev-h' }, t('dashboard.practice')),
        h('p', { class: 'muted' }, d.review.due ? n('dashboard.words_due', d.review.due) : t('dashboard.words_due_none')),
        h('div', { class: 'row' }, h('a', { class: 'btn small' + (d.review.due ? '' : ' secondary'), href: '/review' }, t('dashboard.review_words')),
          d.mistakesAvailable ? h('a', { class: 'btn small secondary', href: '/practice' }, n('dashboard.fix_mistakes', d.mistakesAvailable)) : null),
        d.review.difficult ? h('p', { class: 'small muted', style: { marginTop: '10px' } }, n('dashboard.difficult_words', d.review.difficult)) : null)),
    h('section', { class: 'card', 'aria-labelledby': 'ach-h' }, h('div', { class: 'row between' }, h('h2', { id: 'ach-h' }, t('dashboard.recent_achievements')), h('a', { href: '/achievements', class: 'small' }, t('common.see_all'))),
      d.achievements.length ? h('div', { class: 'ach-row' }, d.achievements.map((a) => h('span', { class: 'ach-mini' }, icon(achievementIcon(a.icon)), t('ach.' + a.code + '.title')))) : h('p', { class: 'muted', style: { margin: 0 } }, t('dashboard.first_badge'))));
  return { el, title: t('nav.home'), nav: 'home' };
}
