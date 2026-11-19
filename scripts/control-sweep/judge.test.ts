import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { compareCaptures, deadTable, demosIn, pruneRuns, readAllow, staleWaivers, verdictOf, waiverFor } from './judge.mjs';

const cap = (dom: Record<string, string>, canvases: string[] = []) => ({ dom, canvases });

describe('demosIn', () => {
  it('reads each entry’s id and path in order', () => {
    const src = `const DEMO_META = [\n  {\n    id: 'scene',\n    title: 'S',\n    path: 'apps/site/demos/SceneDemo.tsx',\n  },\n  {\n    id: 'lab-tween',\n    load: () => x,\n    path: 'apps/site/demos/TweenLabDemo.tsx',\n  },\n];`;
    expect(demosIn(src)).toEqual([
      { id: 'scene', path: 'apps/site/demos/SceneDemo.tsx' },
      { id: 'lab-tween', path: 'apps/site/demos/TweenLabDemo.tsx' },
    ]);
  });
});

describe('judging', () => {
  it('calls a control dead when nothing steady changed', () => {
    const b = cap({ 0: 'a', '0.0': 'b' }, ['c1']);
    expect(verdictOf(compareCaptures(b, b, cap({ 0: 'a', '0.0': 'b' }, ['c1']))).verdict).toBe('dead');
  });

  it('calls it alive on a canvas or DOM change, an added element included', () => {
    const b = cap({ 0: 'a' }, ['c1']);
    expect(verdictOf(compareCaptures(b, b, cap({ 0: 'a' }, ['c2']))).verdict).toBe('alive');
    expect(verdictOf(compareCaptures(b, b, cap({ 0: 'a', '0.0': 'x' }, ['c1']))).verdict).toBe('alive');
  });

  it('leaves out what moved by itself between the two before captures', () => {
    const b0 = cap({ 0: 'a', '0.1': 'clock 1' }, ['c1', 'anim1']);
    const b1 = cap({ 0: 'a', '0.1': 'clock 2' }, ['c1', 'anim2']);
    const cmp = compareCaptures(b0, b1, cap({ 0: 'a', '0.1': 'clock 3' }, ['c1', 'anim3']));
    expect(cmp).toMatchObject({ domChanged: 0, canvasChanged: [], animated: [1] });
    expect(verdictOf(cmp).verdict).toBe('unsure');
  });
});

describe('allowlist', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sweep-allow-'));
  afterEach(() => rmSync(join(dir, 'a.json'), { force: true }));

  it('waives by demo and label, and names entries that waived nothing among swept demos', () => {
    writeFileSync(join(dir, 'a.json'), JSON.stringify([
      { demo: 'share', control: 'Copy link', reason: 'writes the clipboard' },
      { demo: 'share', control: 'Gone', reason: 'old' },
      { demo: 'other', control: 'X', reason: 'not swept' },
    ]));
    const allow = readAllow(join(dir, 'a.json'));
    expect(waiverFor(allow, 'share', 'Copy link')?.reason).toBe('writes the clipboard');
    expect(waiverFor(allow, 'share', 'copy link')).toBeUndefined();
    expect(staleWaivers(allow, new Set(['share']), new Set(['share\u0000Copy link'])).map((e) => e.control)).toEqual(['Gone']);
  });

  it('rejects an entry without a reason', () => {
    writeFileSync(join(dir, 'a.json'), JSON.stringify([{ demo: 'a', control: 'b' }]));
    expect(() => readAllow(join(dir, 'a.json'))).toThrow(/reason/);
  });
});

describe('pruneRuns', () => {
  it('keeps the newest runs by start time and touches nothing else', () => {
    const parent = mkdtempSync(join(tmpdir(), 'sweep-runs-'));
    const names = ['2026-11-18T01-00-00-000Z', '2026-11-18T02-00-00-000Z', 'night-round40', '2026-11-18T03-00-00-000Z'];
    names.forEach((n, i) => {
      mkdirSync(join(parent, n));
      writeFileSync(join(parent, n, 'started'), String(1000 + i));
    });
    mkdirSync(join(parent, '.site'));
    expect(pruneRuns(parent, 2)).toEqual(['2026-11-18T01-00-00-000Z', '2026-11-18T02-00-00-000Z']);
    expect(readdirSync(parent).sort()).toEqual(['.site', '2026-11-18T03-00-00-000Z', 'night-round40']);
    rmSync(parent, { recursive: true, force: true });
  });
});

it('deadTable pads its columns', () => {
  expect(deadTable([{ demo: 'lab-tween', label: 'Distance', kind: 'slider' }])).toBe('demo       control   kind    under\nlab-tween  Distance  slider');
});
