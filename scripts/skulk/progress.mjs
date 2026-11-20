/**
 * A job's `claude -p --output-format stream-json --verbose` on stdin, turned into onto progress on stdout,
 * and the stream's `result` event, verbatim, written to the result file, where `--output-format json`
 * would have put it. Runs on the node, from `.skulk/in`, so it imports nothing outside node itself.
 *
 *   node progress.mjs <files.txt> <result.json>      a reviewer: each listed file it first reads
 *   node progress.mjs --commits <n> <result.json>    a fixer: each commit it makes, of its n findings, then each
 *                                                    check it runs (`checks`) and the tests they pass (`tests`)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

/** Paths the event's assistant message asks the Read tool for. */
const readPaths = (event) => {
  if (event?.type !== 'assistant' || !Array.isArray(event.message?.content)) return [];
  return event.message.content
    .filter((c) => c?.type === 'tool_use' && c.name === 'Read' && typeof c.input?.file_path === 'string')
    .map((c) => c.input.file_path);
};

/**
 * Answers `feed(line)`, which takes one line of the stream and answers `{ progress, result }`: the
 * progress line to print, if the line read a listed file for the first time, and the line itself when
 * it is the result event. `root` is the tree the listed paths are relative to.
 */
export const createProgress = (files, root = process.cwd()) => {
  const listed = new Set(files);
  const seen = new Set();
  const start = `onto: progress 0/${listed.size}`;
  const feed = (line) => {
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      return {};
    }
    if (event?.type === 'result') return { result: line };
    let progress;
    for (const path of readPaths(event)) {
      const rel = relative(root, resolve(root, path));
      if (!listed.has(rel) || seen.has(rel)) continue;
      seen.add(rel);
      progress = `onto: progress ${seen.size}/${listed.size}`;
    }
    return { progress };
  };
  return { start, feed };
};

/** The commands the event's assistant message runs with the Bash tool. */
const bashCommands = (event) => {
  if (event?.type !== 'assistant' || !Array.isArray(event.message?.content)) return [];
  return event.message.content
    .filter((c) => c?.type === 'tool_use' && c.name === 'Bash' && typeof c.input?.command === 'string')
    .map((c) => c.input.command);
};

const COMMITS = /\bgit\b(?:\s+-c\s+\S+)*\s+commit\b/;

/** The Bash tool calls the event's assistant message makes: each call's id and command. */
const bashCalls = (event) => {
  if (event?.type !== 'assistant' || !Array.isArray(event.message?.content)) return [];
  return event.message.content
    .filter((c) => c?.type === 'tool_use' && c.name === 'Bash' && typeof c.input?.command === 'string')
    .map((c) => ({ id: c.id, command: c.input.command }));
};

/** The tool results the event carries back: each one's call id and its text. */
const toolResults = (event) => {
  if (event?.type !== 'user' || !Array.isArray(event.message?.content)) return [];
  return event.message.content.filter((c) => c?.type === 'tool_result').map((c) => ({
    id: c.tool_use_id,
    error: c.is_error === true,
    text: typeof c.content === 'string' ? c.content
      : Array.isArray(c.content) ? c.content.map((p) => (typeof p?.text === 'string' ? p.text : '')).join('\n') : '',
  }));
};

/** The paths a `git commit -- <paths>` names. */
const committedPaths = (command) => {
  const at = command.search(/\s--\s/);
  return at === -1 ? [] : command.slice(at + 4).split(/\s+/).filter((p) => p && !p.startsWith('-') && !/[;&|]/.test(p));
};

/** Which of the fixer brief's checks a command runs, as a key: a test file, a package's lint, or the gate. */
const checkOf = (command) => {
  const test = /\bvitest run\b.*?\s([\w./@-]+\.test\.[cm]?[jt]sx?)\b/.exec(command);
  if (test) return `test ${test[1]}`;
  const lint = /\bnpm run(?: -s)? lint -w (?:@weasel-js\/)?([\w.-]+)/.exec(command);
  if (lint) return `lint ${lint[1]}`;
  return /\bnpm run(?: -s)? checks:gate\b/.test(command) ? 'gate' : null;
};

