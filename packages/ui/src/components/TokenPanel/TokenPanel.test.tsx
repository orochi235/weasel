import { act, fireEvent, screen, within } from '@testing-library/react';
import { renderWithIcons } from '../../testing/withIcons';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { toHex } from './color';
import { TokenPanel } from './TokenPanel';
import type { TokenEntry, TokenScale } from './tokenTypes';

vi.mock('./color', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./color')>();
  return { ...actual, toHex: vi.fn(actual.toHex) };
});

const tokens: TokenEntry[] = [
  { name: '--wzl-gray-50', type: 'color', group: 'gray', value: '#f5f5f6' },
  { name: '--wzl-gray-100', type: 'color', group: 'gray', value: '#e6e7e9' },
  { name: '--wzl-gray-200', type: 'color', group: 'gray', value: '#c9cbcf' },
  { name: '--wzl-focus-ring', type: 'color', group: 'focus', value: '#5841b8' },
  { name: '--wzl-space-sm', type: 'dimension', group: 'space', value: '8px' },
  { name: '--wzl-font-size', type: 'dimension', group: 'font', value: '13px' },
  { name: '--wzl-z-modal', type: 'number', group: 'z', value: '300' },
  { name: '--wzl-motion-fast', type: 'duration', group: 'motion', value: '120ms' },
  { name: '--wzl-ease-out-cubic', type: 'cubicBezier', group: 'ease', value: 'cubic-bezier(0.33, 1, 0.68, 1)' },
  { name: '--wzl-font-ui', type: 'fontFamily', group: 'font', value: 'Oswald, sans-serif' },
  { name: '--wzl-font-weight-bold', type: 'fontWeight', group: 'font', value: '400' },
  { name: '--gap', type: 'string', group: 'gap', value: 'auto' },
];

const section = (name: string) => within(screen.getByRole('region', { name }));

