import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { areaDefects, commitSubjects, openItems } from './defects.mjs';

const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });
const tmp = () => { const d = mkdtempSync(join(tmpdir(), 'skulk-defects-')); dirs.push(d); return d; };
const put = (file: string, text: string) => { mkdirSync(join(file, '..'), { recursive: true }); writeFileSync(file, text); };

describe('areaDefects', () => {
  it("reads a recorded round's report, and a round with no record from its night, open until its fixer reports", () => {
    const root = tmp(), state = tmp();
    put(join(root, 'docs/audits/round-46/x/fix.md'), 'A thing breaks (A): fixed 1a2b3c4d. It no longer does.');
    put(join(state, 'nights/2026-11-20T00-00-00-000Z-round47/areas/x/match.json'), JSON.stringify({ pairs: [[1, 0]], a: ['one', 'two'], b: ['two too', 'three'] }));
    expect(areaDefects(root, 'x', state)).toEqual([
      { round: 47, recorded: false, fixed: false, items: [
        { claim: 'two', from: 'A+B', verdict: 'open', note: '' }, { claim: 'one', from: 'A', verdict: 'open', note: '' },
        { claim: 'three', from: 'B', verdict: 'open', note: '' },
      ] },
      { round: 46, recorded: true, fixed: true, items: [{ claim: 'A thing breaks', from: 'A', verdict: 'fixed', note: 'It no longer does.' }] },
    ]);
    expect(openItems({})).toEqual([]);
    expect(commitSubjects('From 1a2b Mon Sep 17 00:00:00 2001\nSubject: [PATCH 1/2] keep a lone min\n bound\n\nbody\nFrom 3c4d Mon\nSubject: [PATCH 2/2] draw a choice\n')).toEqual(['keep a lone min bound', 'draw a choice']);
  });
});
