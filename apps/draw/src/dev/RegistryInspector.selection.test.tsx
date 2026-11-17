import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { RegistrySnapshot } from './registryProbe';
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

describe('RegistryInspector selection', () => {
  it("navigates from a shape kind's op factories to the op kinds they create", async () => {
    window.history.replaceState(null, '', '/#/dev/registry?kind=shapeKind&id=rect');
    renderWithIcons(<RegistryInspector />);
    fireEvent.click(screen.getByRole('button', { name: 'createInsertOp' }));
    await waitFor(() => expect(window.location.hash).toBe('#/dev/registry?kind=opKind&id=insert'));
    expect(screen.getByRole('heading', { level: 2, name: 'insert' })).toBeTruthy();
  });
});
