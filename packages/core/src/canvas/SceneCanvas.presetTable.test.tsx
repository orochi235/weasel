/**
 * A `<SceneCanvas>` running one preset installs what that preset's
 * `FEATURE_PRESETS` row and the rows it includes say, and nothing from another row.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { useEffect } from 'react';
import { act } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { useActionsRegistry, useDepRegistry } from '@weasel-js/routing/react';
import { createScene } from 'core/scene/scene';
import type { NodeId } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import { KIT_STANDARD_ACTION_IDS } from 'interactions/actions/useStandardActions';
import type { ToolsApi } from '../tools/overlayBinding';
import { SceneCanvas } from './SceneCanvas';
import { presetToolIds, resolveFeatures, type Feature } from './SceneCanvas/features';
import { BASELINE_ACTION_IDS, CORE_NAMED_PRESETS, FEATURE_PRESETS } from './SceneCanvas/namedPresets';
import type { CanvasHelpers } from './useViewHelpers';

type P = { x: number; y: number; width: number; height: number; rotation: number };

const mounted: { ambient: string[] } = { ambient: [] };

// The preset entries reach the dispatcher as the dispatcher hook's `contributions`
// input and are visible nowhere else.
vi.mock('./SceneCanvas/useSceneGestureDispatcher', async (importOriginal) => {
  const real = await importOriginal<typeof import('./SceneCanvas/useSceneGestureDispatcher')>();
  return {
    ...real,
    useSceneGestureDispatcher: (props: Parameters<typeof real.useSceneGestureDispatcher>[0]) => {
      mounted.ambient = props.contributions.map((c) => c.id);
      real.useSceneGestureDispatcher(props);
    },
  };
});

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
  };
  proto.getContext = vi.fn(() => null);
});

interface Seen { actionIds: string[]; selection: SelectionApi | null }

function Probe({ into }: { into: Seen }) {
  const reg = useActionsRegistry();
  const deps = useDepRegistry();
  useEffect(() => {
    into.actionIds = reg ? reg.list().map((a) => a.id) : [];
    into.selection = (deps.get('selection') as SelectionApi | undefined) ?? null;
  });
  return null;
}

function mountWith(preset: Feature) {
  const scene = createScene<{ kind: 'rect' }, 'main', P>({ systemLayers: [{ id: 'main' }] });
  let id!: NodeId;
  scene.batch('seed', () => {
    id = scene.add({
      kind: 'mark', data: { kind: 'rect' }, layer: 'main',
      pose: { x: 0, y: 0, width: 50, height: 50, rotation: 0 },
    });
  });
  const seen: Seen = { actionIds: [], selection: null };
  const helpersRef: { current: CanvasHelpers<P> | null } = { current: null };
  let tools: ToolsApi | null = null;
  mounted.ambient = [];
  const result = render(
    <SceneCanvas
      scene={scene} width={200} height={200} features={[preset]}
      helpersRef={helpersRef} onToolsCreated={(t) => { tools = t; }}
    >
      <Probe into={seen} />
    </SceneCanvas>,
  );
  act(() => seen.selection!.set([id]));
  return {
    tools: Object.keys(tools!.registry),
    toolBound: Object.values(tools!.registry).flatMap((t) => (t.bindings ?? []).map((b) => b.actionId)),
    actions: seen.actionIds.filter((a) => KIT_STANDARD_ACTION_IDS.includes(a) && !BASELINE_ACTION_IDS.includes(a)).sort(),
    ambient: [...mounted.ambient],
    isVisible: helpersRef.current!.getIsVisible(),
    unmount: result.unmount,
  };
}

const PRESET_IDS = Object.keys(FEATURE_PRESETS) as Feature[];
const OWNED_CHROME = PRESET_IDS.flatMap((id) => FEATURE_PRESETS[id].chrome ?? []);

describe('<SceneCanvas features={[preset]}>', () => {
  it.each(PRESET_IDS)("'%s' installs its rows: tools, actions, ambient entries, and chrome", (preset) => {
    const rows = resolveFeatures([preset], CORE_NAMED_PRESETS).presets;
    const chrome = rows.flatMap((row) => row.chrome ?? []);
    const got = mountWith(preset);
    expect([...got.tools].sort()).toEqual(rows.flatMap(presetToolIds).sort());
    // `ingest` answers the paste event alone, so `clipboard.pasteEvent` is held back beside it.
    const own = rows.flatMap((row) => (row.actions ?? []).map((a) => a.id))
      .filter((a) => a !== 'clipboard.pasteEvent' || !rows.some((row) => row.id === 'ingest'));
    // A tool registers the actions it binds, whichever row they belong to.
    expect(got.actions).toEqual([...new Set([...own, ...got.toolBound.filter((a) => KIT_STANDARD_ACTION_IDS.includes(a))])].sort());
    expect([...got.ambient].sort()).toEqual(rows.flatMap((row) => (row.ambient ? [row.ambient({}).id] : [])).sort());
    for (const id of OWNED_CHROME) expect(got.isVisible(id), id).toBe(chrome.includes(id));
    got.unmount();
  });
});
