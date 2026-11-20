/** The service's decisions, apart from its process and its pipes, so they can be tested. */
import { START_AT } from './config.mjs';

/** Milliseconds from `now` to the next `hh:mm` local; 0 never, so a fire at the minute schedules tomorrow. */
export const msUntil = (now, hhmm = START_AT) => {
  const [h, m] = hhmm.split(':').map(Number);
  const at = new Date(now);
  at.setHours(h, m, 0, 0);
  if (at <= now) at.setDate(at.getDate() + 1);
  return at - now;
};

/**
 * Whether the service should start a night by itself at `now`: past START_AT, no run live, and no
 * night started since today's START_AT (`lastStarted`, a Date or undefined). A night started after
 * midnight by hand does not stand in for that evening's.
 */
export const shouldAutoStart = ({ now, running, lastStarted, startAt = START_AT }) => {
  if (running) return false;
  const [h, m] = startAt.split(':').map(Number);
  const at = new Date(now);
  at.setHours(h, m, 0, 0);
  if (now < at) return false;
  return !lastStarted || lastStarted < at;
};

const list = (v) => (Array.isArray(v) ? v.join(',') : String(v));

/** `night.mjs`'s arguments for a `start` request's fields. Throws on a field it does not know. */
export const startArgs = (req) => {
  const known = new Set(['id', 'start', 'resume', 'areas', 'only', 'nodes', 'capUsd', 'budget', 'merge', 'sweep']);
  const unknown = Object.keys(req).filter((k) => !known.has(k));
  if (unknown.length > 0) throw new Error(`start does not take ${unknown.join(', ')}`);
  const args = [];
  if (req.resume !== undefined) args.push('--resume', String(Number(req.resume)));
  if (req.areas !== undefined) args.push('--areas', String(req.areas));
  if (req.only !== undefined) args.push('--only', list(req.only));
  if (req.nodes !== undefined) args.push('--nodes', list(req.nodes));
  if (req.capUsd !== undefined) args.push('--cap-usd', String(req.capUsd));
  for (const [role, usd] of Object.entries(req.budget ?? {})) {
    if (!['review', 'match', 'fix'].includes(role)) throw new Error(`budget has no role ${role}`);
    args.push(`--budget-${role}`, String(usd));
  }
  if (req.merge === false) args.push('--no-merge');
  if (req.sweep === true) args.push('--sweep');
  return args;
};

/**
 * Answers one request line. `deps` is the service's live side: `status()`, `plan()`, `start(args)`,
 * `stop(rounds)`, and `live()`, the rounds running now. `start` starts a run whatever else runs; `stop`
 * stops the run `round` names, or every one. Every reply echoes the request's `id`.
 */
export const handle = async (line, deps) => {
  let req;
  try {
    req = JSON.parse(line);
  } catch {
    return { error: 'not a JSON object' };
  }
  const reply = (body) => ({ id: req.id, ...body });
  try {
    if (req.ping) return reply({ pong: true, build: deps.build });
    if (req.status) return reply(deps.status());
    if (req.plan) return reply({ plan: await deps.plan() });
    if (req.start || req.resume !== undefined) return reply({ started: true, args: deps.start(startArgs(req)) });
    if (req.stop) {
      const live = deps.live();
      const round = req.round === undefined ? undefined : Number(req.round);
      if (round !== undefined && !live.includes(round)) return reply({ error: `round ${req.round} is not running`, running: live });
      const rounds = round !== undefined ? [round] : live;
      if (rounds.length === 0) return reply({ error: 'no run is running' });
      deps.stop(rounds);
      return reply({ stopping: rounds, note: 'no new jobs start; running jobs finish, then each run records and batches what completed' });
    }
    return reply({ error: 'unknown request; send ping, status, plan, start, resume or stop' });
  } catch (error) {
    return reply({ error: error.message });
  }
};
