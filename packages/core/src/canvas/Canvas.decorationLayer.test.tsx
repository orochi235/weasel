import { describe, it, expect, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import { Canvas } from './testing/BareCanvas';
import { defineTool, useTools } from '../tools/overlayBinding';
import { WeaselProvider } from '../WeaselProvider';
import type { RenderLayer } from 'core/layers/render';
import type { CanvasDebugSink } from '../debug/types';
import { stubCanvasContext, waitForFrame } from './testing/stubCanvasContext';

beforeAll(stubCanvasContext);

describe('Canvas decorationLayer prop', () => {
  it('stacks the decoration layer above the scene and below the tool overlay', async () => {
    const decorationLayer: RenderLayer<unknown> = {
      id: 'mode-decorations', label: 'Mode decorations', space: 'world', draw: () => [],
    };
    const toolOverlay: RenderLayer<unknown> = {
      id: 'tool-ov', label: 'tool overlay', space: 'screen', draw: () => [],
    };
    const sinkRef: { current: CanvasDebugSink | null } = { current: null };

    function Test() {
      const tools = useTools({
        active: 't',
        registry: { t: defineTool({ id: 't', overlay: toolOverlay }) },
      });
      return (
        <Canvas
          width={200}
          height={100}
          layers={{ scene: { layers: [{ key: 'scene', layer: { id: 'scene', label: 'Scene', draw: () => [] } }] } }}
          decorationLayer={decorationLayer}
          tools={tools}
          debug={{ layers: true }}
          debugSinkRef={sinkRef}
        />
      );
    }

    render(<WeaselProvider><Test /></WeaselProvider>);
    await waitForFrame();
    // The recorded stack is a proxy for paint order: jsdom has no WebGL, so no layer draws.
    const ids = sinkRef.current!.snapshot().layers.map((l) => l.id);
    expect(ids).toEqual(expect.arrayContaining(['scene', 'mode-decorations', 'tool-ov']));
    expect(ids.indexOf('mode-decorations')).toBeGreaterThan(ids.indexOf('scene'));
    expect(ids.indexOf('mode-decorations')).toBeLessThan(ids.indexOf('tool-ov'));
  });
});
