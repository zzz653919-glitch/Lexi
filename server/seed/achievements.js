/* The achievement catalogue (created once; achievements an administrator changes or adds later are never touched) and the exclusive avatar items some of them give.
   Every achievement is measured from real activity (see server/lib/achievements.js): none can be unlocked without meeting its requirement.
   Texts are in English, Uzbek (the new Latin alphabet) and Russian. */
const FLAG = 'seeded_achievements_1';

/* default rewards by rarity: the rarer the achievement, the more it pays */
const REWARD = { common: [20, 10], rare: [50, 25], epic: [120, 60], legendary: [300, 150], mythic: [700, 400] };

/* [code, category, rarity, metric, target, icon, item, [title en, uz, ru], [description en, uz, ru]] */
const DEFS = [
  /* learning */
  ['first_lesson', 'learning', 'common', 'lessons', 1, 'flag', '', ['First Lesson', 'Birinçi dars', 'Первый урок'], ['Complete your first lesson.', 'Birinçi darsingizni tugating.', 'Завершите свой первый урок.']],
  ['lessons_10', 'learning', 'common', 'lessons', 10, 'path', '', ['Knowledge Seeker', 'Bilim izlovçi', 'Искатель знаний'], ['Complete 10 lessons.', '10 ta darsni tugating.', 'Завершите 10 уроков.']],
  ['lessons_50', 'learning', 'rare', 'lessons', 50, 'book', 'ach-scholar-backpack', ['Dedicated Learner', 'Qat’iyatli ŏquvçi', 'Преданный ученик'], ['Complete 50 lessons.', '50 ta darsni tugating.', 'Завершите 50 уроков.']],
  ['lessons_100', 'learning', 'epic', 'lessons', 100, 'trophy', 'ach-master-crown', ['Learning Master', 'Ŏqiş ustasi', 'Мастер обучения'], ['Complete 100 lessons.', '100 ta darsni tugating.', 'Завершите 100 уроков.']],
  ['words_100', 'learning', 'common', 'words', 100, 'cards', '', ['Vocabulary Beginner', 'Luğat boşlovçisi', 'Начинающий словарь'], ['Learn 100 words.', '100 ta sŏz ŏrganing.', 'Выучите 100 слов.']],
  ['words_500', 'learning', 'rare', 'words', 500, 'cards', 'ach-word-charm', ['Word Collector', 'Sŏz yiğuvçi', 'Коллекционер слов'], ['Learn 500 words.', '500 ta sŏz ŏrganing.', 'Выучите 500 слов.']],
  ['words_1000', 'learning', 'epic', 'words', 1000, 'book', 'ach-expert-shades', ['Vocabulary Expert', 'Luğat eksperti', 'Эксперт по словам'], ['Learn 1,000 words.', '1 000 ta sŏz ŏrganing.', 'Выучите 1 000 слов.']],
  ['grammar_master', 'learning', 'legendary', 'grammar', 1, 'shield', 'ach-grammar-owl', ['Grammar Master', 'Grammatika ustasi', 'Мастер грамматики'], ['Complete all grammar lessons.', 'Barça grammatika darslarini tugating.', 'Завершите все уроки грамматики.']],
  ['ielts_explorer', 'learning', 'rare', 'ielts_lessons', 1, 'globe', '', ['IELTS Explorer', 'IELTS tadqiqotçisi', 'Исследователь IELTS'], ['Complete your first IELTS lesson.', 'Birinçi IELTS darsingizni tugating.', 'Завершите свой первый урок IELTS.']],
  /* daily streak */
  ['streak_2', 'streak', 'common', 'streak', 2, 'flame', '', ['First Step', 'Birinçi qadam', 'Первый шаг'], ['Study for 2 consecutive days.', 'Ketma-ket 2 kun ŏqing.', 'Занимайтесь 2 дня подряд.']],
  ['streak_7', 'streak', 'rare', 'streak', 7, 'flame', 'ach-warrior-cap', ['Week Warrior', 'Hafta jangçisi', 'Воин недели'], ['Reach a 7-day streak.', '7 kunlik ketma-ketlikka erişing.', 'Достигните серии в 7 дней.']],
  ['streak_30', 'streak', 'epic', 'streak', 30, 'flame', 'ach-champion-wings', ['Monthly Champion', 'Oy çempioni', 'Чемпион месяца'], ['Reach a 30-day streak.', '30 kunlik ketma-ketlikka erişing.', 'Достигните серии в 30 дней.']],
  ['streak_100', 'streak', 'legendary', 'streak', 100, 'flame', 'ach-phoenix-dragon', ['Unstoppable', 'Tŏxtatib bŏlmas', 'Неудержимый'], ['Reach a 100-day streak.', '100 kunlik ketma-ketlikka erişing.', 'Достигните серии в 100 дней.']],
  ['streak_365', 'streak', 'mythic', 'streak', 365, 'sun', 'ach-cosmic-unicorn', ['Legendary Learner', 'Afsonaviy ŏquvçi', 'Легендарный ученик'], ['Reach a 365-day streak.', '365 kunlik ketma-ketlikka erişing.', 'Достигните серии в 365 дней.']],
  /* performance */
  ['perfect_score', 'performance', 'common', 'perfect_tests', 1, 'star', '', ['Perfect Score', 'Mukammal natija', 'Идеальный результат'], ['Get 100% on a test.', 'Testda 100% natija oling.', 'Получите 100% за тест.']],
  ['quiz_champion', 'performance', 'rare', 'quizzes', 20, 'target', '', ['Quiz Champion', 'Viktorina çempioni', 'Чемпион викторин'], ['Complete 20 quizzes.', '20 ta viktorinani tugating.', 'Завершите 20 викторин.']],
  ['sharp_mind', 'performance', 'epic', 'test_run', 10, 'bolt', 'ach-sharp-glasses', ['Sharp Mind', 'Otkir aql', 'Острый ум'], ['Pass 10 tests in a row.', 'Ketma-ket 10 ta testdan ŏting.', 'Сдайте 10 тестов подряд.']],
  ['fast_learner', 'performance', 'rare', 'fast_lessons', 1, 'bolt', '', ['Fast Learner', 'Tez ŏrganuvçi', 'Быстрый ученик'], ['Complete a lesson of at least 8 questions in under 3 minutes with 80% or better.', '8 va undan kŏp savolli darsni 3 daqiqadan kam vaqtda, 80% va undan yuqori natija bilan tugating.', 'Завершите урок минимум из 8 вопросов меньше чем за 3 минуты с результатом от 80%.']],
  ['consistency_king', 'performance', 'epic', 'accuracy', 100, 'chart', 'ach-royal-study', ['Consistency King', 'Barqarorlik qiroli', 'Король стабильности'], ['Answer correctly 90% or more over your last 100 answers.', 'Sŏnggi 100 ta javobingizning 90% va undan kŏpi tŏğri bŏlsin.', 'Отвечайте верно на 90% и больше из последних 100 ответов.']],
  /* levels */
  ['level_a1', 'level', 'common', 'level:A1', 1, 'check', '', ['A1 Completed', 'A1 tugallandi', 'A1 пройден'], ['Finish every lesson of level A1.', 'A1 darajasining barça darslarini tugating.', 'Завершите все уроки уровня A1.']],
  ['level_a2', 'level', 'rare', 'level:A2', 1, 'check', '', ['A2 Completed', 'A2 tugallandi', 'A2 пройден'], ['Finish every lesson of level A2.', 'A2 darajasining barça darslarini tugating.', 'Завершите все уроки уровня A2.']],
  ['level_b1', 'level', 'rare', 'level:B1', 1, 'check', 'ach-b1-shirt', ['B1 Completed', 'B1 tugallandi', 'B1 пройден'], ['Finish every lesson of level B1.', 'B1 darajasining barça darslarini tugating.', 'Завершите все уроки уровня B1.']],
  ['level_b2', 'level', 'epic', 'level:B2', 1, 'trophy', 'ach-b2-jacket', ['B2 Completed', 'B2 tugallandi', 'B2 пройден'], ['Finish every lesson of level B2.', 'B2 darajasining barça darslarini tugating.', 'Завершите все уроки уровня B2.']],
  ['level_c1', 'level', 'legendary', 'level:C1', 1, 'trophy', 'ach-summit-sky', ['C1 Completed', 'C1 tugallandi', 'C1 пройден'], ['Finish every lesson of level C1.', 'C1 darajasining barça darslarini tugating.', 'Завершите все уроки уровня C1.']],
  ['ielts_ready', 'level', 'mythic', 'level:IELTS', 1, 'globe', 'ach-golden-aura', ['IELTS Ready', 'IELTS ga tayyor', 'Готов к IELTS'], ['Complete the whole IELTS preparation course.', 'IELTS tayyorgarlik kursini tŏliq tugating.', 'Пройдите весь курс подготовки к IELTS.']],
  /* special */
  ['early_bird', 'special', 'common', 'morning', 1, 'sun', '', ['Early Bird', 'Erta turuvçi', 'Ранняя пташка'], ['Study in the morning (between 5:00 and 11:00).', 'Ertalab (5:00 dan 11:00 gaça) ŏqing.', 'Позанимайтесь утром (с 5:00 до 11:00).']],
  ['night_owl', 'special', 'common', 'evening', 1, 'moon', '', ['Night Owl', 'Tun quşi', 'Ночная сова'], ['Study in the evening or at night (after 20:00).', 'Kechqurun yoki tunda (20:00 dan keyin) ŏqing.', 'Позанимайтесь вечером или ночью (после 20:00).']],
  ['comeback', 'special', 'rare', 'comeback', 7, 'refresh', 'ach-comeback-sunrise', ['Comeback', 'Qaytiş', 'Возвращение'], ['Return to studying after 7 days away.', '7 kun tanaffusdan keyin ŏqişga qayting.', 'Вернитесь к занятиям после перерыва в 7 дней.']],
  ['explorer', 'special', 'rare', 'topics', 5, 'path', 'ach-explorer-hat', ['Explorer', 'Tadqiqotçi', 'Исследователь'], ['Complete lessons from 5 different topics.', '5 ta turli mavzudan darslarni tugating.', 'Завершите уроки из 5 разных тем.']],
  ['polyglot', 'special', 'epic', 'languages', 3, 'globe', 'ach-polyglot-lights', ['Polyglot Journey', 'Poliglot safari', 'Путь полиглота'], ['Use all three Lexio interface languages.', 'Lexio ning uç interfeys tilidan foydalaning.', 'Попробуйте все три языка интерфейса Lexio.']],
  /* milestones that existed before this system: kept (and never paid again) so nobody loses what they earned */
  ['lessons_25', 'milestone', 'common', 'lessons', 25, 'path', '', ['25 lessons', '25 ta dars', '25 уроков'], ['Complete 25 lessons.', '25 ta darsni tugating.', 'Завершите 25 уроков.']],
  ['perfect_lesson', 'milestone', 'common', 'perfect_lessons', 1, 'star', '', ['Flawless', 'Benuqson', 'Без ошибок'], ['Finish a lesson without a single mistake.', 'Darsni bitta ham xatosiz tugating.', 'Завершите урок без единой ошибки.']],
  ['streak_3', 'milestone', 'common', 'streak', 3, 'flame', '', ['Three in a row', 'Ketma-ket uç kun', 'Три дня подряд'], ['Reach a 3-day streak.', '3 kunlik ketma-ketlikka erişing.', 'Достигните серии в 3 дня.']],
  ['xp_100', 'milestone', 'common', 'xp', 100, 'bolt', '', ['100 XP', '100 XP', '100 XP'], ['Earn 100 XP.', '100 XP tŏplang.', 'Заработайте 100 XP.']],
  ['xp_500', 'milestone', 'common', 'xp', 500, 'bolt', '', ['500 XP', '500 XP', '500 XP'], ['Earn 500 XP.', '500 XP tŏplang.', 'Заработайте 500 XP.']],
  ['xp_2000', 'milestone', 'common', 'xp', 2000, 'bolt', '', ['2000 XP', '2000 XP', '2000 XP'], ['Earn 2000 XP.', '2000 XP tŏplang.', 'Заработайте 2000 XP.']],
  ['daily_goal', 'milestone', 'common', 'goal_days', 1, 'target', '', ['Goal reached', 'Maqsadga erişildi', 'Цель достигнута'], ['Reach your daily XP goal.', 'Kunlik XP maqsadingizga erişing.', 'Достигните своей дневной цели по XP.']],
  ['first_review', 'milestone', 'common', 'review_correct', 10, 'cards', '', ['Word keeper', 'Sŏz saqlovçi', 'Хранитель слов'], ['Answer 10 vocabulary review questions correctly.', 'Luğat takrorlaş bŏyiça 10 ta savolga tŏğri javob bering.', 'Ответьте верно на 10 вопросов повторения слов.']],
  ['reviews_100', 'milestone', 'common', 'review_correct', 100, 'cards', '', ['Memory master', 'Xotira ustasi', 'Мастер памяти'], ['Answer 100 vocabulary review questions correctly.', 'Luğat takrorlaş bŏyiça 100 ta savolga tŏğri javob bering.', 'Ответьте верно на 100 вопросов повторения слов.']],
  ['level_complete', 'milestone', 'common', 'levels_done', 1, 'trophy', '', ['Level complete', 'Daraja tugallandi', 'Уровень пройден'], ['Finish every lesson of a level.', 'Darajaning barça darslarini tugating.', 'Завершите все уроки уровня.']],
];
/* the legacy milestones pay nothing (they were free before); the new ones pay by rarity */
const LEGACY = new Set(DEFS.filter((d) => d[1] === 'milestone').map((d) => d[0]));

