/**
 * A reviewer's `claude -p --output-format stream-json --verbose` on stdin, turned into onto progress:
 * `onto: progress <k>/<n>` on stdout each time the reviewer first reads one of its area's listed files,
 * and the stream's `result` event, verbatim, written to the result file, where `--output-format json`
 * would have put it. Runs on the node, from `.skulk/in`, so it imports nothing outside node itself.
 *
 *   node progress.mjs <files.txt> <result.json>
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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [filesPath, resultPath] = process.argv.slice(2);
  const files = readFileSync(filesPath, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
  const { start, feed } = createProgress(files);
  // An empty file, like the redirect of a `--output-format json` run killed before it printed, until a result arrives.
  writeFileSync(resultPath, '');
  process.stdout.write(`${start}\n`);
  for await (const line of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
    const { progress, result } = feed(line);
    if (progress) process.stdout.write(`${progress}\n`);
    if (result !== undefined) writeFileSync(resultPath, `${result}\n`);
  }
}
