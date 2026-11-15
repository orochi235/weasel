import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { SceneCanvas, WeaselProvider, createScene, drawPreset } from '@weasel-js/core';
import { renderWithIcons } from '../../testing/withIcons';
import { ToolPalette } from './ToolPalette';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = vi.fn(() => null);
});
afterEach(cleanup);

describe('ToolPalette with no tools prop', () => {
  it('draws the tools of the canvas beside it under a WeaselProvider, and picks one', () => {
    const scene = createScene({ systemLayers: [{ id: 'main' }] });
    renderWithIcons(
      <WeaselProvider>
        <ToolPalette />
        <SceneCanvas features={[drawPreset]} scene={scene} width={64} height={64} defaultTools={['select', 'rect']} />
      </WeaselProvider>,
    );
    expect(screen.getByRole('button', { name: /^Select/ })).toHaveAttribute('aria-current', 'true');
    const rect = screen.getByRole('button', { name: /^Rect/ });
    act(() => fireEvent.click(rect));
    expect(rect).toHaveAttribute('aria-current', 'true');
  });

  it('draws nothing with no canvas in scope', () => {
    renderWithIcons(<WeaselProvider><ToolPalette /></WeaselProvider>);
    expect(screen.queryByRole('toolbar')).toBeNull();
  });
});
