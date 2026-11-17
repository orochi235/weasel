// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';

const SCRIPT = join(import.meta.dirname, 'link-workspaces.mjs');

let host: string;
let wt: string;
beforeEach(() => {
  host = realpathSync(mkdtempSync(join(tmpdir(), 'link-workspaces-')));
  wt = join(host, '.worktrees', 'wt');
  const lock = JSON.stringify({ packages: { 'packages/a/node_modules/opentype.js': { version: '2.0.0' } } });
  for (const root of [host, wt]) {
    mkdirSync(join(root, 'packages', 'a'), { recursive: true });
    writeFileSync(join(root, 'package.json'), JSON.stringify({ workspaces: ['packages/*'] }));
    writeFileSync(join(root, 'package-lock.json'), lock);
    writeFileSync(join(root, 'packages', 'a', 'package.json'), JSON.stringify({ name: 'a' }));
  }
  mkdirSync(join(host, 'node_modules', '@weasel-js', 'core'), { recursive: true });
  for (const pkg of ['opentype.js', '@babel/parser', '.bin']) {
    mkdirSync(join(host, 'packages', 'a', 'node_modules', pkg), { recursive: true });
  }
});
afterEach(() => rmSync(host, { recursive: true, force: true }));

const link = () => execFileSync(process.execPath, [SCRIPT, wt], { stdio: 'pipe' });
const isLink = (p: string) => lstatSync(p).isSymbolicLink();

it("links a package's own installs one by one, inside a directory of the worktree's own", () => {
  link();
  const nested = join(wt, 'packages', 'a', 'node_modules');
  expect(isLink(nested)).toBe(false);
  expect(isLink(join(nested, 'opentype.js'))).toBe(true);
  expect(isLink(join(nested, '@babel'))).toBe(false);
  expect(isLink(join(nested, '@babel', 'parser'))).toBe(true);
  expect(existsSync(join(nested, '.bin'))).toBe(false);
});

it("keeps the host's install whole when npm in the worktree moves a package aside", () => {
  link();
  // What npm does to a package it replaces, before it writes the new one.
  const nested = join(wt, 'packages', 'a', 'node_modules');
  renameSync(join(nested, 'opentype.js'), join(nested, '.opentype.js-aside'));
  expect(existsSync(join(host, 'packages', 'a', 'node_modules', 'opentype.js'))).toBe(true);
});

it('relinks a package node_modules an earlier run linked whole', () => {
  symlinkSync(join(host, 'packages', 'a', 'node_modules'), join(wt, 'packages', 'a', 'node_modules'), 'dir');
  link();
  const nested = join(wt, 'packages', 'a', 'node_modules');
  expect(isLink(nested)).toBe(false);
  expect(isLink(join(nested, 'opentype.js'))).toBe(true);
});
