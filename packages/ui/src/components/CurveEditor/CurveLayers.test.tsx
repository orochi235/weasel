import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import type { ColorSource, Palette } from '@weasel-js/paint';
import { ThemeProvider } from '@weasel-js/theme/react';
import { LayeredCurveEditor } from './LayeredCurveEditor';
import type { CurveLayer } from './layerTypes';

const swatch = (id: string, color: ColorSource): CurveLayer<null> => ({
  id,
  render: (_state, ctx) => <rect data-swatch={id} fill={ctx.colorCss(color)} />,
});

const fillOf = (container: HTMLElement, id: string) =>
  container.querySelector(`[data-swatch="${id}"]`)!.getAttribute('fill');

describe('a custom layer', () => {
  it('writes a color source as CSS from its render context', () => {
    const layers = [
      { layer: swatch('token', { ref: 'accent' }), state: null },
      { layer: swatch('literal', { space: 'srgb', coords: [1, 0, 0] }), state: null },
      { layer: swatch('nothing', { ref: 'nope' }), state: null },
    ];
    const { container } = render(
      <LayeredCurveEditor layers={layers} onLayerChange={() => {}} width={200} height={100} />,
    );
    expect(fillOf(container, 'token')).toBe('var(--wzl-accent)');
    expect(fillOf(container, 'literal')).toBe('#ff0000');
    expect(fillOf(container, 'nothing')).toBeNull();
  });

  it('resolves against the palette in force', () => {
    const palette: Palette = { entries: [{ name: 'brand', color: { space: 'srgb', coords: [0, 0, 1] } }] };
    const { container } = render(
      <ThemeProvider palette={palette}>
        <LayeredCurveEditor
          layers={[{ layer: swatch('brand', { ref: 'brand' }), state: null }]}
          onLayerChange={() => {}}
          width={200}
          height={100}
        />
      </ThemeProvider>,
    );
    expect(fillOf(container, 'brand')).toBe('#0000ff');
  });
});