/* exclusive avatar items: not for sale, earned only through the achievement named in earn_rule ("ach:code") */
const ITEMS = [
  ['ach-scholar-backpack', 'Scholar Backpack', 'Ŏquvçi ryukzagi', 'Рюкзак ученика', 'backpack', 'rare', { c: '#2f7bff', c2: '#f2b705', p: 'solid' }, 'lessons_50'],
  ['ach-word-charm', 'Word Collector Charm', 'Sŏz yiğuvçi tumori', 'Талисман коллекционера слов', 'necklace', 'rare', { c: '#16b8a6', c2: '#ffd86b', p: 'solid' }, 'words_500'],
  ['ach-warrior-cap', 'Warrior Cap', 'Jangçi beysbolkasi', 'Кепка воина', 'cap', 'rare', { c: '#e63946', c2: '#f2b705', p: 'stripes' }, 'streak_7'],
  ['ach-b1-shirt', 'B1 Achiever Shirt', 'B1 yutuq kŏylagi', 'Рубашка покорителя B1', 'shirt', 'rare', { c: '#2f7bff', c2: '#ffffff', p: 'stripes' }, 'level_b1'],
  ['ach-comeback-sunrise', 'Comeback Sunrise', 'Qaytiş tongi', 'Рассвет возвращения', 'background', 'rare', { c: '#ff9a6b', c2: '#ffd86b', v: 'sunset' }, 'comeback'],
  ['ach-explorer-hat', 'Explorer Hat', 'Tadqiqotçi şlyapasi', 'Шляпа исследователя', 'hat', 'rare', { c: '#a6742a', c2: '#f2b705', p: 'solid' }, 'explorer'],
  ['ach-master-crown', 'Master Crown', 'Usta tojisi', 'Корона мастера', 'hat', 'epic', { c: '#f2b705', c2: '#ff8a1f', p: 'solid' }, 'lessons_100'],
  ['ach-expert-shades', 'Expert Shades', 'Ekspert kŏzoynagi', 'Очки эксперта', 'sunglasses', 'epic', { c: '#8e5bd9', c2: '#ffffff', p: 'solid' }, 'words_1000'],
  ['ach-champion-wings', 'Champion Wings', 'Çempion qanotlari', 'Крылья чемпиона', 'wings', 'epic', { c: '#f2b705', c2: '#ffffff', p: 'solid' }, 'streak_30'],
  ['ach-sharp-glasses', 'Sharp Mind Glasses', 'Otkir aql kŏzoynagi', 'Очки острого ума', 'glasses', 'epic', { c: '#2f7bff', c2: '#ffffff', p: 'solid' }, 'sharp_mind'],
  ['ach-royal-study', 'Royal Study', 'Qirollik kutubxonasi', 'Королевская библиотека', 'background', 'epic', { c: '#3a2f8a', c2: '#f2b705', v: 'castle' }, 'consistency_king'],
  ['ach-b2-jacket', 'B2 Achiever Jacket', 'B2 yutuq kurtkasi', 'Куртка покорителя B2', 'jacket', 'epic', { c: '#8e5bd9', c2: '#f2b705', p: 'stripes' }, 'level_b2'],
  ['ach-polyglot-lights', 'Polyglot Lights', 'Poliglot nurlari', 'Огни полиглота', 'effect', 'epic', { c: '#7fd8ff', v: 'sparkles' }, 'polyglot'],
  ['ach-grammar-owl', 'Grammar Owl', 'Grammatika boyquşi', 'Сова грамматики', 'bird', 'legendary', { c: '#5b4bd6', c2: '#f2b705', p: 'solid' }, 'grammar_master'],
  ['ach-phoenix-dragon', 'Phoenix Dragon', 'Feniks ajdaho', 'Дракон-феникс', 'dragon', 'legendary', { c: '#ff4d2d', c2: '#ffb02e', p: 'solid' }, 'streak_100'],
  ['ach-summit-sky', 'Summit Sky', 'Cŏqqi osmoni', 'Небо вершины', 'background', 'legendary', { c: '#1a1060', c2: '#7fd8ff', v: 'space' }, 'level_c1'],
  ['ach-cosmic-unicorn', 'Cosmic Unicorn', 'Kosmik yakkaşox', 'Космический единорог', 'fantasy', 'mythic', { c: '#8e5bd9', c2: '#33e0ff', p: 'solid', v: 'rainbow' }, 'streak_365'],
  ['ach-golden-aura', 'Golden Aura', 'Oltin nur', 'Золотая аура', 'effect', 'mythic', { c: '#ffd86b', v: 'flames' }, 'ielts_ready'],
];

