/* Runs every browser test file one after another: npm run test:ui */
const { spawnSync } = require('node:child_process');
const path = require('node:path');
let failed = 0;
for (const f of ['learner.ui.js', 'admin.ui.js', 'responsive.ui.js', 'i18n.ui.js']) {
  console.log(`\n=== ${f} ===`);
  const r = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(__dirname, f)], { stdio: 'inherit' });
  if (r.status !== 0) failed++;
}
console.log(failed ? `\n${failed} browser test file(s) FAILED` : '\nAll browser test files passed');
process.exit(failed ? 1 : 0);
