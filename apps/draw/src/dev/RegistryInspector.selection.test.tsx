import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import type { RegistrySnapshot } from './registryProbe';
import type { ToolEntry } from './registryEntries';
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

const snapshot = (over: Partial<RegistrySnapshot>): RegistrySnapshot => ({ tools: [], actions: [], properties: [], ...over });

describe('RegistryInspector selection', () => {
  it("shows the selected entry as the probe's snapshot rebuilds it", () => {
    window.history.replaceState(null, '', '/#/dev/registry?kind=shapeKind&id=rect');
    renderWithIcons(<RegistryInspector />);
    expect(screen.getByRole('heading', { level: 2, name: 'rect' })).toBeTruthy();
    act(() => probe.push!(snapshot({ tools: [rectTool] })));
    expect(screen.getByText('useRectTool')).toBeTruthy();
  });

  it("navigates from a shape kind's op factories to the op kinds they create", async () => {
    window.history.replaceState(null, '', '/#/dev/registry?kind=shapeKind&id=rect');
    renderWithIcons(<RegistryInspector />);
    fireEvent.click(screen.getByRole('button', { name: 'createInsertOp' }));
    await waitFor(() => expect(window.location.hash).toBe('#/dev/registry?kind=opKind&id=insert'));
    expect(screen.getByRole('heading', { level: 2, name: 'insert' })).toBeTruthy();
  });
});
