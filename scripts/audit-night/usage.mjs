/** What a `claude -p --output-format json` job reports about itself, as one usage record per job. */

/** The envelope's fields as `{ reply, record }`; `record` lacks the job's own area, role and node. */
export const parseEnvelope = (raw) => {
  let env = {};
  try {
    env = raw ? JSON.parse(raw) : {};
  } catch {
    env = { result: raw };
  }
  const u = env.usage ?? {};
  const tokens = {
    input: u.input_tokens ?? 0,
    output: u.output_tokens ?? 0,
    cacheCreation: u.cache_creation_input_tokens ?? 0,
    cacheRead: u.cache_read_input_tokens ?? 0,
  };
  const reason = env.terminal_reason ?? env.subtype ?? (raw ? 'unknown' : 'no envelope');
  return {
    reply: String(env.result ?? ''),
    record: {
      models: Object.keys(env.modelUsage ?? {}),
      tokens,
      totalTokens: tokens.input + tokens.output + tokens.cacheCreation + tokens.cacheRead,
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
  tokens: records.reduce((s, r) => s + r.totalTokens, 0),
  costUsd: records.reduce((s, r) => s + r.costUsd, 0),
});

/**
 * Whether a night that has spent `used` tokens, with `inFlight` areas still running, may start another
 * area, expecting each to cost the mean of `finished` (token totals of its finished areas) or `guess`.
 */
export const mayStartArea = ({ used, finished, inFlight, cap, guess }) => {
  const expected = finished.length > 0 ? finished.reduce((s, n) => s + n, 0) / finished.length : guess;
  return used + (inFlight + 1) * expected <= cap;
};
