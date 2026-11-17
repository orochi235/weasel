// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { buildSourceIndex } from './vite-plugin-source-index.ts';

const repoRoot = resolve(import.meta.dirname, '../..');

describe('buildSourceIndex', () => {
  const index = buildSourceIndex(repoRoot);

  it("finds the kit's exports where they are declared, not only draw's", () => {
    expect(index.useRectTool?.path).toBe('/packages/editing/src/tools/rect/useRectTool.ts');
    expect(index.createInsertOp?.path).toMatch(/^\/packages\/[^/]+\/src\//);
    expect(index.createInsertOp?.path).not.toMatch(/index\.ts$|barrel/);
  });

  it("keys draw's own files by their repo-relative path, so a link resolves from the repo root", () => {
    expect(index.findSourceMatch?.path).toBe('/apps/draw/src/dev/sourceLookup.ts');
  });

  it('leaves tests out', () => {
    expect(Object.values(index).some((m) => /\.test\.tsx?$/.test(m.path))).toBe(false);
  });
});
