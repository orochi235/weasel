import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createCommitProgress, createProgress } from './progress.mjs';
import { parseEnvelope } from './usage.mjs';

const SCRIPT = join(import.meta.dirname, 'progress.mjs');
const ROOT = '/nodes/trees/weasel-skulk-r1';
const FILES = ['packages/core/src/a.ts', 'packages/core/src/b.ts', 'package.json'];
const read = (id: string, path: string) => JSON.stringify({
  type: 'assistant',
  message: { role: 'assistant', content: [{ type: 'tool_use', id, name: 'Read', input: { file_path: path } }] },
});
const RESULT = JSON.stringify({
  type: 'result', subtype: 'success', is_error: false, duration_ms: 301234, num_turns: 9, result: 'done',
  total_cost_usd: 0.51, terminal_reason: 'completed',
  usage: { input_tokens: 24, output_tokens: 4399, cache_creation_input_tokens: 40594, cache_read_input_tokens: 490175 },
  modelUsage: { 'claude-opus-5-5': { costUSD: 0.51 } },
});
/** A recorded stream: init, reads (one repeated, one unlisted, one relative), a grep, and the result. */
const STREAM = [
  JSON.stringify({ type: 'system', subtype: 'init', cwd: ROOT, tools: ['Read', 'Grep'] }),
  read('t1', `${ROOT}/packages/core/src/a.ts`),
  JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: '…' }] } }),
  read('t2', `${ROOT}/packages/core/src/a.ts`),
  read('t3', `${ROOT}/packages/core/package.json`),
  JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 't4', name: 'Grep', input: { pattern: 'x', path: `${ROOT}/package.json` } }] } }),
  read('t5', 'packages/core/src/b.ts'),
  'not json',
  read('t6', `${ROOT}/package.json`),
  RESULT,
];

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('createProgress', () => {
  it('counts each listed file the first time Read asks for it, and hands the result line back verbatim', () => {
    const { start, feed } = createProgress(FILES, ROOT);
    const out = STREAM.map((line) => feed(line));
    expect(start).toBe('onto: progress 0/3');
    expect(out.flatMap((o) => (o.progress ? [o.progress] : []))).toEqual(['onto: progress 1/3', 'onto: progress 2/3', 'onto: progress 3/3']);
    expect(out.flatMap((o) => (o.result !== undefined ? [o.result] : []))).toEqual([RESULT]);
  });
});

describe('progress.mjs', () => {
  it('prints progress and writes the envelope parseEnvelope reads, the same as --output-format json', () => {
    // The filter resolves against process.cwd(), which is the real path; macOS's tmpdir() is behind /var -> /private/var.
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'skulk-progress-')));
    dirs.push(dir);
    writeFileSync(join(dir, 'files.txt'), `${FILES.join('\n')}\n`);
    const stream = STREAM.map((l) => l.replaceAll(ROOT, dir)).join('\n');
    const run = spawnSync(process.execPath, [SCRIPT, 'files.txt', 'claude.json'], { cwd: dir, input: stream, encoding: 'utf8' });
    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
    expect(run.stdout.split('\n').filter(Boolean)).toEqual(['onto: progress 0/3', 'onto: progress 1/3', 'onto: progress 2/3', 'onto: progress 3/3']);
    const raw = readFileSync(join(dir, 'claude.json'), 'utf8');
    expect(raw).toBe(`${RESULT}\n`);
    expect(parseEnvelope(raw).record).toMatchObject({ terminalReason: 'completed', budgetHit: false, costUsd: 0.51, weightedTokens: 121779 });
  });

  it('leaves an empty result file when the stream ends without a result, as a killed json run does', () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'skulk-progress-')));
    dirs.push(dir);
    writeFileSync(join(dir, 'files.txt'), 'a.ts\n');
    const run = spawnSync(process.execPath, [SCRIPT, 'files.txt', 'claude.json'], { cwd: dir, input: '', encoding: 'utf8' });
    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
    expect(readFileSync(join(dir, 'claude.json'), 'utf8')).toBe('');
    expect(parseEnvelope('').record.terminalReason).toBe('no envelope');
  });
});

describe('createCommitProgress', () => {
  const bash = (command: string) => JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Bash', input: { command } }] } });
  it('keeps the fixer\'s last report in its result when its final reply is about something else', () => {
    const say = (text: string) => JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text }] } });
    const result = (text: string) => JSON.stringify({ type: 'result', subtype: 'success', result: text });
    const { feed } = createCommitProgress(1);
    feed(say('fixed 1a2b3c4d | a thing (A)\ntally: 1 of 1 fixed, 0 extra fixed'));
    feed(say('A background watcher hit its time limit; nothing was lost.'));
    const kept = feed(result('A background watcher hit its time limit; nothing was lost.')).result!;
    expect(parseEnvelope(kept).reply).toBe('fixed 1a2b3c4d | a thing (A)\ntally: 1 of 1 fixed, 0 extra fixed');
    const plain = createCommitProgress(1);
    plain.feed(say('fixed 1a2b3c4d | a thing (A)'));
    expect(JSON.parse(plain.feed(result('fixed 1a2b3c4d | a thing (A)')).result!)).not.toHaveProperty('report');
  });

  it('steps once per git commit the fixer runs, out of its findings, and raises the total past them', () => {
    const { start, feed } = createCommitProgress(2);
    expect(start).toBe('onto: progress 0/2');
    expect(feed(bash('npx vitest run a.test.ts')).progress).toBeUndefined();
    expect(feed(bash('git add -A && git commit -m one')).progress).toBe('onto: progress 1/2');
    expect(feed(bash('git -c user.name=a commit -q -m two')).progress).toBe('onto: progress 2/2');
    expect(feed(bash('git commit -m three')).progress).toBe('onto: progress 3/3');
    expect(feed('{"type":"result","result":"ok"}').result).toBe('{"type":"result","result":"ok"}');
  });
});
