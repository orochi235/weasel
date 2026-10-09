import { act, fireEvent, screen, within } from '@testing-library/react';
import {
  ActionsProvider,
  type ActionsRegistry,
  ActiveToolContextProvider,
  DepRegistryProvider,
  type Tool,
  useActionsRegistry,
  useGestureDispatcher,
} from '@weasel-js/core';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { type ReactNode, useEffect } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { defineInstrument } from '../instrument/defineInstrument';
import { Lab } from './Lab';
import { LabContext, type LabContextValue } from './LabContext';

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => null,
  ) as unknown as HTMLCanvasElement['getContext'];
});

const staged = defineInstrument<Record<string, never>, Record<string, never>>({
  name: 'Staged',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => <div data-testid="art" />,
  stage: {
    size: { width: 240, height: 160 },
    initialView: { zoom: 1, pan: { x: 0, y: 0 } },
    maxZoom: 1.5,
  },
});

const plain = defineInstrument<Record<string, never>, Record<string, never>>({
  name: 'Plain',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => <div data-testid="plain" />,
});

let lab: LabContextValue | null = null;
function Capture({ children }: { children?: ReactNode }) {
  return (
    <LabContext.Consumer>
      {(value) => {
        lab = value;
        return children ?? null;
      }}
    </LabContext.Consumer>
  );
}

const zoomBar = () => within(screen.getByRole('toolbar', { name: 'Zoom' }));
const readout = () => zoomBar().getByRole('button', { name: /^Zoom \d+%|^Zoom unavailable/ });
const press = (name: string) =>
  act(async () => {
    fireEvent.click(zoomBar().getByRole('button', { name }));
  });

const MOD = /mac/i.test(navigator.platform || navigator.userAgent)
  ? { metaKey: true }
  : { ctrlKey: true };
async function key(k: string): Promise<boolean> {
  let prevented = false;
  await act(async () => {
    prevented = !fireEvent.keyDown(window, { key: k, ...MOD });
  });
  return prevented;
}

const NO_TOOLS: ReadonlyMap<string, Tool> = new Map();

function Bound({ run }: { run: () => void }) {
  const registry = useActionsRegistry() as ActionsRegistry;
  useEffect(
    () =>
      registry.register({
        id: 'story.zoom',
        label: 'Story zoom',
        defaultBinding: { kind: 'key', key: '=', mods: { mod: true } },
        invoker: { timing: 'immediate', run: () => run() },
      }),
    [registry, run],
  );
  useGestureDispatcher({
    canvasRef: { current: null },
    actions: registry,
    entriesById: NO_TOOLS,
    channels: { contextMenu: false, ingest: false },
  });
  return null;
}

/** A story's own dispatcher, binding Mod+= the way a `<SceneCanvas>` with keyboard zoom does. */
function StoryZoomKey({ run }: { run: () => void }) {
  return (
    <DepRegistryProvider>
      <ActionsProvider>
        <ActiveToolContextProvider>
          <Bound run={run} />
        </ActiveToolContextProvider>
      </ActionsProvider>
    </DepRegistryProvider>
  );
}

function stageZoom(container: HTMLElement, index = 0): number {
  const el = container.querySelectorAll<HTMLElement>('.lk-stage__content')[index];
  if (!el) throw new Error('no stage content');
  return Number(el.style.getPropertyValue('--lk-stage-zoom'));
}

