/* lessons.level_id is the level of the lesson's unit; this statement makes every lesson agree with its unit (used after any write). */
const SYNC_SQL = 'UPDATE lessons SET level_id = (SELECT u.level_id FROM units u WHERE u.id = lessons.unit_id) WHERE level_id IS NOT (SELECT u.level_id FROM units u WHERE u.id = lessons.unit_id)';
module.exports = { SYNC_SQL };
