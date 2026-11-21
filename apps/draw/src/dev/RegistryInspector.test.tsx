import { describe, expect, it, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { ActionsProvider, SelectionContextProvider } from '@weasel-js/core';
import { RegistryInspector } from './RegistryInspector';
import { renderWithIcons } from '../testIcons';

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
  return renderWithIcons(
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

  it('names the document and switches to the other dev pages', () => {
    window.history.replaceState(null, '', '/#/dev/registry');
    renderInspector();
    expect(document.title).toBe('Bundle Inspector');
    fireEvent.click(screen.getByRole('button', { name: /bundle inspector/i }));
    const items = screen.getAllByRole('menuitem');
    expect(items.map((i) => [i.textContent, i.getAttribute('href')])).toEqual([
      ['WeaselDraw', '/'],
      ['Toolkit Builder', '#/dev/toolkits'],
      ['Bundle Inspector', '#/dev/registry'],
      ['Assets', '#/dev/assets'],
    ]);
    expect(screen.getByRole('menuitem', { name: 'Bundle Inspector' }))
      .toHaveAttribute('aria-current', 'page');
  });

  it('renders draw\'s static catalog, leaving the live tools and actions to the devtools panel', async () => {
    renderInspector();
    await waitFor(() => expect(screen.queryByText('Bundles')).toBeTruthy());
    expect(screen.getByText('Gestures')).toBeTruthy();
    expect(screen.getByText('Icons')).toBeTruthy();
    expect(screen.queryByText('Tools')).toBeNull();
    expect(screen.queryByText('Actions')).toBeNull();
    // Shape nests under the Traits group, which is collapsed by default.
    fireEvent.click(screen.getByText('Traits'));
    expect(screen.getByText('Shape')).toBeTruthy();
    expect(screen.getByText('Properties')).toBeTruthy();
    expect(screen.queryByText('Routing')).toBeNull();
  });

  it('selects a deep-linked entry once it appears, and drops it when the filter excludes it', async () => {
    window.history.replaceState(null, '', '/#/dev/registry?kind=bundle&id=nudge');
    renderInspector();
    await waitFor(() => expect(screen.getByRole('treeitem', { name: /^Nudge/ })).toHaveAttribute('aria-selected', 'true'));
    expect(window.location.hash).toBe('#/dev/registry?kind=bundle&id=nudge');
    fireEvent.change(screen.getByLabelText('Filter registry'), { target: { value: 'zzz' } });
    await waitFor(() => expect(window.location.hash).toBe('#/dev/registry'));
  });
});
