import {
  type ActionTunings,
  asNodeId,
  boundsOfPath,
  createScene,
  pathFromD,
  type PathEditHost,
  type PolygonPath,
  type RectPose,
  solid,
  useActionsRegistry,
  withCorner,
} from '@weasel-js/core';
import {
  type ConfigOf,
  defineInstrument,
  f,
  Lab,
  type RenderContext,
  type SceneTrialState,
  TrialSceneCanvas,
  useTrialScene,
} from '@weasel-js/labkit';
import { PenIcon, SelectIcon } from '@weasel-js/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';

const config = f.schema({
  style: f.enum('round', ['round', 'chamfer', 'inverted']).radio().label('Style of selected corners'),
  radius: f.number(16).range(0, 80).step(1).suffix('px').label('Radius of selected corners'),
});
type Config = ConfigOf<typeof config>;
type State = SceneTrialState<unknown, 'default', RectPose>;

/** The path open for anchor editing as the lab starts. */
const FIRST = 'tile';

function pathNode(id: string, path: PolygonPath, color: string, vertexColors?: number[]) {
  const { x, y, width, height } = boundsOfPath(path);
  return {
    kind: 'leaf' as const,
    id: asNodeId(id),
    layer: 'default' as const,
    pose: { x, y, width, height },
    data: { path, fill: { paint: solid(color) }, ...(vertexColors ? { vertexColors } : {}) },
  };
}

const tile = [
  [1, { style: 'round', radius: 24 }],
  [3, { style: 'chamfer', radius: 18 }],
  [4, { style: 'inverted', radius: 20 }],
] as const;

const createLabScene = () =>
  createScene<unknown, 'default', RectPose>({
    systemLayers: [{ id: 'default' }],
    initial: [
      pathNode(FIRST, tile.reduce<PolygonPath>(
        (p, [i, spec]) => withCorner(p, i, spec),
        pathFromD('M60 60 L220 60 L220 140 L160 200 L60 200 Z'),
      ), '#7fb069'),
      pathNode('petal', withCorner(
        pathFromD('M280 60 C340 40 400 80 420 120 L400 220 C340 230 300 200 280 160 Z'),
        1, { style: 'round', radius: 20 },
      ), '#d4a574'),
      pathNode('prism', withCorner(
        pathFromD('M120 260 L260 260 L190 380 Z'),
        2, { style: 'round', radius: 30 },
      ), '#ffffff', [1, 0.3, 0.3, 1, 0.3, 0.6, 1, 1, 0.4, 0.9, 0.4, 1]),
    ],
  });

/** Which path is open for anchor editing, kept beside the trial so the lab
 *  opens on one; double-clicking another switches. */
function useEditHost(): { host: PathEditHost; changed: { subscribe(l: () => void): () => void } } {
  return useState(() => {
    let id: string | null = FIRST;
    const listeners = new Set<() => void>();
    return {
      host: {
        editingId: () => id,
        setEditingId: (next: string | null) => { id = next; listeners.forEach((l) => l()); },
      },
      changed: { subscribe: (l: () => void) => { listeners.add(l); return () => listeners.delete(l); } },
    };
  })[0];
}

/** Sends each change of a control to the selected corners: the field that
 *  moved, and only once it moves. */
function CornerControls({ style, radius }: Config) {
  const actions = useActionsRegistry();
  const last = useRef({ style, radius });
  useEffect(() => {
    const prev = last.current;
    last.current = { style, radius };
    if (style !== prev.style) actions?.trigger('setCorners', { style });
    if (radius !== prev.radius) actions?.trigger('setCorners', { radius });
  }, [actions, style, radius]);
  return null;
}

const TUNE: ActionTunings = { cycleCornerStyle: { bindings: [{ kind: 'key', key: 'k' }] } };

function CornersTrial({ ctx }: { ctx: RenderContext<State, Config> }) {
  const scene = useTrialScene(ctx, createLabScene);
  const { host, changed } = useEditHost();
  const redrawOn = useMemo(() => [changed], [changed]);
  const selectionOptions = useMemo(() => ({ initial: [asNodeId(FIRST)] }), []);
  return (
    <>
      <CornerControls style={ctx.config.style} radius={ctx.config.radius} />
      <TrialSceneCanvas
        features={['draw']}
        defaultTools={['pen']}
        scene={scene}
        trial={ctx.trial}
        pathEdit={host}
        redrawOn={redrawOn}
        selectionOptions={selectionOptions}
        tune={TUNE}
      />
    </>
  );
}

const cornersInstrument = defineInstrument<State, Config>({
  name: 'Corners',
  config,
  initialState: () => ({ scene: null }),
  undo: {},
  tools: {
    tools: [
      { id: 'select', label: 'Select', icon: SelectIcon, shortcut: 'V' },
      { id: 'pen', label: 'Pen', icon: PenIcon, shortcut: 'P' },
    ],
  },
  render: (ctx) => <CornersTrial ctx={ctx} />,
});

export function DynamicCornersLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Dynamic corners" instruments={[cornersInstrument]} defaultInstrument="Corners" />
    </div>
  );
}
