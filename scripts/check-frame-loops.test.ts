import { describe, expect, it } from 'vitest';
import { frameLoopLines, offendingLines } from './check-frame-loops.mjs';

describe('frameLoopLines', () => {
  it('catches a call on one line', () => {
    expect(frameLoopLines('const a = 1;\nrequestAnimationFrame(tick);\n')).toEqual([2]);
  });

  it('catches a call split across lines', () => {
    expect(frameLoopLines('const id = window.requestAnimationFrame\n  (tick);\n')).toEqual([1]);
  });

  it('catches an alias, which a later call would hide', () => {
    expect(frameLoopLines('const raf = requestAnimationFrame;\nraf(tick);\n')).toEqual([1]);
    expect(frameLoopLines('const raf = window.requestAnimationFrame.bind(window);\n')).toEqual([1]);
  });

  it('ignores the name in a comment', () => {
    const source = [
      '// requestAnimationFrame(tick) is what this replaces',
      '/** Defaults to `requestAnimationFrame`. */',
      '/*',
      ' * requestAnimationFrame(tick)',
      ' */',
      'const url = "https://example.com"; // requestAnimationFrame',
      'cancelAnimationFrame(id);',
    ].join('\n');
    expect(frameLoopLines(source)).toEqual([]);
  });

  it('reports the line of a use that follows a block comment', () => {
    expect(frameLoopLines('/*\n * a note\n */\nrequestAnimationFrame(tick);\n')).toEqual([4]);
  });

  it('catches a setInterval, which is a loop the gate never sees', () => {
    expect(frameLoopLines('const id = setInterval(tick, 16);\nwindow.setInterval(tick, 16);\n')).toEqual([1, 2]);
    expect(frameLoopLines('clearInterval(id);\n// setInterval would leak\n')).toEqual([]);
  });
});

describe('offendingLines', () => {
  it('reports every use in a file that is not allowlisted', () => {
    expect(offendingLines([3, 9])).toEqual([3, 9]);
  });

  it('lets an allowlisted file keep the uses its entry covers', () => {
    expect(offendingLines([3], 1)).toEqual([]);
  });

  it('reports an allowlisted file that gained a use', () => {
    expect(offendingLines([3, 9], 1)).toEqual([3, 9]);
  });
});
