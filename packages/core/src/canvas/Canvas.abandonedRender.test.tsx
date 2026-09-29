/**
 * What `<Canvas>` keeps for events, frames and its ref handle must be what the
 * last committed render gave it: a render React throws away (`b` here) leaves
 * nothing behind.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { createRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { renderThenAbandon } from '@weasel-js/routing/testing/abandonRender';
import { Canvas } from './Canvas';
import type { CanvasExtensionApi } from './canvasExtension';
import { ViewRegistryProvider, useOptionalViewRegistry, type ViewRegistry } from './viewRegistry';
import { defineTool, useTools } from '../tools/overlayBinding';
import { WeaselProvider } from '../WeaselProvider';
import { makeGLRecorder } from '../renderer/test-utils/glRecorder';

beforeAll(() => {
  const recorder = makeGLRecorder();
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
  };
  proto.getContext = vi.fn((kind: unknown) => (kind === 'webgl2' ? recorder.gl : null));
});

afterEach(() => { cleanup(); });

function boxAt(left: number): HTMLElement {
  const el = document.createElement('div');
  el.getBoundingClientRect = () => ({ left, top: 0, right: left + 100, bottom: 100, width: 100, height: 100, x: left, y: 0, toJSON: () => ({}) });
  document.body.append(el);
  return el;
}

describe('<Canvas> after an abandoned render', () => {
  it('reports the committed input element as the detached surface origin', () => {
    const shared = document.createElement('canvas');
    document.body.append(shared);
    const a = boxAt(10);
    const b = boxAt(99);
    let registry!: ViewRegistry;
    function Grab() {
      registry = useOptionalViewRegistry()!;
      return null;
    }
    renderThenAbandon(a, b, (input) => (
      <ViewRegistryProvider>
        <Grab />
        <Canvas width={100} height={100} layers={{}} paintInto={{ canvas: shared, x: 0, y: 0 }} inputElement={input} />
      </ViewRegistryProvider>
    ));
    expect(registry.surface()!.origin()).toEqual({ left: 10, top: 0 });
    for (const el of [shared, a, b]) el.remove();
  });

  it('hands out the committed debug sink', () => {
    const ref = createRef<CanvasExtensionApi>();
    renderThenAbandon<false | { fps: true }>(false, { fps: true }, (debug) => (
      <Canvas ref={ref} width={100} height={100} layers={{}} debug={debug} />
    ));
    expect(ref.current!.getDebug()).toBeNull();
  });

  it("applies a tool cursor ctx's ops to the committed adapter", () => {
    let applyOps: ((ops: never[], label: string) => void) | undefined;
    function Test({ adapter }: { adapter: { applyOps: () => void } }) {
      const tools = useTools({
        active: 't',
        registry: {
          t: defineTool({
            id: 't',
            cursor: (ctx) => {
              applyOps = ctx.applyOps as typeof applyOps;
              return 'crosshair';
            },
          }),
        },
      });
      return <Canvas width={100} height={100} adapter={adapter as never} layers={{}} tools={tools} />;
    }
    const a = { applyOps: vi.fn() };
    const b = { applyOps: vi.fn() };
    renderThenAbandon(a, b, (adapter) => <WeaselProvider><Test adapter={adapter} /></WeaselProvider>);
    applyOps!([], 'op');
    expect(a.applyOps).toHaveBeenCalledWith([], 'op');
    expect(b.applyOps).not.toHaveBeenCalled();
  });

  it('keeps redrawOn subscribed when a later render repeats the committed sources', () => {
    const source = () => {
      const subscribe = vi.fn(() => () => {});
      return { subscribe };
    };
    const a = source();
    const b = source();
    let bump!: () => void;
    function Sources({ src }: { src: ReturnType<typeof source> }) {
      const [, set] = useState(0);
      bump = () => set((n) => n + 1);
      // A fresh array every render, the way an inline prop arrives.
      return <Canvas width={100} height={100} layers={{}} redrawOn={[src]} />;
    }
    renderThenAbandon(a, b, (src) => <Sources src={src} />);
    expect(a.subscribe).toHaveBeenCalledTimes(1);

    // flushSync: a plain update waits behind the suspended transition.
    act(() => { flushSync(bump); });
    expect(a.subscribe).toHaveBeenCalledTimes(1);
  });
});
