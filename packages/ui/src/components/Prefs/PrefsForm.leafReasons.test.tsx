import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, renderHook, screen } from '@testing-library/react';
import { asNodeId, createScene, IDENTITY_POSE_COMPOSITION, type NodePropertiesEntry, type NodeRoutingEntry, type SelectionApi } from '@weasel-js/core';
import type { PrefAction, PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { PrefsForm } from './PrefsForm';
import { useLeafAction } from './useLeafAction';
import { PrefsBar } from '../PrefsBar/PrefsBar';
import { SelectionPanel } from '../SelectionPanel/SelectionPanel';
import { renderWithIcons } from '../../testing/withIcons';

afterEach(cleanup);

const noop = (): void => {};
const flag = (name: string): PrefLeaf => ({ kind: 'boolean', name, description: '', default: false }) as PrefLeaf;
const clear: PrefAction = {
  kind: 'action', name: 'Clear all', description: '', default: undefined, run: noop,
  grade: 'danger', shortcut: '⌘⌫', activeIf: { path: 'armed' },
};
const schema = (leaf: PrefLeaf = clear as PrefLeaf): PrefGroup => ({ name: '', children: { armed: flag('Armed'), clear: leaf } });

/** The tooltip `el` opens when the pointer comes to rest on it. */
function tooltipOf(el: Element): string | null {
  vi.useFakeTimers();
  try {
    fireEvent.pointerMove(document.body, { pointerType: 'mouse' });
    fireEvent.pointerEnter(el, { pointerType: 'mouse' });
    act(() => vi.runAllTimers());
    return screen.queryByRole('tooltip')?.textContent ?? null;
  } finally {
    vi.useRealTimers();
  }
}

describe('a run-only action leaf', () => {
  it('is drawn in its grade, and latches while its activeIf holds', () => {
    const { rerender } = renderWithIcons(<PrefsForm schema={schema()} values={{ armed: false }} onChange={noop} />);
    const button = screen.getByRole('button', { name: 'Clear all' });
    expect(button).toHaveAttribute('data-grade', 'danger');
    expect(button).toHaveAttribute('aria-pressed', 'false');
    rerender(<PrefsForm schema={schema()} values={{ armed: true }} onChange={noop} />);
    expect(screen.getByRole('button', { name: 'Clear all' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('has no pressed state without an activeIf', () => {
    const { activeIf: _, ...plain } = clear;
    renderWithIcons(<PrefsForm schema={schema(plain as PrefLeaf)} values={{ armed: true }} onChange={noop} />);
    expect(screen.getByRole('button', { name: 'Clear all' })).not.toHaveAttribute('aria-pressed');
  });

  it('shows its shortcut, and its latch as the surface judged it', () => {
    const { result } = renderHook(() => useLeafAction(clear, 'clear', false, true));
    expect([result.current.shortcut, result.current.active, result.current.grade]).toEqual(['⌘⌫', true, 'danger']);
  });

  it('latches in a bar, and over a selection where it holds for every node', () => {
    renderWithIcons(<PrefsBar schema={{ ...schema(), as: 'bar' }} values={{ armed: true }} />);
    expect(screen.getByRole('button', { name: 'Clear all' })).toHaveAttribute('aria-pressed', 'true');
    cleanup();

    const routing: NodeRoutingEntry[] = [{ name: 'thing', matches: () => true }];
    const scene = createScene<unknown, 'default', Record<string, number>>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'default' }] });
    for (const [id, armed] of [['a', 1], ['b', 0]] as const) scene.add({ id: asNodeId(id), kind: 'mark', layer: 'default', pose: { armed }, data: {} });
    const members = { 'pose.armed': { kind: 'number', name: 'Armed', description: '', default: 0 } as PrefLeaf, go: { ...clear, activeIf: { path: 'pose.armed' } } as PrefLeaf };
    const properties: NodePropertiesEntry[] = [{ name: 'thing', schema: { name: 'P', members } }];
    const panel = (ids: string[]) => <SelectionPanel scene={scene} selection={{ current: ids } as unknown as SelectionApi} properties={properties} routing={routing} />;
    const { rerender } = renderWithIcons(panel(['a']));
    expect(screen.getByRole('button', { name: 'Clear all' })).toHaveAttribute('aria-pressed', 'true');
    rerender(panel(['a', 'b']));
    expect(screen.getByRole('button', { name: 'Clear all' })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('disabledReason', () => {
  it("says why an action leaf's enableIf fails, on its button", () => {
    renderWithIcons(<PrefsForm schema={schema({ ...clear, enableIf: { path: 'armed' }, disabledReason: 'Arm it first' } as PrefLeaf)} values={{ armed: false }} onChange={noop} />);
    const button = screen.getByRole('button', { name: 'Clear all' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAttribute('aria-description', 'Arm it first');
  });

  it("says why a row is disabled, in its help, and only while it is", () => {
    const size = { kind: 'number', name: 'Size', description: 'How big.', default: 0, enableIf: { path: 'armed' }, disabledReason: 'Arm it first' } as PrefLeaf;
    const s: PrefGroup = { name: '', children: { armed: flag('Armed'), size } };
    const { rerender } = renderWithIcons(<PrefsForm schema={s} values={{ armed: false }} onChange={noop} />);
    expect(screen.getByRole('spinbutton', { name: 'Size' })).toHaveAccessibleDescription('How big. Arm it first');
    rerender(<PrefsForm schema={s} values={{ armed: true }} onChange={noop} />);
    expect(screen.getByRole('spinbutton', { name: 'Size' })).toHaveAccessibleDescription('How big.');
  });

  it('says why an enum option is disabled, and gives an option its description as a tooltip', () => {
    const mode = {
      kind: 'enum', name: 'Mode', description: '', default: 'a', control: 'toggle',
      options: [
        { value: 'a', label: 'Auto', description: 'Picks for you' },
        { value: 'b', label: 'Bezier', disabled: true, disabledReason: 'Needs a path' },
      ],
    } as PrefLeaf;
    renderWithIcons(<PrefsForm schema={{ name: '', children: { mode } }} values={{}} onChange={noop} />);
    expect(screen.getByRole('radio', { name: 'Bezier' })).toHaveAttribute('aria-description', 'Needs a path');
    expect(tooltipOf(screen.getByRole('radio', { name: 'Auto' }))).toBe('Picks for you');
  });
});
