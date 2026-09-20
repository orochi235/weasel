import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATEGORIES, DEMOS, DEMOS_BY_ID } from '../registry';

/** Repo root, from `apps/site/__tests__/`. */
const ROOT = resolve(__dirname, '../../..');

// Every assertion here runs against the real registry rather than a fixture.
// The registry is hand-maintained and a bad entry is not a type error: an id
// that collides silently shadows a demo, and a `path` that no longer exists
// renders an empty source pane on the live site.
describe('the demo registry', () => {
  it('has demos', () => {
    expect(DEMOS.length).toBeGreaterThan(0);
  });

  it('gives every demo a unique id', () => {
    const seen = new Map<string, number>();
    for (const d of DEMOS) seen.set(d.id, (seen.get(d.id) ?? 0) + 1);
    expect([...seen].filter(([, n]) => n > 1).map(([id]) => id)).toEqual([]);
  });

  it('indexes every demo by id', () => {
    expect(DEMOS_BY_ID.size).toBe(DEMOS.length);
  });

  it('keeps every id usable as a URL fragment', () => {
    // `readHash` in WeaselDemos matches the raw fragment against these, so an
    // id needing escaping would never resolve from a pasted link.
    expect(DEMOS.filter((d) => d.id !== encodeURIComponent(d.id)).map((d) => d.id)).toEqual([]);
  });

  it('gives every demo a title, category and description', () => {
    const blank = DEMOS.filter((d) => !d.title?.trim() || !d.category?.trim() || !d.description?.trim());
    expect(blank.map((d) => d.id)).toEqual([]);
  });

  it('points every demo at a source file that exists', () => {
    const missing = DEMOS.filter((d) => !existsSync(resolve(ROOT, d.path)));
    expect(missing.map((d) => `${d.id} -> ${d.path}`)).toEqual([]);
  });

  it('gives every source tab a path that exists', () => {
    const missing = DEMOS.flatMap((d) =>
      d.sources.filter((s) => !existsSync(resolve(ROOT, s.path))).map((s) => `${d.id} -> ${s.path}`),
    );
    expect(missing).toEqual([]);
  });

  it('leads each demosources list with the demo file itself', () => {
    const wrong = DEMOS.filter((d) => d.sources.length > 0 && d.sources[0].path !== d.path);
    expect(wrong.map((d) => d.id)).toEqual([]);
  });

  it('derives categories in first-appearance order, with no duplicates', () => {
    expect(new Set(CATEGORIES).size).toBe(CATEGORIES.length);
    expect(CATEGORIES).toEqual([...new Set(DEMOS.map((d) => d.category))]);
  });

  it('partitions every demo into exactly one rendered category', () => {
    // The nav loops over `CATEGORIES` and filters `DEMOS` by each, so a demo
    // reached by no category would silently never render. File order does not
    // matter — `Tools` is split around `Text` in the registry today and both
    // halves land under one heading.
    const placed = CATEGORIES.flatMap((c) => DEMOS.filter((d) => d.category === c));
    expect(placed).toHaveLength(DEMOS.length);
  });

  it('gives every outbound link a label and an absolute href', () => {
    const bad = DEMOS.flatMap((d) =>
      (d.links ?? [])
        .filter((l) => !l.label?.trim() || !/^https?:\/\//.test(l.href))
        .map((l) => `${d.id} -> ${l.href}`),
    );
    expect(bad).toEqual([]);
  });

  it('dates every demo it has git history for, in ISO-8601', () => {
    const bad = DEMOS.filter(
      (d) =>
        (d.created !== undefined && Number.isNaN(Date.parse(d.created))) ||
        (d.lastModified !== undefined && Number.isNaN(Date.parse(d.lastModified))),
    );
    expect(bad.map((d) => d.id)).toEqual([]);
  });

  it('never dates a demo as modified before it was created', () => {
    const bad = DEMOS.filter(
      (d) => d.created && d.lastModified && Date.parse(d.lastModified) < Date.parse(d.created),
    );
    expect(bad.map((d) => d.id)).toEqual([]);
  });
});