describe("the lab header's zoom controls", () => {
  it('step the focused trial through its camera and read its zoom back', async () => {
    const { container } = await renderSettled(
      <Lab instruments={[staged]} defaultInstrument="Staged" />,
    );
    expect(readout()).toHaveTextContent('100%');
    await press('Zoom in');
    expect(stageZoom(container)).toBeCloseTo(1.25);
    expect(readout()).toHaveTextContent('125%');
    await press('Zoom out');
    expect(stageZoom(container)).toBeCloseTo(1);
    await press('Zoom out');
    expect(readout()).toHaveTextContent('80%');
  });

  it('reset to actual size from the readout', async () => {
    const { container } = await renderSettled(
      <Lab instruments={[staged]} defaultInstrument="Staged" />,
    );
    await press('Zoom out');
    await press('Zoom out');
    await act(async () => {
      fireEvent.click(readout());
    });
    expect(stageZoom(container)).toBe(1);
    expect(readout()).toHaveTextContent('100%');
  });

  it("stop at the camera's own limit, and say so", async () => {
    const { container } = await renderSettled(
      <Lab instruments={[staged]} defaultInstrument="Staged" />,
    );
    await press('Zoom in');
    await press('Zoom in');
    expect(stageZoom(container)).toBe(1.5);
    expect(zoomBar().getByRole('button', { name: 'Zoom in' })).toBeDisabled();
    expect(zoomBar().getByRole('button', { name: 'Zoom out' })).toBeEnabled();
  });

  it('answer Mod+=, Mod+- and Mod+0, claiming the key from the browser', async () => {
    const { container } = await renderSettled(
      <Lab instruments={[staged]} defaultInstrument="Staged" />,
    );
    expect(await key('=')).toBe(true);
    expect(stageZoom(container)).toBeCloseTo(1.25);
    await key('-');
    await key('-');
    expect(stageZoom(container)).toBeCloseTo(0.8);
    await key('0');
    expect(stageZoom(container)).toBe(1);
  });

  it('are gone with the header, and leave their keys to the browser', async () => {
    const { container } = await renderSettled(
      <Lab instruments={[staged]} defaultInstrument="Staged" header={false} />,
    );
    expect(screen.queryByRole('toolbar', { name: 'Zoom' })).toBeNull();
    expect(container.querySelector('header')).toBeNull();
    expect(await key('=')).toBe(false);
    expect(stageZoom(container)).toBe(1);
  });

  it('go inert over a trial with no camera, and leave its keys to the browser', async () => {
    await renderSettled(<Lab instruments={[plain]} defaultInstrument="Plain" />);
    for (const name of ['Zoom out', 'Zoom in']) {
      expect(zoomBar().getByRole('button', { name })).toBeDisabled();
    }
    expect(readout()).toBeDisabled();
    expect(readout()).toHaveTextContent('–');
    expect(await key('=')).toBe(false);
  });

  it("take the key ahead of a story's own binding in a trial with a camera", async () => {
    const story = vi.fn();
    const zooming = defineInstrument<Record<string, never>, Record<string, never>>({
      ...staged,
      name: 'Zooming',
      render: () => <StoryZoomKey run={story} />,
    });
    const { container } = await renderSettled(
      <Lab instruments={[zooming]} defaultInstrument="Zooming" />,
    );
    await key('=');
    expect(stageZoom(container)).toBeCloseTo(1.25);
    expect(story).not.toHaveBeenCalled();
  });

  it("leave the key to a story's own binding in a trial with no camera", async () => {
    const story = vi.fn();
    const zooming = defineInstrument<Record<string, never>, Record<string, never>>({
      ...plain,
      name: 'ZoomingPlain',
      render: () => <StoryZoomKey run={story} />,
    });
    await renderSettled(<Lab instruments={[zooming]} defaultInstrument="ZoomingPlain" />);
    await key('=');
    expect(story).toHaveBeenCalledTimes(1);
  });

  it('follow the focus from trial to trial', async () => {
    const { container } = await renderSettled(
      <Lab instruments={[staged, plain]} defaultInstrument="Staged">
        <Capture />
      </Lab>,
    );
    await act(async () => lab?.addTrial('Staged'));
    await act(async () => lab?.addTrial('Plain'));
    const [first, second, third] = lab?.trials.map((t) => t.id) ?? [];
    expect(zoomBar().getByRole('button', { name: 'Zoom in' })).toBeDisabled();

    await act(async () => lab?.focusTrial(second ?? ''));
    await press('Zoom out');
    expect(stageZoom(container, 1)).toBeCloseTo(0.8);
    expect(stageZoom(container, 0)).toBe(1);
    expect(readout()).toHaveTextContent('80%');

    await act(async () => lab?.focusTrial(first ?? ''));
    expect(readout()).toHaveTextContent('100%');
    await key('=');
    expect(stageZoom(container, 0)).toBeCloseTo(1.25);
    expect(stageZoom(container, 1)).toBeCloseTo(0.8);

    await act(async () => lab?.focusTrial(third ?? ''));
    expect(readout()).toBeDisabled();
  });

  it('are left out when the lab says so', async () => {
    await renderSettled(<Lab instruments={[staged]} defaultInstrument="Staged" zoom={false} />);
    expect(screen.queryByRole('toolbar', { name: 'Zoom' })).toBeNull();
  });
});