async function ensureAchievements(db) {
  if (await db.get('SELECT 1 x FROM settings WHERE key = ?', FLAG)) return;
  const t = new Date().toISOString(), stmts = [];
  const top = ((await db.get('SELECT MAX(position) m FROM avatar_items')) || {}).m || 0;
  ITEMS.forEach(([slug, en, uz, ru, kind, rarity, art, code], i) => {
    const slot = require('../lib/avatar-spec').KIND_SLOT[kind];
    stmts.push({ sql: `INSERT OR IGNORE INTO avatar_items (slug, name_en, name_uz, name_ru, kind, slot, price, rarity, art, earn_rule, starter, position, created_at, updated_at)
      VALUES (?,?,?,?,?,?,0,?,?,?,0,?,?,?)`, args: [slug, en, uz, ru, kind, slot, rarity, JSON.stringify(art), 'ach:' + code, top + i + 1, t, t] });
  });
  DEFS.forEach(([code, category, rarity, metric, target, icon, item, [te, tu, tr], [de, du, dr]], i) => {
    const [xp, tokens] = LEGACY.has(code) ? [0, 0] : REWARD[rarity];
    stmts.push({ sql: `INSERT OR IGNORE INTO achievement_defs (code, category, rarity, metric, target, icon, xp, tokens, item_slug, badge, status, position, title_en, title_uz, title_ru, desc_en, desc_uz, desc_ru, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?, 'active', ?,?,?,?,?,?,?,?,?)`, args: [code, category, rarity, metric, target, icon, xp, tokens, item, category === 'milestone' ? 0 : 1, (i + 1) * 10, te, tu, tr, de, du, dr, t, t] });
  });
  for (let i = 0; i < stmts.length; i += 40) await db.batch(stmts.slice(i, i + 40));
  await db.run("INSERT OR IGNORE INTO settings (key, value) VALUES (?, 'true')", FLAG);
}
module.exports = { ensureAchievements, DEFS, ITEMS, REWARD };
