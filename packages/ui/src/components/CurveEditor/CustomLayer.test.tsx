import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { fireEvent, render } from '@testing-library/react';
import type { ColorSource, Palette } from '@weasel-js/paint';
import { defineTheme } from '@weasel-js/theme';
import { ThemeProvider } from '@weasel-js/theme/react';
import { keyframeLayerState } from './createKeyframeLayer';
import { CustomLayer } from './CustomLayer';
import { KeyframeLayer } from './KeyframeLayer';
import { LayeredCurveEditor } from './LayeredCurveEditor';
import type { CurveLayer } from './layerTypes';

const swatch = (id: string, color: ColorSource): CurveLayer<null> => ({
  id,
  render: (_state, ctx) => <rect data-swatch={id} fill={ctx.colorCss(color)} />,
});

const fillOf = (container: HTMLElement, id: string) =>
  container.querySelector(`[data-swatch="${id}"]`)!.getAttribute('fill');

const noop = () => {};

describe('a custom layer', () => {
  it('writes a color source as CSS from its render context', () => {
    const { container } = render(
      <LayeredCurveEditor width={200} height={100}>
        <CustomLayer layer={swatch('token', { ref: 'accent' })} state={null} onChange={noop} />
        <CustomLayer layer={swatch('literal', { space: 'srgb', coords: [1, 0, 0] })} state={null} onChange={noop} />
        <CustomLayer layer={swatch('nothing', { ref: 'nope' })} state={null} onChange={noop} />
      </LayeredCurveEditor>,
    );
    expect(fillOf(container, 'token')).toBe('var(--wzl-accent)');
    expect(fillOf(container, 'literal')).toBe('#ff0000');
    expect(fillOf(container, 'nothing')).toBeNull();
  });

  it('resolves against the palette in force', () => {
    const palette: Palette = { entries: [{ name: 'brand', color: { space: 'srgb', coords: [0, 0, 1] } }] };
    const { container } = render(
      <ThemeProvider palette={palette}>
        <LayeredCurveEditor width={200} height={100}>
          <CustomLayer layer={swatch('brand', { ref: 'brand' })} state={null} onChange={noop} />
        </LayeredCurveEditor>
      </ThemeProvider>,
    );
    expect(fillOf(container, 'brand')).toBe('#0000ff');
  });

  it('refuses to render outside an editor', () => {
    vi.spyOn(console, 'error').mockImplementation(noop);
    expect(() => render(<svg><CustomLayer layer={swatch('lost', { ref: 'accent' })} state={null} onChange={noop} /></svg>)).toThrow(/LayeredCurveEditor/);
    vi.mocked(console.error).mockRestore();
  });
});

/** A layer claiming every press, reporting its id to `pressed`. */
const claimer = (id: string, pressed: string[]): CurveLayer<null> => ({
  id,
  render: () => <rect data-claimer={id} />,
  hitTest: () => ({ kind: 'all' }),
  onPointerDown: () => { pressed.push(id); },
});

describe('the layer stack', () => {
  const press = () => fireEvent.pointerDown(document.querySelector('svg')!, { clientX: 50, clientY: 50, button: 0, pointerId: 1 });

  it('draws the children in order, plain SVG among them, and gives a press to the last one claiming it', () => {
    const pressed: string[] = [];
    const { container } = render(
      <LayeredCurveEditor width={200} height={100} history={false}>
        <CustomLayer layer={claimer('below', pressed)} state={null} onChange={noop} />
        <rect data-chrome="" />
        <CustomLayer layer={claimer('above', pressed)} state={null} onChange={noop} />
      </LayeredCurveEditor>,
    );
    const order = [...container.querySelectorAll('[data-claimer], [data-chrome]')].map((el) => el.getAttribute('data-claimer') ?? 'chrome');
    expect(order).toEqual(['below', 'chrome', 'above']);
    press();
    expect(pressed).toEqual(['above']);
  });

  it('follows the children when they reorder, and forgets a layer that leaves', () => {
    const pressed: string[] = [];
    const a = claimer('a', pressed);
    const b = claimer('b', pressed);
    function Stack({ flip, drop }: { flip: boolean; drop?: boolean }) {
      const layers = [<CustomLayer key="a" layer={a} state={null} onChange={noop} />, <CustomLayer key="b" layer={b} state={null} onChange={noop} />];
      const shown = flip ? layers.reverse() : layers;
      return <LayeredCurveEditor width={200} height={100} history={false}>{drop ? shown.slice(0, 1) : shown}</LayeredCurveEditor>;
    }
    const { rerender } = render(<Stack flip={false} />);
    press();
    rerender(<Stack flip />);
    press();
    rerender(<Stack flip drop />);
    press();
    expect(pressed).toEqual(['b', 'a', 'b']);
  });

  it('reports a commit to the layer that made it, with the state before it', () => {
    const onCommit = vi.fn();
    const inserter: CurveLayer<number> = {
      id: 'count',
      render: () => null,
      onEmptyPointerDown: (state, _m, _e, _c, extra) => { extra.commit(state + 1); },
    };
    function Count() {
      const [n, setN] = useState(0);
      return (
        <LayeredCurveEditor width={200} height={100}>
          <CustomLayer layer={inserter} state={n} onChange={setN} onCommit={onCommit} />
        </LayeredCurveEditor>
      );
    }
    render(<Count />);
    press();
    expect(onCommit).toHaveBeenCalledWith(1, 0);
    fireEvent.keyDown(document.querySelector('svg')!, { key: 'z', ctrlKey: true });
    expect(onCommit).toHaveBeenLastCalledWith(0, 1);
  });
});

describe('the keyframe layer', () => {
  it('draws its keys at the handle size of the theme in force', () => {
    const big = defineTheme({ name: 'big-handles', pins: { 'handle-size': '20px' } });
    const state = keyframeLayerState([{ t: 0, value: 0 }, { t: 1, value: 1 }]);
    const { container } = render(
      <ThemeProvider theme={big}>
        <LayeredCurveEditor width={200} height={100}>
          <KeyframeLayer label="x" state={state} onChange={noop} />
        </LayeredCurveEditor>
      </ThemeProvider>,
    );
    expect(container.querySelector('[data-keyframe-index="0"]')!.getAttribute('width')).toBe('20');
  });
});
