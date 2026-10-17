import { describe, expect, it } from 'vitest';
import { keyStep } from './keys';
import type { MenuEntry } from './entries';

const run = () => {};
const root: MenuEntry[] = [
  { kind: 'item', key: 'cut', label: 'Cut', run },
  { kind: 'separator', key: 's1' },
  { kind: 'item', key: 'copy', label: 'Copy', run, disabled: true },
  { kind: 'submenu', key: 'arr', label: 'Arrange', entries: [
    { kind: 'item', key: 'fwd', label: 'Forward', run },
    { kind: 'item', key: 'back', label: 'Backward', run },
  ] },
];

describe('keyStep', () => {
  it('ArrowDown from nothing lands on the first row', () => {
    expect(keyStep(root, [null], 'ArrowDown').stack).toEqual([0]);
  });
  it('ArrowDown skips separators but not disabled rows', () => {
    expect(keyStep(root, [0], 'ArrowDown').stack).toEqual([2]);
  });
  it('ArrowDown wraps', () => {
    expect(keyStep(root, [3], 'ArrowDown').stack).toEqual([0]);
  });
  it('ArrowUp from nothing lands on the last row', () => {
    expect(keyStep(root, [null], 'ArrowUp').stack).toEqual([3]);
  });
  it('Home and End', () => {
    expect(keyStep(root, [2], 'Home').stack).toEqual([0]);
    expect(keyStep(root, [0], 'End').stack).toEqual([3]);
  });
  it('ArrowRight on a submenu opens it on its first row', () => {
    expect(keyStep(root, [3], 'ArrowRight').stack).toEqual([3, 0]);
  });
  it('ArrowRight on an item is an edge to the right and changes nothing', () => {
    const r = keyStep(root, [0], 'ArrowRight');
    expect(r).toMatchObject({ stack: [0], handled: true, effect: { kind: 'edge', dir: 1 } });
  });
  it('ArrowLeft at the first level is an edge to the left and changes nothing', () => {
    const r = keyStep(root, [0], 'ArrowLeft');
    expect(r).toMatchObject({ stack: [0], handled: true, effect: { kind: 'edge', dir: -1 } });
  });
  it('ArrowRight on a submenu opens it and is no edge', () => {
    expect(keyStep(root, [3], 'ArrowRight').effect).toEqual({ kind: 'none' });
  });
  it('ArrowLeft at a deeper level closes the level and is no edge', () => {
    expect(keyStep(root, [3, 0], 'ArrowLeft').effect).toEqual({ kind: 'none' });
  });
  it('ArrowLeft closes a submenu level and not the root', () => {
    expect(keyStep(root, [3, 1], 'ArrowLeft').stack).toEqual([3]);
    expect(keyStep(root, [3], 'ArrowLeft').stack).toEqual([3]);
  });
  it('Enter on an enabled item chooses it', () => {
    expect(keyStep(root, [3, 1], 'Enter').effect).toEqual({ kind: 'choose', level: 1, index: 1 });
  });
  it('Enter on a disabled item does nothing', () => {
    expect(keyStep(root, [2], 'Enter').effect).toEqual({ kind: 'none' });
  });
  it('Space on a submenu opens it', () => {
    expect(keyStep(root, [3], ' ').stack).toEqual([3, 0]);
  });
  it('Escape closes one level, then the menu', () => {
    expect(keyStep(root, [3, 0], 'Escape').stack).toEqual([3]);
    expect(keyStep(root, [3], 'Escape').effect).toEqual({ kind: 'close' });
  });
  it('Tab closes the menu', () => {
    expect(keyStep(root, [0], 'Tab').effect).toEqual({ kind: 'close' });
  });
  it('leaves other keys unhandled', () => {
    expect(keyStep(root, [0], 'x').handled).toBe(false);
  });
});
