import { describe, expect, it, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import { createRef } from 'react';
import { Canvas } from './testing/BareCanvas';
import { useTools } from '../tools/overlayBinding';
import { WeaselProvider } from '../WeaselProvider';
import type { RenderLayer } from 'core/layers/render';
import type { CanvasExtensionApi } from './canvasExtension';
import { defineTool } from '../tools/overlayBinding';
import type { CanvasDebugSink } from '../debug/types';
import { stubCanvasContext, waitForFrame } from './testing/stubCanvasContext';

beforeAll(stubCanvasContext);

describe('Canvas tools mode', () => {
  // `<Canvas>` no longer routes pointer input: the tool-routing dispatcher it
  // pumped is gone, and `useGestureDispatcher` attaches its own listeners to
  // the same element (mounted by `<SceneCanvas>`). The two tests that lived
  // here — "routes pointer events through tools.dispatcher" and its
  // selection-clear companion — were asserting that plumbing.

  it('applies the active tool cursor to the canvas style', () => {
    function Test() {
      const tools = useTools({
        active: 't',
        registry: { t: defineTool({ id: 't', cursor: 'crosshair' }) },
      });
      return <Canvas width={100} height={100} adapter={{} as never} layers={{}} tools={tools} />;
    }

    const { container } = render(<WeaselProvider><Test /></WeaselProvider>);
    const canvas = container.querySelector('canvas')! as HTMLCanvasElement;
    expect(canvas.style.cursor).toBe('crosshair');
  });

  it('calls a function tool cursor on each render, so one reading its own state follows it', () => {
    const state = { cursor: 'crosshair' };
    function Test() {
      const tools = useTools({
        active: 't',
        registry: { t: defineTool({ id: 't', cursor: () => state.cursor }) },
      });
      return <Canvas width={100} height={100} adapter={{} as never} layers={{}} tools={tools} />;
    }

    const { container, rerender } = render(<WeaselProvider><Test /></WeaselProvider>);
    const canvas = container.querySelector('canvas')! as HTMLCanvasElement;
    expect(canvas.style.cursor).toBe('crosshair');
    state.cursor = 'grab';
    rerender(<WeaselProvider><Test /></WeaselProvider>);
    expect(canvas.style.cursor).toBe('grab');
  });

  it('hands a world-sized tool cursor to the painted layer and hides the native one', () => {
    // The escalation handoff, end to end through `<Canvas>`: a brush radius is
    // a world quantity, so no CSS cursor can express it at every zoom. jsdom
    // draws no cursor either way — what is asserted is the two writes that
    // must happen together, since doing only the first leaves the pointer
    // with nothing at all.
    const apiRef = createRef<CanvasExtensionApi>();
    function Test() {
      const tools = useTools({
        active: 't',
        registry: { t: defineTool({ id: 't', cursor: { glyph: 'brush', worldRadius: 12 } }) },
      });
      return (
        <Canvas
          ref={apiRef}
          width={100}
          height={100}
          adapter={{} as never}
          layers={{}}
          tools={tools}
        />
      );
    }

    const { container } = render(<WeaselProvider><Test /></WeaselProvider>);
    const canvas = container.querySelector('canvas')! as HTMLCanvasElement;
    expect(canvas.style.cursor).toBe('none');

    const painted = apiRef.current!.paintedCursor;
    expect(painted.active()).toBe(true);
    // Nothing to draw until the pointer has a position — the dispatcher's
    // hover pump supplies that; here it is set directly.
    expect(painted.current()).toBeNull();
    painted.setPointer(40, 25);
    expect(painted.current()).toMatchObject({
      cursor: { glyph: 'brush', worldRadius: 12 },
      at: { x: 40, y: 25 },
    });
  });

  describe('tools integration', () => {
    it('stacks the active tool overlay above every slotted layer', async () => {
      const screenLayer = (id: string): RenderLayer<unknown> => ({
        id, label: id, space: 'screen', draw: () => [],
      });
      const toolOverlay = screenLayer('tool-ov');
      const customLayer = screenLayer('custom-tail');
      const afterSel = screenLayer('after-sel');
      const sinkRef: { current: CanvasDebugSink | null } = { current: null };

      function Test() {
        const tools = useTools({
          active: 't',
          registry: { t: defineTool({ id: 't', overlay: toolOverlay }) },
        });
        return (
          <Canvas
            width={50}
            height={50}
            layers={{
              custom: { layer: customLayer },
              afterSel: { layer: afterSel, after: 'selectionOverlay' },
            }}
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
      expect(ids).toEqual(expect.arrayContaining(['custom-tail', 'after-sel', 'tool-ov']));
      expect(ids.indexOf('tool-ov')).toBeGreaterThan(ids.indexOf('custom-tail'));
      expect(ids.indexOf('tool-ov')).toBeGreaterThan(ids.indexOf('after-sel'));
    });

    it('tools.has() returns true for ids in registry and ambient', () => {
      let capturedHas: ((id: string) => boolean) | undefined;

      function Test() {
        const always = defineTool({ id: 'delete' });
        const active = defineTool({ id: 'select' });
        const tools = useTools({
          active: 'select',
          registry: { select: active },
          ambient: [always],
        });
        capturedHas = tools.has.bind(tools);
        return <Canvas width={50} height={50} layers={{}} tools={tools} />;
      }

      render(<WeaselProvider><Test /></WeaselProvider>);
      expect(capturedHas?.('select')).toBe(true);
      expect(capturedHas?.('delete')).toBe(true);
      expect(capturedHas?.('nudge')).toBe(false);
    });
  });
});
