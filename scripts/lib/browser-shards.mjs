/**
 * How many Chromium processes run the browser project on a node with `cores` cores. Every tab of one
 * vitest process shares one Chromium, which caps it: more tabs there ran no faster, three processes
 * ran it 40-45% faster on 10-, 14- and 18-core nodes (`scripts/bench-browser-project.runs.jsonl`,
 * 2026-11-03). Nothing smaller was measured, so it keeps one.
 */
export const browserProcesses = (cores) => (cores >= 10 ? 3 : 1);

/**
 * The vitest argument lists that run the browser project as `n` concurrent processes, each its own
 * slice of the files. One list, unchanged, when `n` is 1 or the caller already asked for a slice.
 * An empty slice passes: three slices of two selected files leave one with none.
 */
export const browserShards = (argv, n) => {
  if (n <= 1 || argv.some((a) => a.startsWith('--shard'))) return [argv];
  const rest = argv.includes('--passWithNoTests') ? argv : [...argv, '--passWithNoTests'];
  return Array.from({ length: n }, (_, i) => [...rest, `--shard=${i + 1}/${n}`]);
};
