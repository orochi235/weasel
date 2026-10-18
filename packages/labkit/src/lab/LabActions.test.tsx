import { act, fireEvent, screen } from '@testing-library/react';
import {
  ActionsProvider,
  type ActionsRegistry,
  ActiveToolContextProvider,
  DepRegistryProvider,
  InputScope,
  type Tool,
  useActionsRegistry,
  useCommand,
  useGestureDispatcher,
} from '@weasel-js/core';
import { isApplePlatform } from '@weasel-js/gestures';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { useEffect, useRef } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { CameraView } from '../canvas/CameraInput';
import { CameraRegistryContext, createCameraRegistry } from '../canvas/cameraRegistry';
import { defineInstrument } from '../instrument/defineInstrument';
import { LabStoreProvider } from '../state/context';
import { createLabStore } from '../state/store';
import { Lab } from './Lab';
import { LabActions } from './LabActions';
import { type LabCommands, LabCommandsContext } from './LabContext';
import { LabZoom } from './LabZoom';

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => null,
  ) as unknown as HTMLCanvasElement['getContext'];
});

const NO_TOOLS: ReadonlyMap<string, Tool> = new Map();
const MOD = isApplePlatform() ? { metaKey: true } : { ctrlKey: true };
const STAGE = {
  size: { width: 240, height: 160 },
  initialView: { zoom: 1, pan: { x: 0, y: 0 } },
};

function BindsX({ run }: { run: () => void }) {
  const registry = useActionsRegistry() as ActionsRegistry;
  useEffect(
    () =>
      registry.register({
        id: 'story.x',
        label: 'Story x',
        defaultBinding: { kind: 'key', key: 'x' },
        invoker: { timing: 'immediate', run: () => run() },
      }),
    [registry, run],
  );
  return null;
}

/** A canvas in a tree of its own, which holds the keys once pressed. */
function ElsewhereCanvas() {
  return (
    <DepRegistryProvider>
      <ActionsProvider>
        <ActiveToolContextProvider>
          <ElsewhereDispatch />
        </ActiveToolContextProvider>
      </ActionsProvider>
    </DepRegistryProvider>
  );
}

function ElsewhereDispatch() {
  const registry = useActionsRegistry() as ActionsRegistry;
  const ref = useRef<HTMLDivElement>(null);
  useGestureDispatcher({ canvasRef: ref, actions: registry, entriesById: NO_TOOLS });
  return <div ref={ref} data-testid="elsewhere" />;
}

const press = (el: Element | null) =>
  act(async () => {
    if (!el) throw new Error('nothing to press');
    fireEvent.pointerDown(el, { button: 0, pointerId: 1 });
    fireEvent.pointerUp(el, { button: 0, pointerId: 1 });
  });

describe('a lab’s actions registry', () => {
  // Guards against trials ever nesting under the lab registry; it passes today because each trial is its own root.
  it("leaves a key an instrument binds in its trial to that trial's own canvas", async () => {
    const run = vi.fn();
    const binds = defineInstrument<Record<string, never>, Record<string, never>>({
      name: 'Binds',
      defaultConfig: () => ({}),
      initialState: () => ({}),
      render: () => <BindsX run={run} />,
      stage: STAGE,
    });
    const { container } = await renderSettled(
      <>
        <Lab instruments={[binds]} defaultInstrument="Binds" />
        <ElsewhereCanvas />
      </>,
      { wrapper: withIcons },
    );
    // Press the trial, then a canvas in another tree, and send the key to the
    // window: the key reaches neither the trial's scope nor the lab's.
    await press(container.querySelector('.lk-stage'));
    await press(screen.getByTestId('elsewhere'));
    await act(async () => {
      fireEvent.keyDown(window, { key: 'x' });
    });
    expect(run).not.toHaveBeenCalled();
  });

  it('does not run a key bound in an input scope under the lab registry', async () => {
    const run = vi.fn();
    await renderSettled(
      <LabActions>
        <InputScope>
          <BindsX run={run} />
        </InputScope>
      </LabActions>,
      { wrapper: withIcons },
    );
    await act(async () => {
      fireEvent.keyDown(window, { key: 'x' });
    });
    expect(run).not.toHaveBeenCalled();
  });

  it('runs a command a lab registers with useCommand from its children, before any trial is pressed', async () => {
    const run = vi.fn();
    const plain = defineInstrument<Record<string, never>, Record<string, never>>({
      name: 'Plain',
      defaultConfig: () => ({}),
      initialState: () => ({}),
      render: () => null,
    });
    function Cmd() {
      useCommand('lab.test', 'Test', run, { keys: { kind: 'key', key: 'k', mods: { mod: true } } });
      return null;
    }
    await renderSettled(
      <Lab instruments={[plain]} defaultInstrument="Plain">
        <Cmd />
      </Lab>,
      { wrapper: withIcons },
    );
    await act(async () => {
      fireEvent.keyDown(window, { key: 'k', ...MOD });
    });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('zooms with Mod+= from a <LabZoom> mounted outside <Lab>', async () => {
    const store = createLabStore();
    store.getState().addTrial({
      id: 't1',
      instrumentName: 'Any',
      config: {},
      state: {},
      view: { zoom: 1, pan: { x: 0, y: 0 } },
    });
    let current = { x: 0, y: 0, scale: { x: 1, y: 1 } };
    const set = vi.fn((v: typeof current) => {
      current = v;
    });
    const camera = {
      get: () => current,
      set,
      hostSize: () => ({ width: 200, height: 100 }),
      zoomRange: () => ({ min: 0.1, max: 10 }),
      zoomOf: () => current.scale.x,
    } as unknown as CameraView;
    const cameras = createCameraRegistry();
    cameras.register('t1', camera);
    const commands = { focusedTrialId: 't1' } as unknown as LabCommands;
    await renderSettled(
      <LabStoreProvider store={store}>
        <LabCommandsContext.Provider value={commands}>
          <CameraRegistryContext.Provider value={cameras}>
            <LabZoom />
          </CameraRegistryContext.Provider>
        </LabCommandsContext.Provider>
      </LabStoreProvider>,
      { wrapper: withIcons },
    );
    await act(async () => {
      fireEvent.keyDown(window, { key: '=', ...MOD });
    });
    expect(set).toHaveBeenCalled();
    expect(current.scale.x).toBeGreaterThan(1);
  });

  it('one zoom action, lab.zoom, lists in, out and actual size with their shortcuts', async () => {
    const staged = defineInstrument<Record<string, never>, Record<string, never>>({
      name: 'Staged',
      defaultConfig: () => ({}),
      initialState: () => ({}),
      render: () => null,
      stage: STAGE,
    });
    let registry: ActionsRegistry | null = null;
    function Grab() {
      registry = useActionsRegistry();
      return null;
    }
    await renderSettled(
      <Lab instruments={[staged]} defaultInstrument="Staged">
        <Grab />
      </Lab>,
      { wrapper: withIcons },
    );
    const zoom = (registry as ActionsRegistry | null)?.list().find((a) => a.id === 'lab.zoom');
    expect(zoom?.variants?.map((v) => v.key)).toEqual(['in', 'out', 'reset']);
    expect(zoom?.variants?.map((v) => v.label)).toEqual(['Zoom in', 'Zoom out', 'Actual size']);
    const bindings = zoom?.defaultBinding as { spec: { key: string } }[] | undefined;
    const keys = bindings?.map((b) => b.spec.key);
    expect(keys).toEqual(['=', '-', '0']);
  });
});
