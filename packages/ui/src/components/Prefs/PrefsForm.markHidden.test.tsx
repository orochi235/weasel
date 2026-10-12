import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PrefsForm } from './PrefsForm';

afterEach(cleanup);

type Extra = Record<string, unknown>;
const flag = (name: string, extra: Extra = {}): PrefLeaf =>
  ({ kind: 'boolean', name, description: '', default: false, ...extra }) as PrefLeaf;
const num = (name: string, extra: Extra = {}): PrefLeaf =>
  ({ kind: 'number', name, description: '', default: 0, ...extra }) as PrefLeaf;
const on = { path: 'snap.on' };

const schema: PrefGroup = {
  name: 'Root',
  children: {
    snap: {
      name: 'Snap',
      children: {
        on: flag('Snap on'),
        size: num('Grid size', { showIf: on }),
        lock: num('Lock', { enableIf: on }),
        stroke: {
          kind: 'object', name: 'Stroke', description: '', default: {},
          children: { width: num('Width'), miter: num('Miter', { showIf: on }) },
        } as PrefLeaf,
      },
    },
    grid: { name: 'Grid', showIf: on, children: { fine: flag('Fine'), coarse: flag('Coarse', { showIf: { path: 'grid.fine' } }) } },
  },
};

const at = (container: HTMLElement, path: string): HTMLElement => {
  const el = container.querySelector<HTMLElement>(`[data-pref-path="${path}"]`);
  if (el === null) throw new Error(`nothing drawn at ${path}`);
  return el;
};

describe.each(['columns', 'list', 'rail'] as const)('PrefsForm markHidden in the %s layout', (layout) => {
  const form = (values: unknown, extra: Extra = {}) => (
    <PrefsForm layout={layout} subPages schema={schema} values={values} onChange={() => {}} markHidden {...extra} />
  );

  it('draws a leaf whose showIf fails, marked as hidden and badged, where it is otherwise left out', () => {
    const { container, rerender } = render(<PrefsForm layout={layout} schema={schema} values={{}} onChange={() => {}} />);
    expect(screen.queryByRole('spinbutton', { name: 'Grid size' })).toBeNull();
    rerender(form({}));
    const row = at(container, 'snap.size');
    expect(within(row).getByRole('spinbutton', { name: 'Grid size' })).toBeEnabled();
    expect(row).toHaveAttribute('data-pref-hidden');
    expect(within(row).getByText('hidden')).toBeInTheDocument();
  });

  it('marks nothing that is shown', () => {
    const { container } = render(form({ snap: { on: true }, grid: { fine: true } }));
    expect(container.querySelector('[data-pref-hidden]')).toBeNull();
    expect(screen.queryByText('hidden')).toBeNull();
  });

  it('keeps a hidden leaf a row to pick and to drag, as any other', () => {
    const onSelect = vi.fn();
    const { container } = render(form({}, { onSelect }));
    const row = at(container, 'snap.size');
    expect(row).toHaveAttribute('data-pref-leaf');
    fireEvent.pointerDown(row);
    expect(onSelect).toHaveBeenCalledWith('snap.size', { toggle: false });
  });

  it('keeps drawing a disabled leaf disabled, and does not mark it', () => {
    const { container } = render(form({}));
    expect(screen.getByRole('spinbutton', { name: 'Lock' })).toBeDisabled();
    expect(at(container, 'snap.lock')).not.toHaveAttribute('data-pref-hidden');
  });

  it("marks a hidden field of an object leaf on the field's own row", () => {
    render(form({}));
    const miter = screen.getByRole('spinbutton', { name: 'Miter' });
    const row = miter.closest('[data-property-row]')!;
    expect(row.closest('[data-pref-hidden]')).not.toBeNull();
    expect(within(row as HTMLElement).getByText('hidden')).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Width' }).closest('[data-pref-hidden]')).toBeNull();
  });
});

describe('PrefsForm markHidden on a group', () => {
  it.each(['columns', 'list'] as const)('marks the group once, and not each row in it, in the %s layout', (layout) => {
    const { container } = render(<PrefsForm layout={layout} schema={schema} values={{}} onChange={() => {}} markHidden />);
    const group = at(container, 'grid');
    expect(group).toHaveAttribute('data-pref-hidden');
    expect(within(group).getAllByText('hidden')).toHaveLength(1);
    expect(at(container, 'grid.fine')).not.toHaveAttribute('data-pref-hidden');
    expect(at(container, 'grid.coarse')).not.toHaveAttribute('data-pref-hidden');
    expect(within(group).getByRole('checkbox', { name: 'Fine' })).toBeInTheDocument();
  });

  it('marks a hidden page in a rail, heading and rows together', () => {
    const { container } = render(<PrefsForm layout="rail" section="grid" schema={schema} values={{}} onChange={() => {}} markHidden />);
    const pane = container.querySelector<HTMLElement>('[data-pref-into="grid"]')!;
    expect(pane).toHaveAttribute('data-pref-hidden');
    expect(within(pane).getAllByText('hidden')).toHaveLength(1);
    expect(pane.querySelectorAll('[data-pref-hidden]')).toHaveLength(0);
    expect(within(pane).getByRole('checkbox', { name: 'Fine' })).toBeInTheDocument();
  });

  it('marks a row hidden on its own inside a group that is shown', () => {
    const { container } = render(<PrefsForm layout="list" schema={schema} values={{ snap: { on: true } }} onChange={() => {}} markHidden />);
    expect(at(container, 'grid')).not.toHaveAttribute('data-pref-hidden');
    expect(at(container, 'grid.coarse')).toHaveAttribute('data-pref-hidden');
  });
});