/** What a vitest run's summary says it passed and failed: `Tests  1 failed | 22 passed (23)`. */
const testTally = (text) => {
  const line = /^\s*Tests\s+(.*\(\d+\))\s*$/m.exec(text.replace(/\x1b\[[0-9;]*m/g, ''));
  if (!line) return null;
  const count = (word) => Number(new RegExp(`(\\d+) ${word}`).exec(line[1])?.[1] ?? 0);
  return { passed: count('passed'), failed: count('failed') };
};

/**
 * The fixer brief's checks, tallied as they run, in onto's own progress protocol: a test file for each test file its
 * commits touched, a lint for each package they touched, and the gate. Answers `see(event)`, which answers the lines
 * the event moves: the checks run of those expected and the ones whose latest run failed (`checks`), and the test cases
 * run and failed (`tests`), each test file counted by its latest run, so a fix and a rerun replace a failing one.
 */
export const createCheckTally = () => {
  const expected = new Set(['gate']);
  const latest = new Map();
  const pending = new Map();
  const files = new Map();
  const see = (event) => {
    const lines = [];
    for (const { id, command } of bashCalls(event)) {
      if (COMMITS.test(command)) {
        for (const path of committedPaths(command)) {
          if (/\.test\.[cm]?[jt]sx?$/.test(path) && !/\.browser\.test\./.test(path)) expected.add(`test ${path}`);
          const pkg = /^packages\/([^/]+)\//.exec(path);
          if (pkg) expected.add(`lint ${pkg[1]}`);
        }
      }
      const check = checkOf(command);
      if (check) pending.set(id, check);
    }
    for (const { id, text, error } of toolResults(event)) {
      const check = pending.get(id);
      if (!check) continue;
      pending.delete(id);
      const tally = check.startsWith('test ') ? testTally(text) : null;
      if (tally) {
        files.set(check, tally);
        const run = [...files.values()].reduce((n, t) => n + t.passed + t.failed, 0);
        const failed = [...files.values()].reduce((n, t) => n + t.failed, 0);
        lines.push(`onto: progress ${run}/${run} tests`, `onto: failed ${failed}/${run} tests`);
      }
      latest.set(check, error || (tally ? tally.failed > 0 : false));
      expected.add(check);
      const bad = [...latest.values()].filter(Boolean).length;
      lines.push(`onto: progress ${latest.size}/${expected.size} checks`, `onto: failed ${bad}/${expected.size} checks`);
    }
    return lines;
  };
  return { see };
};

/** A fixer's verdict that it fixed a finding, `fixed <sha>`, which `findings.mjs` counts too. */
export const FIXED_MARK = /\bfixed (?:in )?`?[0-9a-f]{7,}/;
/** Text that reads as a fixer's report: its closing tally line, or a verdict. */
const isReport = (text) => /^tally: /m.test(text) || FIXED_MARK.test(text);

/** The text of the event's assistant message. */
const assistantText = (event) => {
  if (event?.type !== 'assistant' || !Array.isArray(event.message?.content)) return '';
  return event.message.content.filter((c) => c?.type === 'text' && typeof c.text === 'string').map((c) => c.text).join('\n');
};

/**
 * As {@link createProgress}, for a fixer: a step each time it runs `git commit`, out of `findings`, the
 * distinct findings it was handed. One commit a finding is the fixer brief's rule, so a fixer that commits
 * more than that raises the total rather than running past it. Its result keeps the fixer's last report as `report`
 * where its final reply is not one.
 */
export const createCommitProgress = (findings) => {
  let total = Math.max(1, findings);
  let made = 0;
  let report = '';
  const checks = createCheckTally();
  const start = `onto: progress 0/${total}`;
  const feed = (line) => {
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      return {};
    }
    // A fixer that starts a background task can be woken after its report by the task's end, and its last reply is
    // then about that; the report it wrote last goes into the result beside it.
    if (event?.type === 'result') return { result: isReport(String(event.result ?? '')) || !report ? line : JSON.stringify({ ...event, report }) };
    const text = assistantText(event);
    if (isReport(text)) report = text;
    const lines = checks.see(event);
    const commits = bashCommands(event).filter((c) => COMMITS.test(c)).length;
    if (commits > 0) {
      made += commits;
      total = Math.max(total, made);
      lines.unshift(`onto: progress ${made}/${total}`);
    }
    return lines.length ? { progress: lines.join('\n') } : {};
  };
  return { start, feed };
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const commits = argv[0] === '--commits';
  const resultPath = commits ? argv[2] : argv[1];
  const { start, feed } = commits
    ? createCommitProgress(Number(argv[1]))
    : createProgress(readFileSync(argv[0], 'utf8').split('\n').map((s) => s.trim()).filter(Boolean));
  // An empty file, like the redirect of a `--output-format json` run killed before it printed, until a result arrives.
  writeFileSync(resultPath, '');
  process.stdout.write(`${start}\n`);
  for await (const line of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
    const { progress, result } = feed(line);
    if (progress) process.stdout.write(`${progress}\n`);
    if (result !== undefined) writeFileSync(resultPath, `${result}\n`);
  }
}
