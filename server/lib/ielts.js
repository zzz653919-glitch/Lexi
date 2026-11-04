/* Estimated IELTS band from a practice test. The practice tests are original and shorter than the real ones, so the share of correct
   answers is scaled to a 40-question paper and converted with the usual Academic Listening / Reading ranges. It is an ESTIMATE of readiness,
   not an official score and not a prediction. */
const RANGES = [[39, 9], [37, 8.5], [35, 8], [33, 7.5], [30, 7], [27, 6.5], [23, 6], [19, 5.5], [15, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [0, 2]];
function bandFromPercent(pct) {
  const raw40 = Math.round((Math.max(0, Math.min(100, pct)) / 100) * 40);
  return (RANGES.find(([min]) => raw40 >= min) || RANGES[RANGES.length - 1])[1];
}
const overall = (bands) => { const v = bands.filter((b) => typeof b === 'number'); if (!v.length) return null; const avg = v.reduce((a, b) => a + b, 0) / v.length; return Math.round(avg * 2) / 2; };
module.exports = { bandFromPercent, overall, RANGES };
