import { describe, expect, it } from 'vitest';
import { parseSvg } from './parse';
import type { ParseOptions, SvgPathNode } from './types';

const RED = { kind: 'solid', color: '#ff0000' };
const BLACK = { kind: 'solid', color: '#000000' };

/** The fill of a rect in a 400 x 200 document whose root is styled by `root` and whose sheet is `css`. */
function fillOf(css: string, root = 'container-type: size', opts?: ParseOptions): unknown {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" style="${root}">`
    + `<style>${css}</style><g><rect width="1" height="1"/></g></svg>`;
  const group = parseSvg(svg, opts).nodes[0] as { children: SvgPathNode[] };
  return group.children[0].fill;
}

describe('@container against the root <svg>', () => {
  it('applies a rule whose size query the root holds', () => {
    expect(fillOf('@container (min-width: 300px) { rect { fill: red } }')).toEqual(RED);
    expect(fillOf('@container (width > 500px) { rect { fill: red } }')).toEqual(BLACK);
    expect(fillOf('@container (height = 200px) and (orientation: landscape) { rect { fill: red } }')).toEqual(RED);
    expect(fillOf('@container not (width &lt; 300px) { rect { fill: red } }')).toEqual(RED);
    expect(fillOf('@container (aspect-ratio: 2 / 1) { rect { fill: red } }')).toEqual(RED);
  });

  it('applies nothing when the root is not a size container', () => {
    expect(fillOf('@container (min-width: 1px) { rect { fill: red } }', '')).toEqual(BLACK);
    expect(fillOf('@container (min-width: 1px) { rect { fill: red } }', 'container-type: normal')).toEqual(BLACK);
  });

  it('reads the container type from a stylesheet rule and from the shorthand', () => {
    expect(fillOf('svg { container-type: size } @container (min-width: 1px) { rect { fill: red } }', '')).toEqual(RED);
    expect(fillOf('@container (min-width: 1px) { rect { fill: red } }', 'container: card / size')).toEqual(RED);
  });

  it('answers only the inline axis for an inline-size container', () => {
    const root = 'container-type: inline-size';
    expect(fillOf('@container (inline-size >= 400px) { rect { fill: red } }', root)).toEqual(RED);
    expect(fillOf('@container (min-height: 1px) { rect { fill: red } }', root)).toEqual(BLACK);
    expect(fillOf('@container (block-size > 1px) { rect { fill: red } }', root)).toEqual(BLACK);
    expect(fillOf('@container (block-size > 1px) { rect { fill: red } }')).toEqual(RED);
  });

  it('matches a named query against the names the root declares', () => {
    const root = 'container-type: size; container-name: card page';
    expect(fillOf('@container page (min-width: 1px) { rect { fill: red } }', root)).toEqual(RED);
    expect(fillOf('@container sidebar (min-width: 1px) { rect { fill: red } }', root)).toEqual(BLACK);
    expect(fillOf('@container sidebar (min-width: 1px) { rect { fill: red } }')).toEqual(BLACK);
  });

  it('never applies to the root itself, which has no container above it', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" style="container-type: size">'
      + '<style>@container (min-width: 1px) { svg { fill: red } }</style><rect width="1" height="1"/></svg>';
    expect((parseSvg(svg).nodes[0] as SvgPathNode).fill).toEqual(BLACK);
  });

  it('answers no to what a size container cannot be asked', () => {
    expect(fillOf('@container style(--theme: dark) { rect { fill: red } }')).toEqual(BLACK);
    expect(fillOf('@container (prefers-color-scheme: light) { rect { fill: red } }')).toEqual(BLACK);
    expect(fillOf('@container (hover: none) { rect { fill: red } }')).toEqual(BLACK);
  });

  it('nests with the other conditional rules and keeps the cascade order', () => {
    expect(fillOf('@media screen { @container (min-width: 1px) { rect { fill: red } } }')).toEqual(RED);
    expect(fillOf('@container (min-width: 1px) { @media print { rect { fill: red } } }')).toEqual(BLACK);
    expect(fillOf('@container (min-width: 1px) { @container (max-width: 1px) { rect { fill: red } } }')).toEqual(BLACK);
    expect(fillOf('@container (min-width: 1px) { rect { fill: blue } } rect { fill: red }')).toEqual(RED);
    expect(fillOf('rect { fill: blue } @container (min-width: 1px) { rect { fill: red } }')).toEqual(RED);
  });

  it('sizes the root from the media environment a caller overrides', () => {
    expect(fillOf('@container (min-width: 1000px) { rect { fill: red } }', 'container-type: size', { media: { width: 1200 } }))
      .toEqual(RED);
  });
});
