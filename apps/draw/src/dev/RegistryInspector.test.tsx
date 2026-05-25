import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ActionsProvider, SelectionContextProvider } from '@orochi235/weasel';
import { RegistryInspector } from './RegistryInspector';

// jsdom doesn't implement getContext or pointer capture; stub minimally so
// SceneCanvas (mounted by RegistryProbe) can mount and synthesize tools/actions.
{
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    writable: true,
    value: vi.fn(() => ({
      canvas: { width: 0, height: 0 },
      clearRect: vi.fn(), fillRect: vi.fn(), strokeRect: vi.fn(),
      save: vi.fn(), restore: vi.fn(), translate: vi.fn(), setTransform: vi.fn(),
      scale: vi.fn(), setLineDash: vi.fn(), beginPath: vi.fn(), closePath: vi.fn(),
      moveTo: vi.fn(), lineTo: vi.fn(), arc: vi.fn(), stroke: vi.fn(), fill: vi.fn(),
      fillText: vi.fn(), measureText: vi.fn(() => ({ width: 10 })),
      font: '', textBaseline: '', globalAlpha: 1,
      fillStyle: '', strokeStyle: '', lineWidth: 1,
    })),
  });
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
}

function renderInspector() {
  return render(
    <ActionsProvider>
      <SelectionContextProvider>
        <RegistryInspector />
      </SelectionContextProvider>
    </ActionsProvider>,
  );
}

describe('RegistryInspector', () => {
  it('renders the page heading', () => {
    renderInspector();
    expect(screen.getByRole('heading', { name: /bundle inspector/i })).toBeTruthy();
  });

  it('renders all category nodes in the tree', async () => {
    renderInspector();
    await waitFor(() => expect(screen.queryByText('Bundles')).toBeTruthy());
    expect(screen.getByText('Tools')).toBeTruthy();
    expect(screen.getByText('Actions')).toBeTruthy();
    // Shape nests under the Traits group, which is collapsed by default
    // — assert the group's heading instead, and expand it to confirm
    // the child categories surface.
    expect(screen.getByText('Traits')).toBeTruthy();
    fireEvent.click(screen.getByText('Traits'));
    expect(screen.getByText('Shape')).toBeTruthy();
    expect(screen.getByText('Routing')).toBeTruthy();
    expect(screen.getByText('Icons')).toBeTruthy();
  });

  it('bundle dropdown narrows the tools list to bundle members', async () => {
    renderInspector();
    await waitFor(() => expect(screen.queryByText('Bundles')).toBeTruthy());
    fireEvent.click(screen.getByText('Tools'));
    // Tool tree leaves render the presentation label (e.g. 'Rectangle' for
    // rect, 'Hand' for hand), not the bare tool id.
    await waitFor(() => expect(screen.queryByText('Rectangle')).toBeTruthy());

    fireEvent.change(screen.getByLabelText(/bundle/i), { target: { value: 'minimal' } });
    await waitFor(() => expect(screen.queryByText('Rectangle')).toBeNull());
    // 'Select' is the always-present member of the minimal bundle; the hand
    // tool only registers when viewport is initialized, which jsdom may skip.
    expect(screen.getAllByText('Select').length).toBeGreaterThan(0);
  });
});
