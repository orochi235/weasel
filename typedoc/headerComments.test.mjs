import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { headerOnExportList } from './headerComments.mjs';

const check = (text) => headerOnExportList('index.ts', text);

describe('headerOnExportList', () => {
  it('finds a file comment sitting on an export list', () => {
    expect(check('/** The booleans entry. */\nexport { a, b } from "./ops";\n')).toBe(true);
  });

  it('looks past line comments between the two', () => {
    expect(check('/** Part of the barrel. */\n\n// ─── a section ───\nexport { a } from "./a";\n')).toBe(true);
  });

  it('passes a file comment marked as the file\'s', () => {
    expect(check('/**\n * The booleans entry.\n *\n * @packageDocumentation\n */\nexport { a } from "./ops";\n')).toBe(false);
  });

  it('passes a comment written for the export under a file comment', () => {
    expect(check('/** The kit\'s point. */\n\n/** A 2D point. */\nexport type { Point2 as Vec2 } from "./p";\n')).toBe(false);
  });

  it('passes a file whose first statement is not an export list', () => {
    expect(check('/** Helpers. */\nexport * from "./a";\n')).toBe(false);
    expect(check('/** Helpers. */\nimport { a } from "./a";\nexport { a };\n')).toBe(false);
    expect(check('/** Clamp a value. */\nexport function clamp() {}\n')).toBe(false);
  });
});

describe('package sources', () => {
  it('open no file with a doc comment on an export list', () => {
    const packages = join(import.meta.dirname, '../packages');
    const found = [];
    for (const name of readdirSync(packages)) {
      const src = join(packages, name, 'src');
      let files;
      try {
        files = readdirSync(src, { recursive: true });
      } catch {
        continue;
      }
      for (const file of files) {
        if (!/\.tsx?$/.test(file) || /\.d\.ts$|\.test\.tsx?$|(^|\/)node_modules\//.test(file)) continue;
        if (headerOnExportList(file, readFileSync(join(src, file), 'utf8'))) found.push(`packages/${name}/src/${file}`);
      }
    }
    expect(found).toEqual([]);
  });
});
