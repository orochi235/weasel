import { describe, it, expect } from 'vitest';
import { frameRect, type SpriteSheet } from './spriteSheet';

const SHEET: SpriteSheet = { frameWidth: 16, frameHeight: 24, columns: 4 };

describe('frameRect', () => {
  it('puts frame 0 at the sheet origin', () => {
    expect(frameRect(SHEET, 0)).toEqual({ x: 0, y: 0, w: 16, h: 24 });
  });

  it('steps across a row by the frame width', () => {
    expect(frameRect(SHEET, 2)).toEqual({ x: 32, y: 0, w: 16, h: 24 });
  });

  it('wraps to the next row after `columns` frames', () => {
    expect(frameRect(SHEET, 4)).toEqual({ x: 0, y: 24, w: 16, h: 24 });
  });

  it('offsets the whole grid by the margin', () => {
    const sheet: SpriteSheet = { ...SHEET, margin: 3 };
    expect(frameRect(sheet, 0)).toEqual({ x: 3, y: 3, w: 16, h: 24 });
    expect(frameRect(sheet, 5)).toEqual({ x: 3 + 16, y: 3 + 24, w: 16, h: 24 });
  });

  it('adds spacing between adjacent cells but not before the first', () => {
    const sheet: SpriteSheet = { ...SHEET, spacing: 2 };
    expect(frameRect(sheet, 0)).toEqual({ x: 0, y: 0, w: 16, h: 24 });
    expect(frameRect(sheet, 1)).toEqual({ x: 18, y: 0, w: 16, h: 24 });
    expect(frameRect(sheet, 4)).toEqual({ x: 0, y: 26, w: 16, h: 24 });
  });

  it('combines margin and spacing', () => {
    const sheet: SpriteSheet = { ...SHEET, margin: 3, spacing: 2 };
    expect(frameRect(sheet, 5)).toEqual({ x: 3 + 18, y: 3 + 26, w: 16, h: 24 });
  });

  it('runs past the last row rather than wrapping', () => {
    // Nothing here knows the sheet has 8 filled cells; index 9 is row 2.
    expect(frameRect(SHEET, 9)).toEqual({ x: 16, y: 48, w: 16, h: 24 });
  });
});
