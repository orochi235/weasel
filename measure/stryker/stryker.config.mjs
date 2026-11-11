const pkg = process.env.MEASURE_PKG ?? 'geom';
const tools = new URL('../../node_modules/.stryker-tools/node_modules/', import.meta.url).pathname;

export default {
  testRunner: 'vitest',
  plugins: [`${tools}@stryker-mutator/vitest-runner/dist/src/index.js`],
  disableTypeChecks: `packages/${pkg}/src/**/*.{ts,tsx}`,
  vitest: { configFile: 'measure/stryker/vitest.config.ts', related: false },
  mutate: [`packages/${pkg}/src/**/*.{ts,tsx}`, '!**/*.test.{ts,tsx}', '!**/*.d.ts'],
  coverageAnalysis: 'perTest',
  disableBail: true,
  ignoreStatic: true,
  inPlace: true,
  tempDirName: 'node_modules/.stryker-tmp',
  ...(Number(process.env.MEASURE_CONCURRENCY) > 0 ? { concurrency: Number(process.env.MEASURE_CONCURRENCY) } : {}),
  dryRunOnly: process.env.MEASURE_DRY === '1',
  timeoutMS: 10000,
  reporters: ['json', 'progress-append-only', 'clear-text'],
  clearTextReporter: { reportMutants: false, reportTests: false, reportScoreTable: true },
  jsonReporter: { fileName: `measure/out/${pkg}/mutation.json` },
};
