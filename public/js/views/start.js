/* starting a lesson or a mistakes review: creates / resumes the attempt on the server, then opens the player.
   A loading animation covers the screen only while the server really is working (it never flashes for quick requests). */
import { post } from '../api.js';
import { toast } from '../ui.js';
import { navigate } from '../app.js';
import { overlay } from '../loaders.js';

export async function startAttempt(lessonId) {
  const stop = overlay('lesson');
  try { const a = await post(`/lessons/${lessonId}/start`); await navigate('/attempt/' + a.attemptId); }
  catch (e) { toast(e.message, 'error', 5000); }
  finally { stop(); }
}
export async function startMistakes() {
  const stop = overlay('quiz');
  try { const a = await post('/practice/mistakes'); await navigate('/attempt/' + a.attemptId); }
  catch (e) { toast(e.message, 'info', 5000); }
  finally { stop(); }
}
