#!/usr/bin/env node
/**
 * Splits the repo's source into audit areas of at most MAX_AREA_FILES files, by directory. An area's id
 * is its directory's path, so regenerating keeps the id of every directory whose shape did not change.
 *
 *   node scripts/skulk/partition.mjs [--ref <commit>]   # writes docs/audits/partition.json
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAX_AREA_FILES, MIN_AREA_FILES } from './config.mjs';

export const PARTITION_PATH = 'docs/audits/partition.json';

const SOURCE = /\.(ts|tsx|mts|mjs|js|jsx|css|less)$/;
const NOT_SOURCE = [/\.test\.[^/]+$/, /\.pbt\.fixture\.ts$/, /\.d\.ts$/, /(^|\/)(fixtures|vendor|__tests__)\//];
const ROOT = /^(packages\/[^/]+\/src|apps\/[^/]+)\//;

export const isAuditSource = (path) => ROOT.test(path) && SOURCE.test(path) && !NOT_SOURCE.some((re) => re.test(path));

/** `packages/core/src/canvas` → `core.canvas`; `apps/draw/src` → `apps.draw.src`. */
export const areaId = (dir) =>
  dir.replace(/^packages\/([^/]+)\/src/, '$1').replace(/\//g, '.');

const tree = () => ({ files: [], dirs: new Map(), count: 0 });

const build = (paths) => {
  const roots = new Map();
  for (const path of paths) {
    const root = path.match(ROOT)[1];
    if (!roots.has(root)) roots.set(root, tree());
    let node = roots.get(root);
    node.count++;
    const parts = path.slice(root.length + 1).split('/');
    for (const part of parts.slice(0, -1)) {
      if (!node.dirs.has(part)) node.dirs.set(part, tree());
      node = node.dirs.get(part);
      node.count++;
    }
    node.files.push(path);
  }
  return roots;
};

const allFiles = (node) => [...node.files, ...[...node.dirs.values()].flatMap(allFiles)];

const chunk = (id, files) => {
  if (files.length <= MAX_AREA_FILES) return [{ id, files }];
  const parts = Math.ceil(files.length / MAX_AREA_FILES);
  const size = Math.ceil(files.length / parts);
  return Array.from({ length: parts }, (_, i) => ({ id: `${id}.part${i + 1}`, files: files.slice(i * size, (i + 1) * size) }));
};

const split = (dir, node) => {
  if (node.count <= MAX_AREA_FILES) return [{ id: areaId(dir), files: allFiles(node).sort() }];
  const own = [...node.files];
  const areas = [];
  for (const [name, child] of [...node.dirs].sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (child.count < MIN_AREA_FILES) own.push(...allFiles(child));
    else areas.push(...split(`${dir}/${name}`, child));
  }
  return own.length > 0 ? [...chunk(areaId(dir), own.sort()), ...areas] : areas;
};

/** The areas `paths` (repo-relative, any order) fall into, sorted by id. */
export const partition = (paths) => {
  const roots = build([...new Set(paths)].filter(isAuditSource).sort());
  return [...roots].flatMap(([dir, node]) => split(dir, node)).sort((a, b) => (a.id < b.id ? -1 : 1));
};

export const partitionAt = (root, ref = 'HEAD') => {
  const out = execFileSync('git', ['ls-tree', '-r', '--name-only', '-z', ref, '--', 'packages', 'apps'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 });
  return partition(out.split('\0').filter(Boolean));
};

export const writePartition = (root, areas) => {
  const at = join(root, PARTITION_PATH);
  mkdirSync(dirname(at), { recursive: true });
  writeFileSync(at, `${JSON.stringify(areas, null, 1)}\n`);
  return at;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../..', import.meta.url));
  const refAt = process.argv.indexOf('--ref');
  const areas = partitionAt(root, refAt < 0 ? 'HEAD' : process.argv[refAt + 1]);
  const at = writePartition(root, areas);
  const sizes = areas.map((a) => a.files.length);
  console.log(`partition: ${areas.length} areas, ${sizes.reduce((s, n) => s + n, 0)} files, ${Math.min(...sizes)}–${Math.max(...sizes)} per area → ${at}`);
}
