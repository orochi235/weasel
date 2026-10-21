import { createMemoryAdapter } from '@weasel-js/labkit';
import { type BindingOverrides, useActionsRegistry, type ActionsRegistry } from '@weasel-js/core';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { afterEach, describe, expect, it } from 'vitest';
import type { GestureSpec } from '@weasel-js/core';
import type { IndexEntry } from '../../story/types';
import { installResizeObserver } from '../labHarness';
import { Workshop } from '../Workshop';
import { describeBinding } from './KeysPanel';

installResizeObserver();

const entry: IndexEntry = { id: 'x--a', title: 'X', name: 'A', exportName: 'A', file: '/x.stories.tsx' };

afterEach(() => {
  registry = null;
  history.replaceState(null, '', '/');
});

let registry: ActionsRegistry | null = null;
function GrabRegistry() {
  const here = useActionsRegistry();
  registry ??= here;
  return null;
}
const grab = { id: 'grab-registry', region: 'header', render: () => <GrabRegistry /> } as const;
const rebind = (overrides: BindingOverrides) => act(() => void registry!.overrideBindings(overrides));
const altKey = (key: string) => ({ kind: 'key', key, mods: { alt: true } }) as const;
const live = () => screen.getByRole('group', { name: 'Keys' });
const chipsOf = (_panel: HTMLElement, label: string) => rowOf(live(), label)?.querySelector('.fg-keys__chips')?.textContent;

async function mount() {
  location.hash = '#/x--a';
  const view = renderWithIcons(
    <Workshop index={[entry]} frameUrl="/frame.html" storage={createMemoryAdapter()} config={{ labChrome: [grab] }} />,
  );
  await screen.findByRole('region', { name: /^Trial / });
  return { ...view, body: view.container.querySelector('.lk-lab__body')! };
}

function tap(target: Element, init: KeyboardEventInit) {
  act(() => {
    fireEvent.keyDown(target, init);
    fireEvent.keyUp(target, init);
  });
}

async function openPanel() {
  fireEvent.click(await screen.findByRole('button', { name: 'Keys panel' }));
  return screen.findByRole('group', { name: 'Keys' });
}

const rowOf = (panel: HTMLElement, label: string) =>
  Array.from(panel.querySelectorAll<HTMLElement>('.fg-keys__row')).find(
    (row) => row.querySelector('.fg-keys__label')?.textContent === label,
  )!;

describe('describeBinding', () => {
  it('words a gesture that is not a keystroke', () => {
    const word = (spec: unknown) => describeBinding(spec as GestureSpec);
    expect(word({ kind: 'wheel' })).toBe('Wheel');
    expect(word({ kind: 'hover' })).toBe('Hover');
    expect(word({ kind: 'drag' })).toBe('Drag');
    expect(word({ kind: 'click' })).toBe('Click');
    expect(word({ kind: 'key-held', key: 'Space' })).toMatch(/^Hold /);
  });
});

describe('the keys panel', () => {
  it('lists every lab action with its keys, the loupe’s included, and a pointer-only binding by its gesture', async () => {
    await mount();
    const panel = await openPanel();
    // The form `formatShortcut` draws for a keymap binding, never the bare key.
    await waitFor(() => expect(rowOf(panel, 'Add lens')).toHaveTextContent('Loupe ▸ L'));
    expect(rowOf(panel, 'Add lens').textContent).not.toBe('Add lensL');
    expect(rowOf(panel, 'Follow the pointer')).toHaveTextContent('Hover');
  });

  it('gives no two lab actions the same key', async () => {
    const { body } = await mount();
    tap(body, { code: 'KeyL', key: 'l', altKey: true });
    tap(body, { code: 'KeyL', key: 'l' });
    const panel = await openPanel();
    await waitFor(() => expect(rowOf(panel, 'Add lens')).toBeDefined());
    const keys = Array.from(panel.querySelectorAll('.fg-keys__chip:not(.fg-keys__chip--gesture)'), (c) => c.textContent);
    expect(keys.length).toBeGreaterThan(10);
    expect(keys.filter((k, i) => keys.indexOf(k) !== i)).toEqual([]);
  });

  it('opens on Alt+Slash', async () => {
    const { body } = await mount();
    expect(screen.queryByRole('group', { name: 'Keys' })).toBeNull();
    tap(body, { code: 'Slash', key: '/', altKey: true });
    await screen.findByRole('group', { name: 'Keys' });
    tap(body, { code: 'Slash', key: '/' });
    expect(screen.getByRole('group', { name: 'Keys' })).toBeInTheDocument();
  });

  it('shows a plain action’s rebound key, and nothing for a removed one', async () => {
    await mount();
    const panel = await openPanel();
    expect(chipsOf(panel, 'Toggle the keys panel')).toMatch(/\//);
    rebind({ 'forge.keys.toggle': altKey('k') });
    await waitFor(() => expect(chipsOf(panel, 'Toggle the keys panel')).toMatch(/K/));
    expect(chipsOf(panel, 'Toggle the keys panel')).not.toMatch(/\//);
    rebind({ 'forge.keys.toggle': null });
    await waitFor(() => expect(rowOf(live(), 'Toggle the keys panel')).toBeUndefined());
  });

  it('shows a keymap key’s rebound key behind its leader, and a rebound leader on its own row', async () => {
    await mount();
    const panel = await openPanel();
    await waitFor(() => expect(chipsOf(panel, 'Add lens')).toMatch(/^Loupe ▸ L$/));
    rebind({ 'loupe.add': { kind: 'key', key: 'a' }, 'keymap.loupe.leader': altKey('j') });
    await waitFor(() => expect(chipsOf(panel, 'Add lens')).toMatch(/^Loupe ▸ A$/));
    expect(chipsOf(panel, 'Open Loupe keys')).toMatch(/J/);
    expect(chipsOf(panel, 'Open Loupe keys')).not.toMatch(/L/);
  });
});
