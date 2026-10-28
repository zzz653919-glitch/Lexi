import { h, icon, avatar, fmt } from '../ui.js';
import { get, post, session } from '../api.js';
import { navigate } from '../app.js';
import { startAttempt } from './start.js';

function landing() {
  const site = session.config ? session.config.siteName : 'Lexi Learn';
  const tag = session.config ? session.config.tagline : '';
  const feature = (ic, t, d) => h('div', { class: 'card' }, h('div', { class: 'stat' }, h('div', { class: 'ico' }, icon(ic)), h('div', {}, h('b', { style: { fontSize: '1.05rem' } }, t), h('span', {}, d))));
  const el = h('div', { class: 'landing' },
    h('div', { class: 'landing-nav' }, h('a', { class: 'brand', href: '/', style: { padding: 0 } }, h('img', { src: '/img/logo.svg', alt: '', width: 34, height: 34 }), site),
      h('div', { class: 'row' }, h('a', { class: 'btn secondary small', href: '/login' }, 'Sign in'), session.config && session.config.registrationOpen ? h('a', { class: 'btn small', href: '/register' }, 'Get started') : null)),
    h('section', { class: 'hero' }, h('div', {}, h('h1', {}, tag || 'Learn English a little every day'), h('p', { class: 'muted', style: { fontSize: '1.1rem' } }, 'Short lessons, real exercises, daily goals and a vocabulary trainer — from A1 beginner to C1 advanced, with Uzbek translations.'),
      h('div', { class: 'row' }, session.config && session.config.registrationOpen ? h('a', { class: 'btn', href: '/register' }, 'Start learning') : null, h('a', { class: 'btn secondary', href: '/login' }, 'I have an account'))),
      h('img', { src: '/img/mascot.svg', alt: 'Sprig the sprout waving hello' })),
    h('div', { class: 'grid three' }, feature('path', 'A clear path', 'Units and lessons that unlock step by step.'), feature('bolt', 'Daily motivation', 'XP, streaks, hearts and achievements.'), feature('cards', 'Words that stay', 'Spaced repetition brings words back at the right time.')));
  return { el, title: '', nav: '', bare: true };
}

