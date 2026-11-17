import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ICON_GROUPS } from '../src/icons.gen.ts';

const SRC = resolve(import.meta.dirname, '../src');

function sourceText(): string {
  return readdirSync(SRC, { recursive: true, encoding: 'utf8' })
    .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) && !/^icons\.(gen|table)\./.test(f))
    .map((f) => readFileSync(resolve(SRC, f), 'utf8'))
    .join('\n');
}

describe('draw glyphs', () => {
  it('are each named by draw\'s source', () => {
    const text = sourceText();
    const unnamed = ICON_GROUPS.flatMap((g) => g.names).filter(
      (name) => !text.includes(`icon('${name}')`) && !text.includes(`'draw:${name}'`),
    );
    expect(unnamed).toEqual([]);
  });
});
