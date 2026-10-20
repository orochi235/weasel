import { afterEach, describe, expect, it } from 'vitest';
import { DOC_KEY, loadDoc } from './docPersistence';

afterEach(() => localStorage.clear());

describe('document persistence', () => {
  it('starts a fresh document as an untitled white Letter page', () => {
    expect(loadDoc()).toEqual({ filename: 'untitled.svg', backgroundColor: '#ffffff', paperSize: 'letter' });
  });

  it('brings the paper size back with the filename and background', () => {
    localStorage.setItem(DOC_KEY, JSON.stringify({ filename: 'poster.svg', backgroundColor: '#ffffcc', paperSize: 'a4' }));
    expect(loadDoc()).toEqual({ filename: 'poster.svg', backgroundColor: '#ffffcc', paperSize: 'a4' });
  });

  it('reads a document saved before the paper size was kept as Letter', () => {
    localStorage.setItem(DOC_KEY, JSON.stringify({ filename: 'old.svg', backgroundColor: '#000000' }));
    expect(loadDoc().paperSize).toBe('letter');
  });

  it('falls back to Letter for a paper size it does not know', () => {
    localStorage.setItem(DOC_KEY, JSON.stringify({ filename: 'x.svg', backgroundColor: '#fff', paperSize: 'toString' }));
    expect(loadDoc().paperSize).toBe('letter');
  });
});
