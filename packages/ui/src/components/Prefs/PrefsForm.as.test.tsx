import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { PrefGroup } from '@weasel-js/prefs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PrefsForm } from './PrefsForm';
import { prefRailItems } from './schema';

afterEach(cleanup);

const flag = (name: string) => ({ kind: 'boolean' as const, name, description: '', default: false });
const SCHEMA: PrefGroup = {
  name: '',
  children: {
    canvas: { name: 'Canvas', children: {
      grid: flag('Grid'),
      light: { name: 'Light', as: 'tab', children: { glow: flag('Glow') } },
      dark: { name: 'Dark', as: 'tab', children: { dim: flag('Dim') } },
      box: { name: 'Box', as: 'panel', children: { edge: flag('Edge') } },
      snap: { name: 'Snapping', children: { on: flag('Snap on') } },
    } },
    extras: { name: 'Extras', as: 'panel', children: { beta: flag('Beta') } },
  },
};

describe('a group\'s `as`', () => {
  it('gives the rail a page per page group, files the rest on the root\'s own page, and links sections only', () => {
    expect(prefRailItems(SCHEMA).map((i) => [i.path, i.depth])).toEqual([
      ['', 0],
      ['canvas', 0],
      ['canvas.snap', 1],
    ]);
  });

  it('draws a top-level panel on the root\'s own page', () => {
    render(<PrefsForm layout="rail" schema={SCHEMA} onChange={() => {}} />);
    expect(within(screen.getByRole('region', { name: 'Extras' })).getByText('Beta')).toBeInTheDocument();
  });

  it('draws neighboring tabs as one strip and shows the rows of the one picked', () => {
    render(<PrefsForm layout="rail" schema={SCHEMA} onChange={() => {}} defaultSection="canvas" />);
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Light', 'Dark']);
    expect(screen.getByText('Glow')).toBeInTheDocument();
    expect(screen.queryByText('Dim')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Dark' }));
    expect(screen.getByText('Dim')).toBeInTheDocument();
    expect(screen.queryByText('Glow')).toBeNull();
    expect(within(screen.getByRole('region', { name: 'Box' })).getByText('Edge')).toBeInTheDocument();
  });

  it.each(['columns', 'list'] as const)('draws tabs, a section heading and a panel in the %s layout too', (layout) => {
    render(<PrefsForm layout={layout} schema={SCHEMA.children.canvas as PrefGroup} onChange={() => {}} />);
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Light', 'Dark']);
    expect(screen.getByText('Glow')).toBeInTheDocument();
    expect(screen.queryByText('Dim')).toBeNull();
    expect(screen.getByText('Edge')).toBeInTheDocument();
  });

  it('opens the tab that holds a selection when it arrives', () => {
    const view = (selected?: string) => <PrefsForm layout="rail" schema={SCHEMA} onChange={() => {}} defaultSection="canvas" selected={selected === undefined ? undefined : [selected]} />;
    const { rerender } = render(view());
    rerender(view('canvas.dark.dim'));
    expect(screen.getByText('Dim')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Light' }));
    expect(screen.getByText('Glow')).toBeInTheDocument();
  });

  it('draws a bar group as one line of bar forms with no heading, and writes through its path', () => {
    const schema: PrefGroup = {
      name: '',
      children: {
        canvas: { name: 'Canvas', children: {
          tools: { name: 'Tools', as: 'bar', children: {
            snap: flag('Snap'),
            zoom: { kind: 'number', name: 'Zoom', description: '', default: 1 },
            more: { name: 'More', as: 'panel', children: { ruler: flag('Ruler') } },
          } },
        } },
      },
    };
    const onChange = vi.fn();
    render(<PrefsForm layout="rail" schema={schema} onChange={onChange} defaultSection="canvas" />);
    const bar = screen.getByRole('toolbar', { name: 'Tools' });
    expect(screen.queryByRole('heading', { name: 'Tools' })).toBeNull();
    // A flag is a button in a bar, where a row draws a checkbox.
    fireEvent.click(within(bar).getByRole('button', { name: 'Snap' }));
    expect(onChange).toHaveBeenCalledWith('canvas.tools.snap', true);
    expect(bar.querySelector('[data-bar-label]')).toHaveTextContent('Zoom');
    expect(bar.querySelector('[data-pref-path="canvas.tools.zoom"]')).not.toBeNull();
    expect(screen.queryByText('Ruler')).toBeNull();
    fireEvent.click(within(bar).getByRole('button', { name: 'More' }));
    expect(screen.getByText('Ruler')).toBeInTheDocument();
  });
});
