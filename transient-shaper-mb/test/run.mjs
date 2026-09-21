// Dependency-free test runner. `npm test`.

import { tests as dspTests } from './dsp.test.mjs';

const SUITES = [['DSP', dspTests]];

let passed = 0;
let failed = 0;

for (const [suiteName, tests] of SUITES) {
  console.log(`\n${suiteName}`);
  for (const test of tests) {
    const details = [];
    const t = {
      detail: (msg) => details.push(msg),
      assert: (cond, msg) => {
        if (!cond) throw new Error(msg || 'assertion failed');
      },
    };
    try {
      test.run(t);
      passed++;
      console.log(`  ✓ ${test.name}`);
    } catch (err) {
      failed++;
      console.log(`  ✗ ${test.name}`);
      console.log(`      ${err.message}`);
    }
    for (const d of details) console.log(`      • ${d}`);
  }
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
