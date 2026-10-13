import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { TOKEN_MANIFEST } from '@weasel-js/theme';
import { HANDLE_SIZE_TOKENS, handleHalf, handleSize } from './handles';

const here = dirname(fileURLToPath(import.meta.url));

describe('handle size tokens', () => {
  it('reads each rank off the theme', () => {
    expect(handleSize('--wzl-handle-size')).toBe(9);
    expect(handleSize('--wzl-handle-size-sm')).toBe(7);
    expect(handleSize('--wzl-handle-size-lg')).toBe(10);
    expect(handleSize('--wzl-handle-dot-size')).toBe(8);
    expect(handleSize('--wzl-handle-dot-size-sm')).toBe(7);
  });

  it('halves for the SVG rects that centre themselves on a point', () => {
    expect(handleHalf('--wzl-handle-size')).toBe(4.5);
  });

  // Stands in for the visual claim that a timeline key and a keyframe diamond
  // are the same size. The CSS-module proxy in this vitest project answers to
  // any key and jsdom resolves no var(), so neither a class name nor a computed
  // property can tell us anything — the stylesheet text is what is checkable
  // here, and a browser is what proves the pixels.
  it('is what the timeline stylesheet sizes its marks from', () => {
    const css = readFileSync(resolve(here, 'components/Timeline/Timeline.module.css'), 'utf8');
    const marks = css.slice(css.indexOf('.key, .eventMark'));
    expect(marks).toContain('var(--wzl-handle-size)');
    expect(marks).not.toMatch(/\b9px\b/);
    expect(marks).not.toMatch(/4\.5px/);
  });

  it('names every rank the theme publishes, so a new one cannot be missed', () => {
    const published = TOKEN_MANIFEST.map((t) => t.name).filter((name) => name.startsWith('--wzl-handle-'));
    expect(published.length).toBeGreaterThan(0);
    expect([...HANDLE_SIZE_TOKENS].sort()).toEqual(published.sort());
  });

  // The module-scope read resolves to the same number a literal would, so the
  // rendered radius cannot tell the two apart; the source text can.
  it('is what the curve editor sizes its round handles from', () => {
    const anchors = readFileSync(resolve(here, 'components/CurveEditor/createFunctionLayer.tsx'), 'utf8');
    expect(anchors).toContain("handleHalf('--wzl-handle-dot-size')");
    expect(anchors).not.toMatch(/\br=\{[\d.]+\}/);
    const keys = readFileSync(resolve(here, 'components/CurveEditor/createKeyframeLayer.tsx'), 'utf8');
    expect(keys).toContain("handleHalf('--wzl-handle-dot-size-sm')");
    expect(keys).not.toMatch(/RADIUS = [\d.]+/);
  });
});
