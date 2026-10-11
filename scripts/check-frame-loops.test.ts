import { describe, expect, it } from 'vitest';
import { frameLoopLines } from './check-frame-loops.mjs';

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
});
