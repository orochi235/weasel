import { describe, it, expect } from 'vitest';
import { extractExportInfo } from './sourceLookup';

describe('extractExportInfo', () => {
  it('returns null when the symbol is not exported in the source', () => {
    const src = `function foo() { return 1; }\n`;
    expect(extractExportInfo(src, 'foo')).toBeNull();
  });

  it('finds an export function declaration', () => {
    const src = `export function bar() { return 1; }\n`;
    const info = extractExportInfo(src, 'bar');
    expect(info).not.toBeNull();
    expect(info!.jsdoc).toBeNull();
  });

  it('captures a JSDoc block immediately preceding the export', () => {
    const src = [
      '/** Adds one to its argument. */',
      'export function addOne(x: number) { return x + 1; }',
      '',
    ].join('\n');
    const info = extractExportInfo(src, 'addOne');
    expect(info).not.toBeNull();
    expect(info!.jsdoc).toContain('Adds one');
  });

  it('captures a multi-line JSDoc block', () => {
    const src = [
      '/**',
      ' * Multi-line.',
      ' * Description.',
      ' */',
      'export const Thing = 1;',
    ].join('\n');
    const info = extractExportInfo(src, 'Thing');
    expect(info!.jsdoc).toContain('Multi-line.');
    expect(info!.jsdoc).toContain('Description.');
  });
});
