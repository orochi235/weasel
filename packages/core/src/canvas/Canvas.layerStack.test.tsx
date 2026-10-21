/**
 * The order `<Canvas>` composes its layer stack in, read off the debug sink's
 * record of a painted frame: ids, bottom first.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, act } from '@testing-library/react';
import { Canvas, type BareCanvasProps as CanvasProps } from './testing/BareCanvas';
import type { CanvasDebugSink } from '../debug/types';
import type { RenderLayer } from 'core/layers/render';
import type { ToolsApi } from '../tools/overlayBinding';
import { makeGLRecorder } from '@weasel-js/renderer/testing/glRecorder';
import type { ReactNode } from 'react';
import { ViewRegistryProvider } from './viewRegistry';
import { ViewMarker } from './ViewMarker';
import { CanvasView } from './CanvasView';

beforeAll(() => {
  const recorder = makeGLRecorder();
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown };
  proto.getContext = vi.fn((kind: unknown) => (kind === 'webgl2' ? recorder.gl : null));
});

const waitForFrame = () => new Promise<void>(r => requestAnimationFrame(() => r()));

const layer = (id: string): RenderLayer<unknown> => ({ id, label: id, draw: () => [] });

const tools = {
  active: null,
  hotkeyEngaged: null,
  registry: {},
  ambient: [],
  getActiveOverlays: (position: string) => [layer(`tool:${position}`)],
} as unknown as ToolsApi;

async function stackOf(props: Partial<CanvasProps>, around?: (canvas: ReactNode) => ReactNode): Promise<string[]> {
  const sinkRef = { current: null as CanvasDebugSink | null };
  const canvas = <Canvas width={100} height={100} layers={{}} {...props} debug={{ layers: true }} debugSinkRef={sinkRef} />;
  render(<>{around ? around(canvas) : canvas}</>);
  await act(waitForFrame);
  await act(waitForFrame);
  return sinkRef.current!.snapshot().layers.map((l) => l.id);
}

describe('<Canvas> layer stack', () => {
  it('puts the background fill beneath everything, the grid included', async () => {
    expect(await stackOf({
      backgroundFill: { kind: 'solid', color: '#fff' },
      layers: {
        grid: { layer: layer('grid') },
        under: { layer: layer('under'), before: 'grid' },
        selectionOverlay: { layer: layer('selection-overlay') },
      },
    })).toEqual(['scene-background-fill', 'under', 'grid', 'selection-overlay', 'painted-cursor']);
  });

  it('puts the decoration layer above every slot and custom layer, and above anchored tool overlays only when there is no selection chrome', async () => {
    const layers = {
      grid: { layer: layer('grid') },
      selectionOverlay: { layer: layer('selection-overlay') },
      loose: { layer: layer('loose') },
      above: { layer: layer('above'), after: 'selectionOverlay' },
    };
    expect(await stackOf({ decorationLayer: layer('decoration'), tools, layers })).toEqual([
      'grid', 'tool:before-selection', 'selection-overlay', 'tool:after-selection', 'above', 'loose',
      'decoration', 'tool:top', 'painted-cursor',
    ]);
    expect(await stackOf({
      decorationLayer: layer('decoration'), tools, layers: { ...layers, selectionOverlay: null },
    })).toEqual([
      'grid', 'above', 'loose', 'decoration',
      'tool:before-selection', 'tool:after-selection', 'tool:top', 'painted-cursor',
    ]);
  });

  it('paints root markers above the slot layers and beneath the views', async () => {
    expect(await stackOf({ layers: { grid: { layer: layer('grid') } } }, (canvas) => (
      <ViewRegistryProvider>
        {canvas}
        <ViewMarker id="m" source="pip" target={null} />
        <CanvasView id="pip" bounds={{ x: 50, y: 50, w: 40, h: 30 }} defaultView={{ x: 0, y: 0, scale: { x: 0.25, y: 0.25 } }} />
      </ViewRegistryProvider>
    ))).toEqual(['grid', 'view-marker:m', 'pip', 'painted-cursor']);
  });
});
