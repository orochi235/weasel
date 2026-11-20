/**
 * A job's `claude -p --output-format stream-json --verbose` on stdin, turned into onto progress on stdout,
 * and the stream's `result` event, verbatim, written to the result file, where `--output-format json`
 * would have put it. Runs on the node, from `.skulk/in`, so it imports nothing outside node itself.
 *
 *   node progress.mjs <files.txt> <result.json>      a reviewer: each listed file it first reads
 *   node progress.mjs --commits <n> <result.json>    a fixer: each commit it makes, of its n findings
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

/**
 * As {@link createProgress}, for a fixer: a step each time it runs `git commit`, out of `findings`, the
 * distinct findings it was handed. One commit a finding is the fixer brief's rule, so a fixer that commits
 * more than that raises the total rather than running past it.
 */
export const createCommitProgress = (findings) => {
  let total = Math.max(1, findings);
  let made = 0;
  const start = `onto: progress 0/${total}`;
  const feed = (line) => {
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      return {};
    }
    if (event?.type === 'result') return { result: line };
    const commits = bashCommands(event).filter((c) => COMMITS.test(c)).length;
    if (commits === 0) return {};
    made += commits;
    total = Math.max(total, made);
    return { progress: `onto: progress ${made}/${total}` };
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
