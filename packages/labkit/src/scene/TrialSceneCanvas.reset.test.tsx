import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { asNodeId, createScene, type PathEditHost, type PathEditOpening } from '@weasel-js/core';
import { drawPreset } from '@weasel-js/editing';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { defineInstrument } from '../instrument/defineInstrument';
import type { RenderContext } from '../instrument/types';
import { Lab } from '../lab/Lab';
import { TrialSceneCanvas } from './TrialSceneCanvas';
import { type SceneTrialState, useTrialScene } from './useTrialScene';

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => null,
  ) as unknown as HTMLCanvasElement['getContext'];
});

type Pose = { x: number; y: number; width: number; height: number };
type State = SceneTrialState<{ kind: 'rect' }, 'main', Pose>;

const BOX = asNodeId('box');

const create = () => {
  const scene = createScene<{ kind: 'rect' }, 'main', Pose>({
    systemLayers: [{ id: 'main' }],
    initial: [
      {
        id: BOX,
        kind: 'mark',
        layer: 'main',
        data: { kind: 'rect' },
        pose: { x: 0, y: 0, width: 10, height: 10 },
      },
    ],
  });
  scene.setSelection([BOX]);
  return scene;
};

/** A host that records the open path and its anchors, so a test reads what the canvas set. */
function recordingHost() {
  let id: string | null = null;
  let anchors: ReadonlySet<number> = new Set();
  const setAnchors = (next: ReadonlySet<number>) => {
    anchors = next;
  };
  const host: PathEditHost = {
    editingId: () => id,
    setEditingId: (next) => {
      id = next;
    },
    selectedAnchors: () => anchors,
    setSelectedAnchors: setAnchors,
  };
  return { host, setAnchors, open: () => id, anchors: () => [...anchors] };
}

let live: ReturnType<typeof create>;

async function mount(host: PathEditHost, opening: PathEditOpening | undefined) {
  function Body({ ctx }: { ctx: RenderContext<State, Record<string, never>> }) {
    const scene = useTrialScene(ctx, create);
    live = scene;
    return (
      <TrialSceneCanvas
        features={[drawPreset]}
        scene={scene}
        trial={ctx.trial}
        pathEdit={host}
        defaultPathEdit={opening}
      />
    );
  }
  const instrument = defineInstrument<State, Record<string, never>>({
    name: 'Scene',
    initialState: () => ({ scene: null }),
    undo: {},
    render: (ctx) => <Body ctx={ctx} />,
  });
  return renderSettled(<Lab instruments={[instrument]} />, { wrapper: withIcons });
}

/** An edit, so the trial has something to Reset, then the Reset. */
async function editAndReset() {
  act(() => {
    live.add({
      kind: 'mark',
      layer: 'main',
      data: { kind: 'rect' },
      pose: { x: 20, y: 0, width: 10, height: 10 },
    });
  });
  await userEvent.click(screen.getByRole('button', { name: 'Reset trial' }));
}

describe('<TrialSceneCanvas> on Reset', () => {
  it('reopens the path it opened on, with its anchors, after the open path closed', async () => {
    const rec = recordingHost();
    await mount(rec.host, { id: BOX, anchors: [1] });
    expect(rec.open()).toBe(BOX);
    act(() => {
      rec.host.setEditingId(null);
      rec.setAnchors(new Set());
    });
    await editAndReset();
    expect(rec.open()).toBe(BOX);
    expect(rec.anchors()).toEqual([1]);
  });

  // A host that opens a path itself, such as a mode machine, owns it past a Reset.
  it('leaves the open path alone when it opened on none', async () => {
    const rec = recordingHost();
    await mount(rec.host, undefined);
    act(() => {
      rec.host.setEditingId(BOX);
      rec.setAnchors(new Set([0, 2]));
    });
    await editAndReset();
    expect(rec.open()).toBe(BOX);
    expect(rec.anchors()).toEqual([0, 2]);
  });
});
