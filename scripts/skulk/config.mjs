/** The nightly audit's settings. Every number a night runs by is here; README.md says what each does. */
import { homedir } from 'node:os';
import { join } from 'node:path';

/** Fleet nodes logged into the personal Claude account (`CLAUDE_CONFIG_DIR=~/.claude-msb`). */
export const NODES = ['studio', 'teitou', 'msb-uai'];
/** This Mac (onto node `orochi`) also takes model jobs, but only from LOCAL_FROM to LOCAL_UNTIL: by day it is Mike's working machine. */
export const LOCAL_NODE = 'orochi';
export const LOCAL_FROM = '00:00';
export const LOCAL_UNTIL = '09:00';
/** Fixers run with permissions bypassed, so never on this Mac, even in onto's own tree. */
export const NO_FIXERS = [LOCAL_NODE];
/** A node that refused a dispatch as quiet or unavailable is skipped this long before it is tried again. */
export const REFUSED_COOLDOWN_MIN = 30;

const minutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** Whether local time `date` falls in [from, until), a window that may wrap midnight. */
export const inWindow = (date, from, until) => {
  const now = date.getHours() * 60 + date.getMinutes();
  const [a, b] = [minutes(from), minutes(until)];
  return a <= b ? now >= a && now < b : now >= a || now < b;
};

/** The nodes a job may be offered to at `date`, before onto's own quiet hours and availability. */
export const nodesAt = (date) => (inWindow(date, LOCAL_FROM, LOCAL_UNTIL) ? [...NODES, LOCAL_NODE] : NODES);

/** Model jobs run at once on one node, each in a tree of its own. Fixers wait on the model as reviewers do:
 *  three on 2026-11-19 used under a core and about 1 GB each, so they get as many slots. */
export const REVIEW_SLOTS_PER_NODE = 6;
export const FIX_SLOTS_PER_NODE = 6;

export const AREAS_PER_NIGHT = 16;
export const MAX_AREA_FILES = 50;
/** A subdirectory with fewer files than this is read with its parent's own files when the parent splits. */
export const MIN_AREA_FILES = 10;

/** Unset means the account's default model. */
/**
 * Jobs start without the user's settings (`--setting-sources project,local`), so the model and effort those settings
 * gave them are named here: opus at medium, as the personal config's per-model setting had it (2026-11-20).
 */
export const REVIEW_MODEL = 'opus';
export const FIX_MODEL = 'opus';
export const MATCH_MODEL = 'haiku';
export const REVIEW_EFFORT = 'medium';
export const FIX_EFFORT = 'medium';
export const JOB_TIMEOUT_MIN = 45;
/** A hard stop per `claude -p` job, in list-price dollars (`--max-budget-usd`). */
export const JOB_BUDGET_USD = { review: 8, match: 1, fix: 15 };
/** List-price dollars a night may spend in all, summed from each job's `costUsd`. */
export const NIGHT_USD_CAP = 160;
/** What an area is expected to cost, in list-price dollars, before any area of the night has finished. */
export const AREA_USD_GUESS = 10;

/** Local clock times, `HH:MM`. A night stops dispatching new work at the first STOP_AT after it starts. */
export const START_AT = '23:00';
export const STOP_AT = '07:00';

/** Per-night logs and job envelopes; the newest KEEP_NIGHTS are kept, the rest deleted when a night starts. */
export const STATE_DIR = process.env.SKULK_STATE ?? join(homedir(), '.local', 'state', 'weasel-skulk');
export const KEEP_NIGHTS = 30;

export const CLAUDE_CONFIG = '~/.claude-msb';
/** What a reviewer may call: reading the tree and its history, and writing only its findings. */
export const REVIEW_TOOLS = [
  'Read', 'Grep', 'Glob',
  'Bash(git log:*)', 'Bash(git show:*)', 'Bash(git diff:*)', 'Bash(git blame:*)',
  'Write(./.skulk/out/**)', 'Edit(./.skulk/out/**)',
];
export const REVIEW_DENIED = ['Task', 'Agent'];

/** Inside the frozen tree and every node tree: what a job reads, and what it hands back. */
export const JOB_IN = '.skulk/in';
export const JOB_OUT = '.skulk/out';
