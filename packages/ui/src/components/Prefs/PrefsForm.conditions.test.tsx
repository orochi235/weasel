import { cleanup, screen, within } from '@testing-library/react';
import type { PrefCondition, PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { afterEach, describe, expect, it } from 'vitest';
import { PrefsForm, type PrefRenderContext } from './PrefsForm';
import { renderWithIcons } from '../../testing/withIcons';

afterEach(cleanup);

type Extra = Record<string, unknown>;
const flag = (name: string, extra: Extra = {}): PrefLeaf =>
  ({ kind: 'boolean', name, description: '', default: false, ...extra }) as PrefLeaf;
const num = (name: string, extra: Extra = {}): PrefLeaf =>
  ({ kind: 'number', name, description: '', default: 0, ...extra }) as PrefLeaf;

const on: PrefCondition = { path: 'snap.on' };
const noop = (): void => {};

/** The row a control sits in, found by the attribute a disabled row carries and not by a class. */
const disabledRow = (el: HTMLElement): Element | null => el.closest('[data-property-row][data-disabled]');

describe('PrefsForm showIf', () => {
  const schema: PrefGroup = {
    name: 'Root',
    children: {
      snap: { name: 'Snap', children: { on: flag('Snap on'), size: num('Grid size', { showIf: on }) } },
      grid: { name: 'Grid', showIf: on, children: { fine: flag('Fine') } },
    },
  };

  it('draws nothing for a leaf whose condition fails, and draws it once it holds', () => {
    const { rerender } = renderWithIcons(<PrefsForm schema={schema} values={{ snap: { on: false } }} onChange={noop} />);
    expect(screen.queryByText('Grid size')).toBeNull();
    expect(screen.queryByRole('spinbutton', { name: 'Grid size' })).toBeNull();
    rerender(<PrefsForm schema={schema} values={{ snap: { on: true } }} onChange={noop} />);
    expect(screen.getByRole('spinbutton', { name: 'Grid size' })).toBeInTheDocument();
  });

  it('reads a leaf with nothing stored as its default', () => {
    const byDefault: PrefGroup = { name: '', children: { on: flag('On', { default: true }), size: num('Size', { showIf: { path: 'on' } }) } };
    const { rerender } = renderWithIcons(<PrefsForm schema={byDefault} onChange={noop} />);
    expect(screen.getByRole('spinbutton', { name: 'Size' })).toBeInTheDocument();
    rerender(<PrefsForm schema={byDefault} values={{ on: false }} onChange={noop} />);
    expect(screen.queryByRole('spinbutton', { name: 'Size' })).toBeNull();
  });

  it.each(['columns', 'list'] as const)('draws no heading and no rows for a hidden group in the %s layout', (layout) => {
    renderWithIcons(<PrefsForm layout={layout} schema={schema} values={{}} onChange={noop} />);
    expect(screen.queryByText('Grid')).toBeNull();
    expect(screen.queryByText('Fine')).toBeNull();
    expect(screen.getByText('Snap on')).toBeInTheDocument();
  });

  it('gives a hidden page no rail entry, and brings the entry back with the page', () => {
    const view = (snap: boolean) => <PrefsForm layout="rail" schema={schema} values={{ snap: { on: snap } }} onChange={noop} />;
    const { rerender } = renderWithIcons(view(false));
    const rail = screen.getByRole('navigation');
    expect(within(rail).queryByText('Grid')).toBeNull();
    rerender(view(true));
    expect(within(screen.getByRole('navigation')).getByText('Grid')).toBeInTheDocument();
  });

  it('gives a hidden nested group no rail entry, as a section or as a page of its own', () => {
    for (const as of [undefined, 'page'] as const) {
      const deep: PrefGroup = {
        name: 'Root',
        children: { snap: { name: 'Snap', children: { on: flag('Snap on'), more: { name: 'More', as, showIf: on, children: { fine: flag('Fine') } } } } },
      };
      const { unmount } = renderWithIcons(<PrefsForm layout="rail" schema={deep} values={{}} onChange={noop} />);
      expect(within(screen.getByRole('navigation')).queryByText('More')).toBeNull();
      expect(screen.queryByText('Fine')).toBeNull();
      unmount();
    }
  });

  it('draws no tab for a hidden tab group, and no section heading for a hidden section', () => {
    const tabs: PrefGroup = {
      name: 'Root',
      children: {
        snap: {
          name: 'Snap',
          children: {
            on: flag('Snap on'),
            light: { name: 'Light', as: 'tab', children: { glow: flag('Glow') } },
            dark: { name: 'Dark', as: 'tab', showIf: on, children: { dim: flag('Dim') } },
            edge: { name: 'Edges', as: 'section', showIf: on, children: { round: flag('Round') } },
          },
        },
      },
    };
    renderWithIcons(<PrefsForm layout="rail" schema={tabs} values={{}} onChange={noop} />);
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Light']);
    expect(screen.queryByText('Edges')).toBeNull();
    expect(screen.queryByText('Round')).toBeNull();
  });

  it('drops a hidden field of an object leaf', () => {
    const object: PrefGroup = {
      name: 'Root',
      children: {
        stroke: {
          kind: 'object', name: 'Stroke', description: '', default: { width: 0, dash: 0 },
          children: { width: num('Width'), dash: num('Dash', { showIf: { path: 'stroke.width', above: 0 } }) },
        } as PrefLeaf,
      },
    };
    const { rerender } = renderWithIcons(<PrefsForm schema={object} values={{}} onChange={noop} />);
    expect(screen.queryByRole('spinbutton', { name: 'Dash' })).toBeNull();
    rerender(<PrefsForm schema={object} values={{ stroke: { width: 2, dash: 0 } }} onChange={noop} />);
    expect(screen.getByRole('spinbutton', { name: 'Dash' })).toBeInTheDocument();
  });
});

describe('PrefsForm enableIf', () => {
  const schema: PrefGroup = {
    name: 'Root',
    children: {
      snap: { name: 'Snap', children: { on: flag('Snap on'), size: num('Grid size', { enableIf: on }) } },
      grid: { name: 'Grid', enableIf: on, children: { fine: flag('Fine'), step: num('Step') } },
    },
  };

  it('draws a leaf whose condition fails with its control disabled and its row marked', () => {
    const { rerender } = renderWithIcons(<PrefsForm schema={schema} values={{ snap: { on: false } }} onChange={noop} />);
    const size = screen.getByRole('spinbutton', { name: 'Grid size' });
    expect(size).toBeDisabled();
    expect(disabledRow(size)).not.toBeNull();
    const snap = screen.getByRole('checkbox', { name: 'Snap on' });
    expect(snap).toBeEnabled();
    expect(disabledRow(snap)).toBeNull();
    rerender(<PrefsForm schema={schema} values={{ snap: { on: true } }} onChange={noop} />);
    expect(screen.getByRole('spinbutton', { name: 'Grid size' })).toBeEnabled();
    expect(disabledRow(screen.getByRole('spinbutton', { name: 'Grid size' }))).toBeNull();
  });

  it('disables every leaf under a group whose condition fails', () => {
    renderWithIcons(<PrefsForm schema={schema} values={{}} onChange={noop} />);
    expect(screen.getByRole('checkbox', { name: 'Fine' })).toBeDisabled();
    expect(screen.getByRole('spinbutton', { name: 'Step' })).toBeDisabled();
  });

  it('tells a custom renderer', () => {
    const seen: Array<boolean | undefined> = [];
    const custom: PrefGroup = {
      name: 'Root',
      children: { on: flag('Snap on'), dial: { kind: 'dial', name: 'Dial', description: '', default: 0, enableIf: { path: 'on' } } as PrefLeaf },
    };
    const dial = (ctx: PrefRenderContext) => {
      seen.push(ctx.disabled);
      return <button type="button" disabled={ctx.disabled}>dial</button>;
    };
    const { rerender } = renderWithIcons(<PrefsForm schema={custom} values={{ on: false }} renderers={{ dial }} onChange={noop} />);
    expect(seen.at(-1)).toBe(true);
    expect(screen.getByText('dial')).toBeDisabled();
    rerender(<PrefsForm schema={custom} values={{ on: true }} renderers={{ dial }} onChange={noop} />);
    expect(seen.at(-1)).toBe(false);
  });

  it('disables one field of an object leaf, and every field of a disabled one', () => {
    const stroke = (extra: Extra): PrefLeaf => ({
      kind: 'object', name: 'Stroke', description: '', default: { width: 0, dash: 0 }, ...extra,
      children: { width: num('Width'), dash: num('Dash', { enableIf: { path: 'stroke.width', above: 0 } }) },
    }) as PrefLeaf;
    const { rerender } = renderWithIcons(<PrefsForm schema={{ name: '', children: { stroke: stroke({}) } }} values={{}} onChange={noop} />);
    expect(screen.getByRole('spinbutton', { name: 'Width' })).toBeEnabled();
    expect(screen.getByRole('spinbutton', { name: 'Dash' })).toBeDisabled();
    rerender(<PrefsForm schema={{ name: '', children: { stroke: stroke({ enableIf: { path: 'no' } }) } }} values={{ stroke: { width: 2 } }} onChange={noop} />);
    expect(screen.getByRole('spinbutton', { name: 'Width' })).toBeDisabled();
    expect(screen.getByRole('spinbutton', { name: 'Dash' })).toBeDisabled();
  });

  it('disables a list: its entries, its add button, and its remove buttons', () => {
    const off = { enableIf: { path: 'no' } };
    const lists: PrefGroup = {
      name: '',
      children: {
        flags: { kind: 'list', name: 'Flags', description: '', default: [false], item: flag('Flag'), ...off } as PrefLeaf,
        words: { kind: 'list', name: 'Words', description: '', default: ['a'], item: { kind: 'string', name: 'Word', description: '', default: '' }, ...off } as PrefLeaf,
      },
    };
    renderWithIcons(<PrefsForm schema={lists} values={{}} onChange={noop} />);
    expect(screen.getByRole('checkbox', { name: 'Flag 1' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Word 1' })).toBeDisabled();
    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled();
  });

  it('disables a map, a union, and an action', () => {
    const off = { enableIf: { path: 'no' } };
    const variant = { kind: 'object', name: 'Linear', description: '', default: { angle: 0 }, children: { angle: num('Angle') } };
    const mixed: PrefGroup = {
      name: '',
      children: {
        map: { kind: 'map', name: 'Map', description: '', default: { a: 1 }, item: num('Value'), ...off } as PrefLeaf,
        fill: { kind: 'union', name: 'Fill', description: '', default: { type: 'linear', angle: 0 }, tag: 'type', variants: { linear: variant }, ...off } as PrefLeaf,
        go: { kind: 'action', name: 'Go', description: '', default: undefined, run: noop, ...off } as PrefLeaf,
      },
    };
    renderWithIcons(<PrefsForm schema={mixed} values={{}} onChange={noop} />);
    expect(screen.getByRole('textbox', { name: /key/ })).toBeDisabled();
    expect(screen.getByRole('spinbutton', { name: 'Value a' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Fill/ })).toBeDisabled();
    expect(screen.getByRole('spinbutton', { name: 'Angle' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Go' })).toBeDisabled();
  });

  it('disables the cells of a bar', () => {
    const bar: PrefGroup = {
      name: '',
      children: {
        on: flag('Snap on'),
        tools: { name: 'Tools', as: 'bar', children: { size: num('Size', { enableIf: { path: 'on' } }), go: { kind: 'action', name: 'Go', description: '', default: undefined, run: noop, enableIf: { path: 'on' } } as PrefLeaf, gone: num('Gone', { showIf: { path: 'on' } }) } },
      },
    };
    renderWithIcons(<PrefsForm layout="list" schema={bar} values={{}} onChange={noop} />);
    expect(screen.getByRole('spinbutton', { name: 'Size' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Go' })).toBeDisabled();
    expect(screen.queryByRole('spinbutton', { name: 'Gone' })).toBeNull();
  });
});
