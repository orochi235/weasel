import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import type { RegistrySnapshot } from './registryProbe';
import type { ActionEntry, ToolEntry } from './registryEntries';
import { icon } from '../icons.gen';
import { renderWithIcons } from '../testIcons';

// The probe is replaced so each test decides when its snapshot lands.
const probe = vi.hoisted(() => ({ push: null as ((snap: RegistrySnapshot) => void) | null }));
vi.mock('./registryProbe', () => ({
  RegistryProbe: ({ onSnapshot }: { onSnapshot: (snap: RegistrySnapshot) => void }) => {
    probe.push = onSnapshot;
    return null;
  },
}));

const { RegistryInspector } = await import('./RegistryInspector');

const rectTool: ToolEntry = {
  kind: 'tool', id: 'rect', label: 'rect', hookName: 'useRectTool', routes: [], declaredRoutes: [], slot: 'registry',
  surface: { gestures: {}, outputs: {} },
} as unknown as ToolEntry;

const undoAction: ActionEntry = {
  kind: 'action', id: 'undo', label: 'Undo', items: [{ key: 'undo', label: 'Undo', icon: icon('core:undo') }],
};

const snapshot = (over: Partial<RegistrySnapshot>): RegistrySnapshot => ({ tools: [], actions: [], properties: [], ...over });

describe('RegistryInspector selection', () => {
  it("shows the selected entry as the probe's snapshot rebuilds it", () => {
    window.history.replaceState(null, '', '/#/dev/registry?kind=shapeKind&id=rect');
    renderWithIcons(<RegistryInspector />);
    expect(screen.getByRole('heading', { level: 2, name: 'rect' })).toBeTruthy();
    act(() => probe.push!(snapshot({ tools: [rectTool] })));
    expect(screen.getByText('useRectTool')).toBeTruthy();
  });

  it("drops a deep link still waiting for its entry once the user picks another", async () => {
    window.history.replaceState(null, '', '/#/dev/registry?kind=icon&id=core:undo');
    renderWithIcons(<RegistryInspector />);
    fireEvent.change(screen.getByLabelText('Filter registry'), { target: { value: 'nudge' } });
    fireEvent.click((await screen.findByRole('treeitem', { name: /^Nudge/ })).firstElementChild as HTMLElement);
    fireEvent.change(screen.getByLabelText('Filter registry'), { target: { value: '' } });
    expect(window.location.hash).toBe('#/dev/registry?kind=bundle&id=nudge');
    act(() => probe.push!(snapshot({ actions: [undoAction] })));
    expect(window.location.hash).toBe('#/dev/registry?kind=bundle&id=nudge');
  });

  it("navigates from a shape kind's op factories to the op kinds they create", async () => {
    window.history.replaceState(null, '', '/#/dev/registry?kind=shapeKind&id=rect');
    renderWithIcons(<RegistryInspector />);
    fireEvent.click(screen.getByRole('button', { name: 'createInsertOp' }));
    await waitFor(() => expect(window.location.hash).toBe('#/dev/registry?kind=opKind&id=insert'));
    expect(screen.getByRole('heading', { level: 2, name: 'insert' })).toBeTruthy();
  });
});
