#!/usr/bin/env node
/**
 * Post the comparison of two directories of perf results on a pull request,
 * rewriting the comment a previous run left instead of adding another.
 *
 *   node tests/perf/pr-comment.mjs <base-dir> <head-dir> --pr <number> --base <sha> --head <sha>
 *
 * Reads `GITHUB_TOKEN` and `GITHUB_REPOSITORY`. With `--dry-run` it prints the
 * body and calls nothing.
 */
import { existsSync } from 'node:fs';
import { compareResults } from './lib/compare.ts';
import { loadResultDir } from './lib/loadResults.ts';
import { pairByBenchmark } from './lib/pairResults.ts';
import { COMMENT_MARKER, commentBody } from './lib/prComment.ts';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const [baseDir, headDir] = args;
const pr = flag('--pr');
const base = flag('--base');
const head = flag('--head');
if (!baseDir || !headDir || [baseDir, headDir].some((d) => d.startsWith('--')) || !pr || !base || !head) {
  console.error('usage: node tests/perf/pr-comment.mjs <base-dir> <head-dir> --pr <number> --base <sha> --head <sha> [--dry-run]');
  process.exit(2);
}

// A side whose every benchmark failed may have written no directory at all.
const read = (dir) => (existsSync(dir) ? loadResultDir(dir) : []);
const { pairs, onlyA, onlyB } = pairByBenchmark(read(baseDir), read(headDir));
const compared = pairs.map((p) => ({ benchmark: p.benchmark, cmp: compareResults(p.a.result, p.b.result) }));
const body = commentBody({ compared, onlyBase: onlyA, onlyHead: onlyB }, { base, head });
if (args.includes('--dry-run')) {
  console.log(body);
  process.exit(0);
}

const { GITHUB_TOKEN: token, GITHUB_REPOSITORY: repo } = process.env;
if (!token || !repo) {
  console.error('GITHUB_TOKEN and GITHUB_REPOSITORY must be set');
  process.exit(2);
}

const api = async (path, init = {}) => {
  const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    ...init,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'x-github-api-version': '2022-11-28',
      ...(init.body ? { 'content-type': 'application/json' } : {}),
    },
  });
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path}: ${res.status} ${await res.text()}`);
  return res.json();
};

let mine;
for (let page = 1; !mine; page++) {
  const comments = await api(`/issues/${pr}/comments?per_page=100&page=${page}`);
  mine = comments.find((c) => c.body?.startsWith(COMMENT_MARKER));
  if (comments.length < 100) break;
}

const sent = mine
  ? await api(`/issues/comments/${mine.id}`, { method: 'PATCH', body: JSON.stringify({ body }) })
  : await api(`/issues/${pr}/comments`, { method: 'POST', body: JSON.stringify({ body }) });
console.log(`${mine ? 'updated' : 'posted'} ${sent.html_url}`);
