/**
 * A preset object turns on everything it carries, on either canvas, and the
 * lean canvas resolves no names.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { useEffect } from 'react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import type { Action } from '@weasel-js/routing';
import { useActionsRegistry, useDepRegistry } from '@weasel-js/routing/react';
import { IDENTITY_POSE_COMPOSITION } from 'core/scene/composeFrame';
import { createScene } from 'core/scene/scene';
import type { ToolsApi } from '../tools/overlayBinding';
import { LeanSceneCanvas } from './LeanSceneCanvas';
import { SceneCanvas } from './SceneCanvas';
import type { FeaturePreset } from './SceneCanvas/features';
import { BASELINE_ACTIONS } from './SceneCanvas/presets/baseline';
import { selectPreset } from './SceneCanvas/presets/select';
import { KIT_STANDARD_ACTION_IDS } from 'interactions/actions/useStandardActions';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown };
  proto.getContext = vi.fn(() => null);
});

const go: Action = { id: 'mine.go', label: 'Go', invoker: { timing: 'immediate', run: () => {} } } as Action;
const own = { id: 'mine.tool', eligibility: { focus: true }, bindings: [] } as never;
const mine: FeaturePreset = {
  id: 'mine',
  actions: [go],
  tools: [own],
  contributions: [{ id: 'mine.deps', eligibility: { always: true }, deps: { mineValue: () => 42 } as never }],
  pathEdit: [{ id: 'mine.marks', marks: () => [] }],
};

interface Seen { actionIds: string[]; dep: unknown; extensions?: readonly { id: string }[] }

function Probe({ into }: { into: Seen }) {
  const reg = useActionsRegistry();
  const deps = useDepRegistry();
  useEffect(() => {
    into.actionIds = reg ? reg.list().map((a) => a.id) : [];
    into.dep = deps.get('mineValue' as never);
    into.extensions = (deps.get('editAnchors' as never) as { extensions?: readonly { id: string }[] } | undefined)?.extensions;
  });
  return null;
}

const scene = () => createScene<unknown, 'main', unknown>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'main' }] });

describe('a preset object', () => {
  it("registers its actions and tools, installs its contributions' deps, and hands path edit its extensions", () => {
    const seen: Seen = { actionIds: [], dep: undefined };
    let tools: ToolsApi | null = null;
    render(
      <SceneCanvas scene={scene()} width={100} height={100} features={['pick', mine]} onToolsCreated={(t) => { tools = t; }}>
        <Probe into={seen} />
      </SceneCanvas>,
    );
    expect(seen.actionIds).toContain('mine.go');
    expect(seen.actionIds).toContain('areaSelect');
    expect(Object.keys(tools!.registry)).toEqual(['select', 'mine.tool']);
    expect(seen.dep).toBe(42);
    expect(seen.extensions?.map((e) => e.id)).toEqual(['mine.marks']);
  });
});

describe('<LeanSceneCanvas>', () => {
  it('registers undo, redo, and what its presets carry, and nothing a name would have', () => {
    const seen: Seen = { actionIds: [], dep: undefined };
    render(
      <LeanSceneCanvas scene={scene()} width={100} height={100} features={[selectPreset, mine]}>
        <Probe into={seen} />
      </LeanSceneCanvas>,
    );
    const expected = [...BASELINE_ACTIONS, ...(selectPreset.actions ?? []), go].map((a) => a.id).sort();
    const kitOrMine = (id: string) => KIT_STANDARD_ACTION_IDS.includes(id) || id === 'mine.go';
    expect(seen.actionIds.filter(kitOrMine).sort()).toEqual(expected);
  });

  it('throws on a name', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(
      <LeanSceneCanvas scene={scene()} width={100} height={100} features={['draw' as never]} />,
    )).toThrow(/resolves no preset names/);
  });
});
