/* starting a lesson or a mistakes review: creates / resumes the attempt on the server, then opens the player */
import { post } from '../api.js';
import { toast } from '../ui.js';
import { navigate } from '../app.js';

export async function startAttempt(lessonId) {
  try { const a = await post(`/lessons/${lessonId}/start`); navigate('/attempt/' + a.attemptId); }
  catch (e) { toast(e.message, 'error', 5000); }
}
export async function startMistakes() {
  try { const a = await post('/practice/mistakes'); navigate('/attempt/' + a.attemptId); }
  catch (e) { toast(e.message, 'info', 5000); }
}
