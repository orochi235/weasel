import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { PrefBarLead } from '@weasel-js/prefs';
import { BarLayout, type BarOrientation } from '../Bar';
import { ToolbarDock } from './ToolbarDock';
import type { DockBar, DockSpec, ToolbarLayout } from './layout';

const docks: DockSpec[] = [
  { id: 'top', edge: 'top' },
  { id: 'left', edge: 'left' },
];

function bar(id: string, label: string, lead?: PrefBarLead, vertical?: boolean): DockBar {
  return {
    id,
    label,
    docks: ['top', 'left'],
    vertical,
    render: (orientation: BarOrientation) => (
      <BarLayout
        label={label}
        lead={lead}
        orientation={orientation}
        nodes={[{ kind: 'cell', path: `${id}.go`, content: <button type="button">{`${label} go`}</button> }]}
        cells={() => []}
        row={() => null}
      />
    ),
  };
}

const bars = [bar('file', 'File', 'label'), bar('view', 'View', 'label'), bar('shape', 'Shape', undefined, true)];
const layout: ToolbarLayout = { docks: { top: [['file', 'view'], ['shape']] }, floating: {} };

describe('ToolbarDock', () => {
  it('draws each bar in its row, the workspace in the middle, and no room for an empty dock', () => {
    const { container } = render(
      <ToolbarDock docks={docks} bars={bars} layout={layout}>
        <div data-testid="workspace" />
      </ToolbarDock>,
    );
    const rows = container.querySelectorAll('[data-dock="top"] > [data-dock-row]');
    expect(rows).toHaveLength(2);
    expect(within(rows[0] as HTMLElement).getAllByRole('toolbar').map((t) => t.getAttribute('aria-label'))).toEqual(['File', 'View']);
    expect(within(rows[1] as HTMLElement).getAllByRole('toolbar').map((t) => t.getAttribute('aria-label'))).toEqual(['Shape']);
    expect(container.querySelector('[data-dock-edge="left"]')).toBeNull();
    expect(screen.getByTestId('workspace')).toBeInTheDocument();
    expect(container.firstElementChild).not.toHaveAttribute('role');
  });

  it('draws a left dock’s bars vertical', () => {
    render(<ToolbarDock docks={docks} bars={bars} layout={{ docks: { left: [['shape']] }, floating: {} }} />);
    expect(screen.getByRole('toolbar', { name: 'Shape' })).toHaveAttribute('aria-orientation', 'vertical');
    expect(screen.getByRole('toolbar', { name: 'File' })).toHaveAttribute('aria-orientation', 'horizontal');
  });

  it('draws a bar a layout put in a left dock in its home dock instead, horizontal, when it may not run vertical', () => {
    const { container } = render(<ToolbarDock docks={docks} bars={bars} layout={{ docks: { left: [['file', 'shape']] }, floating: {} }} />);
    expect(container.querySelector('[data-dock="top"] [data-dock-bar="file"]')).not.toBeNull();
    expect(screen.getByRole('toolbar', { name: 'File' })).toHaveAttribute('aria-orientation', 'horizontal');
    expect(container.querySelector('[data-dock="left"] [data-dock-bar="shape"]')).not.toBeNull();
  });

  it('keeps a hidden, unfocusable lead on a bar when the dock is not movable', () => {
    render(<ToolbarDock docks={docks} bars={bars} layout={layout} />);
    const lead = screen.getByRole('toolbar', { name: 'File' }).querySelector(':scope > [data-bar-lead]');
    expect(lead).toHaveAttribute('aria-hidden', 'true');
    expect(lead).not.toHaveAttribute('tabindex');
    expect(screen.queryByRole('button', { name: /^Move / })).toBeNull();
  });

  it('makes a movable bar’s lead a focusable handle named for moving it, grip first', () => {
    render(<ToolbarDock docks={docks} bars={bars} layout={layout} movable />);
    const handle = screen.getByRole('button', { name: 'Move File toolbar' });
    expect(handle.parentElement).toBe(screen.getByRole('toolbar', { name: 'File' }));
    expect(handle).toHaveAttribute('data-bar-lead');
    expect(handle).toHaveAttribute('tabindex', '0');
    expect(handle).not.toHaveAttribute('aria-hidden');
    expect(handle).toHaveAttribute('aria-keyshortcuts', 'Alt+ArrowLeft Alt+ArrowRight Alt+ArrowUp Alt+ArrowDown');
    expect(handle.firstElementChild?.tagName.toLowerCase()).toBe('svg');
    expect(handle).toHaveTextContent(/^File$/);
  });

  it('gives a movable bar with no lead a handle holding only the grip, named the same', () => {
    render(<ToolbarDock docks={docks} bars={bars} layout={layout} movable />);
    const handle = screen.getByRole('button', { name: 'Move Shape toolbar' });
    expect(handle.parentElement).toBe(screen.getByRole('toolbar', { name: 'Shape' }));
    expect(handle).toHaveAttribute('data-bar-lead');
    expect(handle.children).toHaveLength(1);
    expect(handle).toHaveTextContent(/^$/);
  });

  it('draws no handle on a bar outside any dock', () => {
    render(<>{bars[2]!.render('horizontal')}</>);
    expect(screen.getByRole('toolbar', { name: 'Shape' }).querySelector('[data-bar-lead]')).toBeNull();
  });
});
