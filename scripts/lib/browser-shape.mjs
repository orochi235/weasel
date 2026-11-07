/**
 * How many Chromiums the browser project runs in on a node with `cores` cores, and how many tabs each
 * (`scripts/vitest-browser-spread.mjs` deals the tabs out). Files drawing WebGL slow each other within
 * one Chromium, so on 10 cores or more each tab gets its own. Alone on teitou (18 cores) on 2026-11-07,
 * 18 Chromiums of one tab ran the project in a mean of 76.2 s, nine of two in 78.7 s, six of three in
 * 82.5 s, and the three processes of six tabs they replaced in 94.8 s
 * (`scripts/bench-browser-project.runs.jsonl`).
 *
 * `beside` is for a run beside the jsdom projects (`scripts/vitest-overlap.mjs`), which finish last
 * there, so the browser project should take what CPU they leave rather than all it can use. On teitou,
 * the whole suite overlapped at the 3-core reserve took 184.0 s with 18 Chromiums, 153.7 and 150.0 s
 * with 12, 148.8 and 166.8 s with nine, and 164.7 s with the three processes of six tabs; 12 is the
 * lowest mean (`scripts/bench-overlap-reserve.runs.jsonl`). Nothing below 10 cores was measured, so it
 * keeps one Chromium of six tabs there. WEASEL_BROWSER_CHROMIUMS and WEASEL_BROWSER_TABS override
 * either count.
 */
export const browserShape = (cores, env = process.env, { beside = false } = {}) => {
  const wide = cores >= 10;
  return {
    chromiums: Number(env.WEASEL_BROWSER_CHROMIUMS) || (wide ? (beside ? 12 : 18) : 1),
    tabs: Number(env.WEASEL_BROWSER_TABS) || (wide ? 1 : 6),
  };
};