describe('TokenPanel', () => {
  it('sorts tokens into sections by category, each of which collapses', () => {
    renderWithIcons(<TokenPanel tokens={tokens} onChange={() => {}} />);
    expect(section('Color').getByRole('group', { name: '--wzl-focus-ring' })).toBeInTheDocument();
    expect(section('Type').getByRole('group', { name: '--wzl-font-size' })).toBeInTheDocument();
    expect(section('Type').getByRole('group', { name: '--wzl-font-ui' })).toBeInTheDocument();
    expect(section('Size').getByRole('group', { name: '--wzl-space-sm' })).toBeInTheDocument();
    expect(section('Motion').getByRole('group', { name: '--wzl-ease-out-cubic' })).toBeInTheDocument();
    expect(section('Depth').getByRole('group', { name: '--wzl-z-modal' })).toBeInTheDocument();
    expect(section('Other').getByRole('group', { name: '--gap' })).toBeInTheDocument();

    const toggle = screen.getByRole('button', { name: 'Size' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('group', { name: '--wzl-space-sm' })).toBeNull();
  });

  it('reports a collapse to a consumer that holds the state', () => {
    const onCollapsedChange = vi.fn();
    renderWithIcons(
      <TokenPanel tokens={tokens} onChange={() => {}} collapsed={{ motion: true }} onCollapsedChange={onCollapsedChange} />,
    );
    expect(screen.queryByRole('group', { name: '--wzl-motion-fast' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Motion' }));
    expect(onCollapsedChange).toHaveBeenCalledWith('motion', false);
  });

  it('draws a color family of three or more as one row of swatches, and edits the one picked', () => {
    const onChange = vi.fn();
    renderWithIcons(<TokenPanel tokens={tokens} onChange={onChange} />);
    const family = within(screen.getByRole('group', { name: 'gray' }));
    expect(family.getAllByRole('button')).toHaveLength(3);
    expect(screen.queryByRole('textbox', { name: '--wzl-gray-100 value' })).toBeNull();

    fireEvent.click(family.getByRole('button', { name: '--wzl-gray-100' }));
    expect(family.getByRole('button', { name: '--wzl-gray-100' })).toHaveAttribute('aria-pressed', 'true');
    const field = screen.getByRole('textbox', { name: '--wzl-gray-100 value' });
    expect(field).toHaveValue('#e6e7e9');
    fireEvent.change(field, { target: { value: '#000000' } });
    expect(onChange).toHaveBeenCalledWith('--wzl-gray-100', '#000000');
  });

  it('draws a size scale of three or more as one slider, a thumb per step labeled by what its name adds', () => {
    const onChange = vi.fn();
    const scale: TokenEntry[] = [
      { name: '--wzl-radius-sm', type: 'dimension', group: 'radius', value: '3px' },
      { name: '--wzl-radius-md', type: 'dimension', group: 'radius', value: '5px', overridden: true },
      { name: '--wzl-radius-lg', type: 'dimension', group: 'radius', value: '14px' },
      { name: '--wzl-radius', type: 'dimension', group: 'radius', value: '4px' },
    ];
    renderWithIcons(<TokenPanel tokens={scale} onChange={onChange} />);
    const family = within(screen.getByRole('group', { name: 'radius' }));
    expect(screen.queryByRole('group', { name: '--wzl-radius-sm' })).toBeNull();
    expect(family.getAllByRole('slider')).toHaveLength(4);
    expect(family.getByText('sm')).toBeInTheDocument();
    expect(family.getByText('lg')).toBeInTheDocument();
    expect(family.getAllByText('radius')).toHaveLength(2);
    expect(family.getAllByText('px')).toHaveLength(1);

    const md = family.getByRole('slider', { name: '--wzl-radius-md' });
    expect(md).toHaveAttribute('aria-valuetext', '5px');
    fireEvent.keyDown(md, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('--wzl-radius-md', '6px');
    fireEvent.keyDown(md, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith('--wzl-radius-md', '4px');

    fireEvent.click(family.getByRole('button', { name: 'Reset radius' }));
    expect(onChange).toHaveBeenCalledWith('--wzl-radius-md', null);
    expect(onChange).not.toHaveBeenCalledWith('--wzl-radius-sm', null);
  });

  it('reads the amount under the pointer through a drag out and back, with no step of its own added', () => {
    const start: TokenEntry[] = [
      { name: '--s-sm', type: 'dimension', group: 's', value: '8px' },
      { name: '--s-md', type: 'dimension', group: 's', value: '16px' },
      { name: '--s-lg', type: 'dimension', group: 's', value: '32px' },
    ];
    function Held() {
      const [held, setHeld] = useState(start);
      return (
        <TokenPanel
          tokens={held}
          onChange={(name, value) => setHeld((was) => was.map((t) => (t.name === name && value !== null ? { ...t, value } : t)))}
        />
      );
    }
    renderWithIcons(<Held />);
    const md = () => within(screen.getByRole('group', { name: 's' })).getByRole('slider', { name: '--s-md' });
    const rail = md().parentElement!;
    rail.getBoundingClientRect = () =>
      ({ x: 0, y: 0, left: 0, top: 0, width: 1000, height: 24, right: 1000, bottom: 24, toJSON: () => ({}) }) as DOMRect;
    // The track is logarithmic, from 8 / 1.5 to 32 * 1.5.
    const [lo, hi] = [Math.log2(8 / 1.5), Math.log2(32 * 1.5)];
    const at = (amount: number) => ({ clientX: ((Math.log2(amount) - lo) / (hi - lo)) * 1000, clientY: 12, pointerId: 1 });

    fireEvent.pointerDown(md(), { ...at(16), button: 0 });
    fireEvent.pointerMove(document, at(20));
    expect(md()).toHaveAttribute('aria-valuetext', '20px');
    fireEvent.pointerMove(document, at(16.3));
    expect(md()).toHaveAttribute('aria-valuetext', '16px');
    fireEvent.pointerMove(document, at(18));
    fireEvent.pointerMove(document, at(16));
    expect(md()).toHaveAttribute('aria-valuetext', '16px');
    fireEvent.pointerUp(document, at(16));
  });

  describe('a generated scale', () => {
    const fonts: TokenEntry[] = [
      { name: '--f-sm', type: 'dimension', group: 'f', value: '10px' },
      { name: '--f-md', type: 'dimension', group: 'f', value: '12px' },
      { name: '--f-lg', type: 'dimension', group: 'f', value: '18px' },
    ];
    const byFactors: TokenScale = {
      tokens: ['--f-sm', '--f-md', '--f-lg'],
      base: 12,
      rule: { kind: 'factors', factors: [0.8, 1, 1.5] },
    };
    const edit = (field: HTMLElement, value: string) =>
      act(() => {
        fireEvent.change(field, { target: { value } });
        fireEvent.blur(field);
      });

    it('edits its base, and moves a step by its multiplier', () => {
      const onScaleChange = vi.fn();
      const onChange = vi.fn();
      renderWithIcons(<TokenPanel tokens={fonts} onChange={onChange} scales={{ f: byFactors }} onScaleChange={onScaleChange} />);
      const family = within(screen.getByRole('group', { name: 'f' }));
      edit(family.getByRole('textbox', { name: 'f base' }), '14');
      expect(onScaleChange).toHaveBeenLastCalledWith('f', { ...byFactors, base: 14 });
      fireEvent.keyDown(family.getByRole('slider', { name: '--f-lg' }), { key: 'ArrowRight' });
      expect(onScaleChange).toHaveBeenLastCalledWith('f', {
        ...byFactors,
        rule: { kind: 'factors', factors: [0.8, 1, 1.5833] },
      });
      expect(onChange).not.toHaveBeenCalled();
    });

    it('writes only the step that moved, though the others hold more places than it rounds to', () => {
      const fine: TokenEntry[] = [
        { name: '--g-sm', type: 'dimension', group: 'g', value: '0.03125rem' },
        { name: '--g-md', type: 'dimension', group: 'g', value: '0.0625rem' },
        { name: '--g-lg', type: 'dimension', group: 'g', value: '0.125rem' },
      ];
      const onChange = vi.fn();
      const { unmount } = renderWithIcons(<TokenPanel tokens={fine} onChange={onChange} />);
      fireEvent.keyDown(within(screen.getByRole('group', { name: 'g' })).getByRole('slider', { name: '--g-lg' }), { key: 'ArrowRight' });
      expect(onChange.mock.calls).toEqual([['--g-lg', '0.1251rem']]);
      unmount();

      const onScaleChange = vi.fn();
      const scale: TokenScale = { tokens: fine.map((t) => t.name), base: 1, rule: { kind: 'factors', factors: [0.03125, 0.0625, 0.125] } };
      renderWithIcons(<TokenPanel tokens={fine} onChange={onChange} scales={{ g: scale }} onScaleChange={onScaleChange} />);
      fireEvent.keyDown(within(screen.getByRole('group', { name: 'g' })).getByRole('slider', { name: '--g-lg' }), { key: 'ArrowRight' });
      expect(onScaleChange.mock.calls).toEqual([['g', { ...scale, rule: { kind: 'factors', factors: [0.03125, 0.0625, 0.1251] } }]]);
    });

    it('refits to the steps as they stand when its rule changes', () => {
      const onScaleChange = vi.fn();
      renderWithIcons(<TokenPanel tokens={fonts} onChange={() => {}} scales={{ f: byFactors }} onScaleChange={onScaleChange} />);
      const family = within(screen.getByRole('group', { name: 'f' }));
      fireEvent.click(family.getByRole('radio', { name: 'step' }));
      expect(onScaleChange).toHaveBeenLastCalledWith('f', { ...byFactors, base: 10, rule: { kind: 'step', step: 4 } });
      fireEvent.click(family.getByRole('radio', { name: 'ratio' }));
      expect(onScaleChange).toHaveBeenLastCalledWith('f', { ...byFactors, base: 10, rule: { kind: 'ratio', ratio: 1.3416 } });
    });

    it('overrides a dragged step that no factor can reach', () => {
      for (const generator of [{ ...byFactors, base: 0 }, { ...byFactors, base: -12 }, { ...byFactors, rule: { kind: 'factors' as const, factors: [0.8, 1] } }]) {
        const onScaleChange = vi.fn();
        const onChange = vi.fn();
        const { unmount } = renderWithIcons(
          <TokenPanel tokens={fonts} onChange={onChange} scales={{ f: generator }} onScaleChange={onScaleChange} />,
        );
        fireEvent.keyDown(within(screen.getByRole('group', { name: 'f' })).getByRole('slider', { name: '--f-lg' }), { key: 'ArrowRight' });
        expect(onScaleChange).not.toHaveBeenCalled();
        expect(onChange).toHaveBeenCalledWith('--f-lg', '19px');
        unmount();
      }
    });

    it('refits factors of 1 from a base that is not positive', () => {
      const onScaleChange = vi.fn();
      const byStep: TokenScale = { ...byFactors, base: -1, rule: { kind: 'step', step: 4 } };
      renderWithIcons(<TokenPanel tokens={fonts} onChange={() => {}} scales={{ f: byStep }} onScaleChange={onScaleChange} />);
      fireEvent.click(within(screen.getByRole('group', { name: 'f' })).getByRole('radio', { name: 'factors' }));
      expect(onScaleChange).toHaveBeenLastCalledWith('f', { ...byStep, rule: { kind: 'factors', factors: [1, 1, 1] } });
    });

    it('draws no controls for a group it is not told how to generate', () => {
      renderWithIcons(<TokenPanel tokens={fonts} onChange={() => {}} />);
      expect(screen.queryByRole('textbox', { name: 'f base' })).toBeNull();
      expect(screen.queryByRole('radio', { name: 'step' })).toBeNull();
    });
  });

  it('keeps a unit on each step of a scale whose units differ', () => {
    const scale: TokenEntry[] = [
      { name: '--tracking-none', type: 'dimension', group: 'tracking', value: '0' },
      { name: '--tracking-wide', type: 'dimension', group: 'tracking', value: '0.06em' },
      { name: '--tracking-wider', type: 'dimension', group: 'tracking', value: '0.08em' },
    ];
    renderWithIcons(<TokenPanel tokens={scale} onChange={() => {}} />);
    expect(within(screen.getByRole('group', { name: 'tracking' })).getAllByText('em')).toHaveLength(2);
  });

  it('names a swatch and its value in a tooltip the moment it is hovered', () => {
    renderWithIcons(<TokenPanel tokens={tokens} onChange={() => {}} />);
    fireEvent.pointerMove(screen.getByRole('button', { name: '--wzl-gray-100' }), { pointerType: 'mouse' });
    fireEvent.pointerEnter(screen.getByRole('button', { name: '--wzl-gray-100' }), { pointerType: 'mouse' });
    expect(screen.getByRole('tooltip')).toHaveTextContent('--wzl-gray-100#e6e7e9');
  });

  it('gives a lone color a swatch and a value field', () => {
    const onChange = vi.fn();
    renderWithIcons(<TokenPanel tokens={tokens} onChange={onChange} />);
    const row = within(screen.getByRole('group', { name: '--wzl-focus-ring' }));
    expect(row.getByLabelText('--wzl-focus-ring color')).toHaveValue('#5841b8');
    fireEvent.change(row.getByRole('textbox'), { target: { value: 'red' } });
    expect(onChange).toHaveBeenCalledWith('--wzl-focus-ring', 'red');
  });

  it('keeps a translucent color’s alpha when its swatch picks a new color', () => {
    const onChange = vi.fn();
    renderWithIcons(
      <TokenPanel tokens={[{ name: '--line', type: 'color', group: 'line', value: 'rgba(230, 231, 233, 0.1)' }]} onChange={onChange} />,
    );
    fireEvent.change(screen.getByLabelText('--line color'), { target: { value: '#ff0000' } });
    expect(onChange).toHaveBeenCalledWith('--line', '#ff00001a');
  });

  it('edits a dimension as a number, keeping its unit', () => {
    const onChange = vi.fn();
    renderWithIcons(<TokenPanel tokens={tokens} onChange={onChange} />);
    const row = within(screen.getByRole('group', { name: '--wzl-space-sm' }));
    const number = row.getByRole('textbox', { name: '--wzl-space-sm value' });
    expect(number).toHaveValue('8');
    expect(row.getByText('px')).toBeInTheDocument();
    act(() => {
      fireEvent.change(number, { target: { value: '12' } });
      fireEvent.blur(number);
    });
    expect(onChange).toHaveBeenCalledWith('--wzl-space-sm', '12px');
  });

  it('edits a duration as a number of its unit', () => {
    renderWithIcons(<TokenPanel tokens={tokens} onChange={() => {}} />);
    const row = within(screen.getByRole('group', { name: '--wzl-motion-fast' }));
    expect(row.getByRole('textbox', { name: '--wzl-motion-fast value' })).toHaveValue('120');
    expect(row.getByText('ms')).toBeInTheDocument();
  });

  it('picks a font weight from the nine CSS weights', () => {
    const onChange = vi.fn();
    renderWithIcons(<TokenPanel tokens={tokens} onChange={onChange} />);
    const row = within(screen.getByRole('group', { name: '--wzl-font-weight-bold' }));
    const button = row.getByRole('button', { name: /--wzl-font-weight-bold/ });
    expect(button).toHaveTextContent('400');
    fireEvent.click(button);
    expect(screen.getAllByRole('option').map((o) => o.textContent))
      .toEqual(['100', '200', '300', '400', '500', '600', '700', '800', '900']);
    fireEvent.click(screen.getByRole('option', { name: '700' }));
    expect(onChange).toHaveBeenCalledWith('--wzl-font-weight-bold', '700');
  });

  it('draws an easing’s curve beside its value', () => {
    renderWithIcons(<TokenPanel tokens={tokens} onChange={() => {}} />);
    const row = within(screen.getByRole('group', { name: '--wzl-ease-out-cubic' }));
    expect(row.getByRole('img', { name: '--wzl-ease-out-cubic curve' })).toBeInTheDocument();
    expect(row.getByRole('textbox')).toHaveValue('cubic-bezier(0.33, 1, 0.68, 1)');
  });

  it('offers Reset on an overridden token, and reports it as a null value', () => {
    const onChange = vi.fn();
    renderWithIcons(
      <TokenPanel
        tokens={tokens.map((t) => (t.name === '--gap' ? { ...t, overridden: true } : t))}
        onChange={onChange}
      />,
    );
    expect(screen.getAllByRole('button', { name: /^Reset / })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Reset --gap' }));
    expect(onChange).toHaveBeenCalledWith('--gap', null);
  });

  it('redraws only the row whose token changed when a consumer rebuilds its entries', () => {
    const onChange = () => {};
    const { rerender } = renderWithIcons(<TokenPanel tokens={tokens} onChange={onChange} />);
    vi.mocked(toHex).mockClear();
    rerender(
      <TokenPanel
        tokens={tokens.map((t) => (t.name === '--wzl-focus-ring' ? { ...t, value: '#123456' } : { ...t }))}
        onChange={onChange}
      />,
    );
    expect(vi.mocked(toHex).mock.calls.map(([value]) => value)).toEqual(['#123456']);
  });

  it('draws names without namePrefix and keeps the full name in the tooltip', () => {
    renderWithIcons(
      <TokenPanel
        tokens={[{ name: '--wzl-leading', type: 'number', group: 'leading', value: '1.4' }]}
        onChange={() => {}}
        namePrefix="--wzl-"
      />,
    );
    const name = screen.getByText('leading');
    expect(name.getAttribute('title')).toBe('--wzl-leading');
  });

  it('names a group once down the rail for the rows that share it', () => {
    renderWithIcons(
      <TokenPanel
        tokens={[
          { name: '--wzl-checker-a', type: 'color', group: 'checker', value: '#111111' },
          { name: '--wzl-checker-b', type: 'color', group: 'checker', value: '#222222' },
          { name: '--wzl-shadow', type: 'color', group: 'shadow', value: '#000000' },
        ]}
        onChange={() => {}}
        namePrefix="--wzl-"
      />,
    );
    const rail = (name: string) => screen.getByRole('group', { name }).querySelector('span') as HTMLElement;
    expect(rail('--wzl-checker-a').textContent).toBe('checkera');
    expect(rail('--wzl-checker-b').textContent).toBe('checkerb');
    expect(rail('--wzl-checker-b').querySelector('[data-hidden]')?.textContent).toBe('checker');
    expect(rail('--wzl-checker-a').querySelector('[data-hidden]')).toBeNull();
    expect(rail('--wzl-shadow').textContent).toBe('shadow');
  });

  it('names a run of rows once whether or not namePrefix carries the `--`', () => {
    for (const namePrefix of [undefined, 'wzl-', '--wzl-']) {
      const { unmount } = renderWithIcons(
        <TokenPanel
          tokens={[
            { name: '--wzl-font-ui', type: 'fontFamily', group: 'wzl-font', value: 'Oswald' },
            { name: '--wzl-font-mono', type: 'fontFamily', group: 'wzl-font', value: 'Menlo' },
          ]}
          onChange={() => {}}
          namePrefix={namePrefix}
        />,
      );
      const rail = screen.getByRole('group', { name: '--wzl-font-mono' }).querySelector('span') as HTMLElement;
      expect(rail.querySelector('[data-hidden]')?.textContent).toBe(namePrefix ? 'font' : 'wzl-font');
      expect(rail.textContent).toBe(namePrefix ? 'fontmono' : 'wzl-fontmono');
      unmount();
    }
  });

  it('labels a family’s picked step with the group as its rail draws it', () => {
    renderWithIcons(
      <TokenPanel
        tokens={['50', '100', '200'].map((step) => ({ name: `--wzl-gray-${step}`, type: 'color', group: 'wzl-gray', value: '#808080' }))}
        onChange={() => {}}
        namePrefix="--wzl-"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '--wzl-gray-100' }));
    const editor = screen.getByRole('group', { name: '--wzl-gray-100' });
    expect(editor.querySelector('span')?.textContent).toBe('gray 100');
  });

  it('shows the group on a run’s row named as the group, wherever it stands', () => {
    renderWithIcons(
      <TokenPanel
        tokens={[
          { name: '--wzl-space-1', type: 'string', group: 'space', value: 'a' },
          { name: '--wzl-space', type: 'string', group: 'space', value: 'b' },
        ]}
        onChange={() => {}}
        namePrefix="--wzl-"
      />,
    );
    const rail = screen.getByRole('group', { name: '--wzl-space' }).querySelector('span') as HTMLElement;
    expect(rail.textContent).toBe('space');
    expect(rail.querySelector('[data-hidden]')).toBeNull();
  });

  it('leaves a token alone when its number field is focused and blurred untouched', () => {
    const onChange = vi.fn();
    renderWithIcons(
      <TokenPanel
        tokens={[{ name: '--wzl-line', type: 'dimension', group: 'line', value: '0.33333rem' }]}
        onChange={onChange}
      />,
    );
    const field = screen.getByRole('textbox', { name: '--wzl-line value' });
    act(() => field.focus());
    act(() => field.blur());
    expect(onChange).not.toHaveBeenCalled();
  });
});
