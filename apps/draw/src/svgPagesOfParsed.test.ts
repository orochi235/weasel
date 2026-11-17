import { describe, expect, it } from 'vitest';
import type { ParseResult } from '@weasel-js/svg';
import { pagesOfParsed } from './svgPages';

const parsedWith = (attrs: Record<string, string>): ParseResult =>
  ({ documentMeta: { wd: { elements: { page: [{ attrs }] } } } }) as unknown as ParseResult;

describe('pagesOfParsed', () => {
  it('reads a page of a finite, positive size', () => {
    expect(pagesOfParsed(parsedWith({ id: 'p', width: '100', height: '50' }))).toEqual([{ id: 'p', width: 100, height: 50 }]);
  });

  it.each([['Infinity', '50'], ['50', 'Infinity']])('reads no pages from a page %s by %s', (width, height) => {
    expect(pagesOfParsed(parsedWith({ id: 'p', width, height }))).toBeUndefined();
  });
});
