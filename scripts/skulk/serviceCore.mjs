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
 * Whether the service should start a night by itself at `now`: past START_AT, nothing running, and no
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
  const known = new Set(['id', 'start', 'areas', 'only', 'nodes', 'capUsd', 'budget', 'merge']);
  const unknown = Object.keys(req).filter((k) => !known.has(k));
  if (unknown.length > 0) throw new Error(`start does not take ${unknown.join(', ')}`);
  const args = [];
  if (req.areas !== undefined) args.push('--areas', String(req.areas));
  if (req.only !== undefined) args.push('--only', list(req.only));
  if (req.nodes !== undefined) args.push('--nodes', list(req.nodes));
  if (req.capUsd !== undefined) args.push('--cap-usd', String(req.capUsd));
  for (const [role, usd] of Object.entries(req.budget ?? {})) {
    if (!['review', 'match', 'fix'].includes(role)) throw new Error(`budget has no role ${role}`);
    args.push(`--budget-${role}`, String(usd));
  }
  if (req.merge === false) args.push('--no-merge');
  return args;
};

/**
 * Answers one request line. `deps` is the service's live side: `status()`, `plan()`, `start(args)`,
 * `stop()`, `running()`. Every reply echoes the request's `id`.
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
    if (req.start) {
      if (deps.running()) return reply({ error: 'a night is already running', ...deps.status() });
      return reply({ started: true, args: deps.start(startArgs(req)) });
    }
    if (req.stop) {
      if (!deps.running()) return reply({ error: 'no night is running' });
      deps.stop();
      return reply({ stopping: true, note: 'no new jobs start; running jobs finish, then the night records and batches what completed' });
    }
    return reply({ error: 'unknown request; send ping, status, plan, start or stop' });
  } catch (error) {
    return reply({ error: error.message });
  }
};