export default async function home() {
  if (!session.user) return landing();
  const d = await get('/dashboard');
  const u = d.user;
  const goalPct = Math.min(100, Math.round(100 * d.today.xp / d.today.goal));
  const rec = d.recommended;

  const startRec = async (btn) => { btn.disabled = true; try { await startAttempt(rec.lessonId); } finally { btn.disabled = false; } };
  const contBtn = h('button', { class: 'btn', type: 'button' }, rec ? (rec.resume ? 'Continue lesson' : 'Start lesson') : 'View course');
  contBtn.addEventListener('click', () => (rec ? startRec(contBtn) : navigate('/learn')));

  const el = h('div', { class: 'stack' },
    h('div', { class: 'page-head' }, h('div', { class: 'hello' }, h('img', { src: '/img/mascot.svg', alt: '' }), h('div', {}, h('h1', {}, `Hello, ${u.displayName}!`), h('p', { class: 'muted', style: { margin: 0 } }, d.today.goalMet ? 'Daily goal reached — great work!' : `${Math.max(0, d.today.goal - d.today.xp)} XP to reach today's goal.`)))),
    h('section', { class: 'card continue-card', 'aria-labelledby': 'cont-h' },
      h('span', { class: 'eyebrow' }, d.course ? `${d.course.title}${rec ? ' · ' + rec.level : ''}` : 'No course yet'),
      h('h2', { id: 'cont-h' }, rec ? rec.title : d.course ? 'You have finished every available lesson!' : 'No published course is available yet'),
      rec ? h('p', { style: { margin: 0, opacity: .9 } }, `Unit: ${rec.unit}`) : null, contBtn),
    h('div', { class: 'grid three' },
      h('div', { class: 'card stat' }, h('div', { class: 'ico', style: { color: '#e8590c' } }, icon('flame')), h('div', {}, h('b', {}, String(d.streak.current)), h('span', {}, d.streak.activeToday ? 'day streak · done today' : 'day streak'))),
      h('div', { class: 'card stat' }, h('div', { class: 'ico', style: { color: '#b7791f' } }, icon('bolt')), h('div', {}, h('b', {}, String(u.xpTotal)), h('span', {}, 'total XP'))),
      d.hearts.enabled ? h('div', { class: 'card stat' }, h('div', { class: 'ico', style: { color: 'var(--danger)' } }, icon('heart')), h('div', {}, h('b', {}, `${d.hearts.hearts} / ${d.hearts.max}`), h('span', {}, d.hearts.nextAt ? `next heart ${fmt.time(d.hearts.nextAt)}` : 'hearts'))) : null),
    h('div', { class: 'grid two' },
      h('section', { class: 'card', 'aria-labelledby': 'goal-h' }, h('h2', { id: 'goal-h' }, "Today's goal"),
        h('div', { class: 'row' }, h('div', { class: 'ring' + (d.today.goalMet ? ' met' : ''), style: { '--p': goalPct }, role: 'img', 'aria-label': `${goalPct}% of daily goal` }, h('div', {}, d.today.goalMet ? icon('check') : `${goalPct}%`)),
          h('div', {}, h('b', { style: { fontSize: '1.3rem' } }, `${d.today.xp} / ${d.today.goal} XP`), h('p', { class: 'muted small', style: { margin: 0 } }, `${d.today.lessons} lesson${d.today.lessons === 1 ? '' : 's'} · ${d.today.answers} answers today`)))),
      h('section', { class: 'card', 'aria-labelledby': 'week-h' }, h('h2', { id: 'week-h' }, 'This week'), weekChart(d.week))),
    h('div', { class: 'grid two' },
      h('section', { class: 'card', 'aria-labelledby': 'prog-h' }, h('h2', { id: 'prog-h' }, 'Your progress'),
        d.unit ? h('div', {}, h('div', { class: 'row between' }, h('b', {}, `Unit: ${d.unit.title}`), h('span', { class: 'muted small' }, `${d.unit.done} / ${d.unit.total} lessons`)), bar(d.unit.total ? 100 * d.unit.done / d.unit.total : 0)) : null,
        d.level ? h('div', { style: { marginTop: '12px' } }, h('div', { class: 'row between' }, h('b', {}, `Level ${d.level.code}`), h('span', { class: 'muted small' }, `${d.level.pct}%`)), bar(d.level.pct)) : null,
        h('div', { style: { marginTop: '12px' } }, h('div', { class: 'row between' }, h('b', {}, 'Course'), h('span', { class: 'muted small' }, `${d.lessons.done} / ${d.lessons.lessons} lessons`)), bar(d.lessons.pct ?? (d.lessons.lessons ? 100 * d.lessons.done / d.lessons.lessons : 0)))),
      h('section', { class: 'card', 'aria-labelledby': 'rev-h' }, h('h2', { id: 'rev-h' }, 'Practice'),
        h('p', { class: 'muted' }, d.review.due ? `${d.review.due} word${d.review.due === 1 ? '' : 's'} ready to review.` : 'No words are due right now.'),
        h('div', { class: 'row' }, h('a', { class: 'btn small' + (d.review.due ? '' : ' secondary'), href: '/review' }, 'Review words'),
          d.mistakesAvailable ? h('a', { class: 'btn small secondary', href: '/practice' }, `Fix ${d.mistakesAvailable} mistake${d.mistakesAvailable === 1 ? '' : 's'}`) : null),
        d.review.difficult ? h('p', { class: 'small muted', style: { marginTop: '10px' } }, `${d.review.difficult} difficult word${d.review.difficult === 1 ? '' : 's'} on your list.`) : null)),
    h('section', { class: 'card', 'aria-labelledby': 'ach-h' }, h('div', { class: 'row between' }, h('h2', { id: 'ach-h' }, 'Recent achievements'), h('a', { href: '/achievements', class: 'small' }, 'See all')),
      d.achievements.length ? h('div', { class: 'ach-row' }, d.achievements.map((a) => h('span', { class: 'ach-mini' }, icon(a.icon === 'flame' ? 'flame' : a.icon === 'bolt' ? 'bolt' : a.icon === 'trophy' ? 'trophy' : a.icon === 'target' ? 'target' : a.icon === 'cards' ? 'cards' : a.icon === 'flag' ? 'flag' : 'star'), a.title))) : h('p', { class: 'muted', style: { margin: 0 } }, 'Finish your first lesson to earn your first badge.')));
  return { el, title: 'Home', nav: 'home' };
}
const bar = (pct) => h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(pct) }, h('i', { style: { width: Math.round(pct) + '%' } }));
function weekChart(week) {
  const max = Math.max(10, ...week.map((x) => x.xp));
  return h('div', { class: 'week', role: 'img', 'aria-label': 'XP over the last 7 days: ' + week.map((x) => x.xp).join(', ') },
    week.map((x) => h('div', { class: 'bar' + (x.xp ? '' : ' zero') }, h('span', {}, x.xp ? String(x.xp) : ''), h('i', { style: { height: Math.max(4, Math.round(80 * x.xp / max)) + 'px' } }), h('span', {}, new Date(x.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'narrow' })))));
}
