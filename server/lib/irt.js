/* The statistics behind the adaptive placement test (pure functions, no database).

   Model: every question has a difficulty b = level index - 0.5 (A0 = 0 … C2 = 6) and a learner has an ability θ on the same 0-6 scale.
   The chance of a correct answer is   g + (1 - g) · sigmoid(A · (θ - b))
   with g the chance of guessing (1 / number of options for a multiple-choice question, ~0 for a typed answer) and A the steepness.
   A learner whose ability equals the level index therefore gets about 77% of that level's multiple-choice questions right.
   After every answer the probability of each possible ability (a grid from 0 to 7, so the top level can be reached) is updated with Bayes' rule, so one lucky guess
   or one slip can never decide the result: the estimate is the mean of the posterior and its uncertainty is the posterior standard deviation. */
const A = 1.6;
const STEP = 0.1;
const GRID = Array.from({ length: 71 }, (_, i) => Math.round(i * STEP * 10) / 10);
const sigmoid = (x) => 1 / (1 + Math.exp(-x));

const difficulty = (levelIndex) => levelIndex - 0.5;
const guessOf = (format, optionCount) => (format === 'type' ? 0.02 : 1 / Math.max(2, optionCount || 4));

/* probability of a correct answer at ability theta; a "don't know" is an honest non-answer, so there is no guessing */
function pCorrect(theta, levelIndex, { format = 'choice', options = 4, dontKnow = false } = {}) {
  const base = sigmoid(A * (theta - difficulty(levelIndex)));
  const g = dontKnow ? 0 : guessOf(format, options);
  return g + (1 - g) * base;
}

const normal = (x, mean, sd) => Math.exp(-0.5 * ((x - mean) / sd) ** 2);

/* responses: [{ level: index, correct: bool, format, options, dontKnow }] -> { mean, sd, posterior } */
function estimate(responses, prior = { mean: 1.6, sd: 1.6 }) {
  const w = GRID.map((t) => normal(t, prior.mean, prior.sd));
  for (const r of responses) {
    for (let i = 0; i < GRID.length; i++) {
      const p = pCorrect(GRID[i], r.level, r);
      w[i] *= r.correct ? p : 1 - p;
    }
    const s = w.reduce((a, b) => a + b, 0) || 1;   // renormalise to avoid underflow
    for (let i = 0; i < w.length; i++) w[i] /= s;
  }
  const total = w.reduce((a, b) => a + b, 0) || 1;
  const post = w.map((x) => x / total);
  const mean = post.reduce((a, p, i) => a + p * GRID[i], 0);
  const sd = Math.sqrt(post.reduce((a, p, i) => a + p * (GRID[i] - mean) ** 2, 0));
  return { mean, sd, posterior: post };
}

/* ability -> level index using the (configurable) cut-offs: the ability needed for A1, A2, B1, B2, C1, C2 */
function levelIndexFor(theta, cutoffs) { let i = 0; for (const c of cutoffs) if (theta >= c) i++; return i; }

module.exports = { A, GRID, difficulty, guessOf, pCorrect, estimate, levelIndexFor };
