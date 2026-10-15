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
