/**
 * The steps `.github/workflows/ci.yml` runs, read from the file so nothing restates them. Two fleet
 * jobs split them at the first `npm run build`: the gate project runs the checks above it on source
 * (`scripts/ci-checks.gate.ts`), and `test:fleet:postbuild` runs the build and everything after it
 * (`scripts/ci-postbuild.mjs`).
 *
 * This reads the subset of YAML ci.yml is written in — one job, flat `env:` maps, and `run:` as a
 * plain scalar or a `|` block — not YAML in general.
 */
export const CI_YML = new URL('../../.github/workflows/ci.yml', import.meta.url);

const CHECK = /^npm run ((?:check:[\w-]+|audit:[\w-]+|typecheck|lint)\b.*?)\s*$/;
const BUILD = /^npm run build\b/;
const NODE_ONLY = /^matrix\.node\s*==\s*(\d+)$/;

const indentOf = (line) => line.length - line.trimStart().length;
const ignorable = (line) => !line.trim() || line.trim().startsWith('#');
const unquote = (value) => value.replace(/^(['"])(.*)\1$/, '$2');

/** The `key: value` lines indented deeper than `from`, starting at `start`; returns the map and where it ended. */
const readMap = (lines, start, from) => {
  const map = {};
  let i = start;
  for (; i < lines.length; i++) {
    if (ignorable(lines[i])) continue;
    if (indentOf(lines[i]) <= from) break;
    const [, key, value] = /^\s*([\w-]+):\s*(.*)$/.exec(lines[i]) ?? [];
    if (key) map[key] = unquote(value.trim());
  }
  return { map, end: i };
};

/** A `|` block's lines indented deeper than `from`, dedented and joined. */
const readBlock = (lines, start, from) => {
  const body = [];
  let i = start;
  for (; i < lines.length && (!lines[i].trim() || indentOf(lines[i]) > from); i++) body.push(lines[i]);
  const cut = Math.min(...body.filter((line) => line.trim()).map(indentOf));
  return { text: body.map((line) => line.slice(cut)).join('\n').trim(), end: i };
};

/** One `- ` list item of `steps:`, whose keys sit at `keyIndent`. */
const readStep = (lines, start, keyIndent) => {
  const step = { env: {} };
  let i = start;
  while (i < lines.length) {
    const line = i === start ? lines[i].replace('-', ' ') : lines[i];
    if (ignorable(line)) { i++; continue; }
    if (indentOf(line) !== keyIndent || (i !== start && line.trimStart().startsWith('-'))) break;
    const [, key, raw] = /^\s*([\w-]+):\s*(.*)$/.exec(line) ?? [];
    const value = raw?.trim() ?? '';
    if (key === 'env' && !value) ({ map: step.env, end: i } = readMap(lines, i + 1, keyIndent));
    else if (value === '|') ({ text: step[key], end: i } = readBlock(lines, i + 1, keyIndent));
    else if (value) { step[key] = unquote(value); i++; }
    else ({ end: i } = readMap(lines, i + 1, keyIndent));
  }
  return { step, end: i };
};

/** ci.yml's job-level `env` and every step that has a `run`, in order. */
export const readCi = (text) => {
  const lines = text.split('\n');
  const at = lines.findIndex((line) => /^\s*steps:\s*$/.test(line));
  if (at < 0) throw new Error('ci.yml: no steps: list');
  const jobIndent = indentOf(lines[at]);
  const envAt = lines.findIndex((line, i) => i < at && indentOf(line) === jobIndent && /^\s*env:\s*$/.test(line));
  const env = envAt < 0 ? {} : readMap(lines, envAt + 1, jobIndent).map;

  const steps = [];
  let i = at + 1;
  while (i < lines.length && (ignorable(lines[i]) || indentOf(lines[i]) > jobIndent)) {
    if (!/^\s*-\s/.test(lines[i])) { i++; continue; }
    const { step, end } = readStep(lines, i, indentOf(lines[i]) + 2);
    if (step.run) steps.push({ run: step.run, env: step.env, ...(step.if ? { if: step.if } : {}) });
    i = end;
  }
  return { env, steps };
};

const firstBuild = (steps) => {
  const at = steps.findIndex((step) => BUILD.test(step.run));
  return at < 0 ? steps.length : at;
};

/** The typecheck, lint, `check:*` and `audit:*` steps above the first build, each as the arguments after `npm run`. */
export const sourceChecks = (steps) =>
  steps.slice(0, firstBuild(steps)).flatMap((step) => {
    const command = CHECK.exec(step.run)?.[1];
    return command ? [command.split(/\s+/)] : [];
  });

/**
 * The first build and every step after it that runs on `nodeMajor`. A condition other than a Node
 * version is refused: guessing would either skip a step CI runs or run one it skips.
 */
export const builtSteps = (steps, nodeMajor) =>
  steps.slice(firstBuild(steps)).filter((step) => {
    if (!step.if) return true;
    const only = NODE_ONLY.exec(step.if.trim());
    if (!only) throw new Error(`ci.yml: cannot evaluate the step condition "${step.if}" off CI`);
    return Number(only[1]) === nodeMajor;
  });
