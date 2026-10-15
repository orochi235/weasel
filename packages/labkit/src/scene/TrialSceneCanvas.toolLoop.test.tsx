/** The trial's tool slot and the canvas's active tool settle, whatever each side is handed. */
import { act, screen } from '@testing-library/react';
import { createScene, type ToolsApi, useLatest, useShapeBuilderTool } from '@weasel-js/core';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { RectIcon, SelectIcon } from '@weasel-js/ui';
import { StrictMode, useEffect } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { defineInstrument } from '../instrument/defineInstrument';
import type { RenderContext } from '../instrument/types';
import { Lab } from '../lab/Lab';
import { TrialSceneCanvas } from './TrialSceneCanvas';
import { type SceneTrialState, useTrialScene } from './useTrialScene';

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as HTMLCanvasElement['getContext'];
});

type Pose = { x: number; y: number; width: number; height: number };
type State = SceneTrialState<unknown, 'main', Pose>;
const create = () => createScene<unknown, 'main', Pose>({ systemLayers: [{ id: 'main' }] });

let live: { tools: ToolsApi | null; renders: number };

/** `pick` is written to the slot once as the trial mounts, or — with `everyRender` —
 *  from an effect that runs on every render, as one keyed on `setActiveTool` does. */
function Body({ ctx, pick, everyRender }: { ctx: RenderContext<State, Record<string, never>>; pick: string; everyRender: boolean }) {
  const scene = useTrialScene(ctx, create);
  live.renders++;
  const shapeBuilder = useShapeBuilderTool();
  const latest = useLatest(ctx.trial.setActiveTool);
  const { setActiveTool } = ctx.trial;
  useEffect(() => { latest.current(pick); }, [latest, pick]);
  useEffect(() => { if (everyRender) setActiveTool(pick); }, [everyRender, setActiveTool, pick]);
  return (
    <TrialSceneCanvas
      features={['draw']}
      defaultTools={[]}
      tools={{ shapeBuilder }}
      scene={scene}
      trial={ctx.trial}
      onToolsCreated={(tools) => { live.tools = tools; }}
    />
  );
}

const instrument = (pick: string, everyRender = false) => defineInstrument<State, Record<string, never>>({
  name: 'Scene',
  defaultConfig: () => ({}),
  initialState: () => ({ scene: null }),
  tools: {
    tools: [
      { id: 'select', label: 'Select', icon: SelectIcon },
      { id: 'shapeBuilder', label: 'Shape Builder', icon: RectIcon },
    ],
  },
  render: (ctx) => <Body ctx={ctx} pick={pick} everyRender={everyRender} />,
});

async function mount(pick: string, everyRender = false) {
  live = { tools: null, renders: 0 };
  await renderSettled(
    <StrictMode>
      <Lab instruments={[instrument(pick, everyRender)]} defaultInstrument="Scene" />
    </StrictMode>,
  );
  const settled = live.renders;
  await act(async () => {});
  expect(live.renders).toBe(settled);
}

describe('<TrialSceneCanvas> tool slot', () => {
  it('settles on a tool the instrument picks while the canvas is still reporting its first', async () => {
    await mount('shapeBuilder');
    expect(live.tools?.active).toBe('shapeBuilder');
    expect(screen.getByRole('button', { name: 'Shape Builder' })).toHaveAttribute('aria-current', 'true');
  });

  it('settles when the slot is handed the tool it already holds on every render', async () => {
    await mount('shapeBuilder', true);
    expect(live.tools?.active).toBe('shapeBuilder');
  });

  it('settles when the slot names a tool the canvas has not registered', async () => {
    await mount('nowhere');
    expect(live.tools?.active).toBe('select');
  });
});
