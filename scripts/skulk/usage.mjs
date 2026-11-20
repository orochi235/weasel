/** What a `claude -p --output-format json` job reports about itself, as one usage record per job. */

/**
 * What each kind of token costs against an input token, the same ratios for every Claude model: a cache read is
 * a tenth of one, so a long session's rereads count for what they cost, not for their bulk.
 */
export const TOKEN_WEIGHTS = { input: 1, output: 5, cacheWrite5m: 1.25, cacheWrite1h: 2, cacheRead: 0.1 };

/** `tokens` counted as input tokens of equal cost. */
export const weightedTokens = (tokens) =>
  Math.round(Object.entries(TOKEN_WEIGHTS).reduce((s, [kind, w]) => s + (tokens[kind] ?? 0) * w, 0));

/** The envelope's fields as `{ reply, record }`; `record` lacks the job's own area, role and node. */
export const parseEnvelope = (raw) => {
  let env = {};
  try {
    env = raw ? JSON.parse(raw) : {};
  } catch {
    env = { result: raw };
  }
  const u = env.usage ?? {};
  const cacheCreation = u.cache_creation_input_tokens ?? 0;
  const cacheWrite1h = u.cache_creation?.ephemeral_1h_input_tokens ?? 0;
  const tokens = {
    input: u.input_tokens ?? 0,
    output: u.output_tokens ?? 0,
    cacheWrite5m: cacheCreation - cacheWrite1h,
    cacheWrite1h,
    cacheRead: u.cache_read_input_tokens ?? 0,
  };
  const reason = env.terminal_reason ?? env.subtype ?? (raw ? 'unknown' : 'no envelope');
  return {
    reply: String(env.report ?? env.result ?? ''),
    record: {
      models: Object.keys(env.modelUsage ?? {}),
      tokens,
      weightedTokens: weightedTokens(tokens),
      costUsd: env.total_cost_usd ?? Object.values(env.modelUsage ?? {}).reduce((s, m) => s + (m.costUSD ?? 0), 0),
      durationMs: env.duration_ms ?? 0,
      terminalReason: reason,
      subtype: env.subtype,
      budgetHit: /budget/i.test(`${env.subtype ?? ''} ${env.terminal_reason ?? ''}`),
    },
  };
};

/** Sums of a list of usage records. */
export const totals = (records) => ({
  weightedTokens: records.reduce((s, r) => s + r.weightedTokens, 0),
  costUsd: records.reduce((s, r) => s + r.costUsd, 0),
});

/**
 * Whether a night that has spent `used` dollars, with `inFlight` areas still running, may start another
 * area, expecting each to cost the mean of `finished` (dollar costs of its finished areas) or `guess`.
 */
export const mayStartArea = ({ used, finished, inFlight, cap, guess }) => {
  const expected = finished.length > 0 ? finished.reduce((s, n) => s + n, 0) / finished.length : guess;
  return used + (inFlight + 1) * expected <= cap;
};
