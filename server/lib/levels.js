/* CEFR levels used by Lexio. "A0" is Pre-A1 (complete beginner); the UI shows it as "Pre-A1". Levels are ordered by index 0..6. */
const LEVELS = ['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const index = (code) => LEVELS.indexOf(code);
const valid = (code) => index(code) >= 0;
const clampIndex = (i) => Math.max(0, Math.min(LEVELS.length - 1, Math.round(i)));
const code = (i) => LEVELS[clampIndex(i)];

/* skills measured by the placement test (question categories) */
const SKILLS = ['vocabulary', 'grammar', 'reading', 'usage', 'completion', 'expressions', 'listening'];
/* skills tracked continuously while learning */
const TRACKED = ['vocabulary', 'grammar', 'reading', 'listening'];
/* how placement categories roll up for the results screen and for the tracked skills */
const REPORT_GROUPS = { vocabulary: ['vocabulary'], grammar: ['grammar', 'completion'], reading: ['reading'], usage: ['usage', 'expressions'], listening: ['listening'] };
const TRACKED_OF = { vocabulary: 'vocabulary', usage: 'vocabulary', expressions: 'vocabulary', grammar: 'grammar', completion: 'grammar', reading: 'reading', listening: 'listening' };
/* skill measured by an ordinary exercise type (an explicit exercises.skill wins) */
const SKILL_OF_TYPE = {
  translation_choice: 'vocabulary', translate_type: 'vocabulary', match_pairs: 'vocabulary', scramble_letters: 'vocabulary', fix_spelling: 'vocabulary',
  multiple_choice: 'grammar', fill_blank: 'grammar', order_words: 'grammar', reading: 'reading', listen_choice: 'listening', listen_type: 'listening',
};

/* the roadmap level a CEFR result opens: a placement opens up to B2 at most (the advanced levels are earned or chosen) */
const ROADMAP_OF = ['A1', 'A1', 'A2', 'B1', 'B2', 'B2', 'B2'];
const roadmapCode = (cefr) => ROADMAP_OF[Math.max(0, index(cefr))] || 'A1';
/* the CEFR level the content (daily lesson, words, plan) follows for a roadmap level; IELTS preparation works at C1 */
const cefrOfRoadmap = (code) => (code === 'IELTS' ? 'C1' : valid(code) ? code : 'A1');

module.exports = { roadmapCode, cefrOfRoadmap, LEVELS, index, valid, code, clampIndex, SKILLS, TRACKED, REPORT_GROUPS, TRACKED_OF, SKILL_OF_TYPE };
