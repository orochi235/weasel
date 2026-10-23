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
import { CORNER_CONTROLS, cornerShapePreset, type CornerControlsSelection } from '@weasel-js/path-tools';
import { useMemo, useState } from 'react';
import { CornerPanel } from './CornerShapePanel';
import s from './CornerShapeLabDemo.module.css';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';
import { icon } from '../icons.gen';

// The corner controls read the selection, so they sit over the canvas
// rather than in the trial's config.
const config = f.schema({});
type Config = ConfigOf<typeof config>;
type State = SceneTrialState<unknown, 'default', RectPose>;

/** The path open for anchor editing as the lab starts, and its selected
 *  anchor: the sharp corner at (220, 140). */
const FIRST = 'tile';
const FIRST_ANCHORS: ReadonlySet<number> = new Set([2]);

function pathNode(id: string, path: PolygonPath, color: string, vertexColors?: number[]) {
  const { x, y, width, height } = boundsOfPath(path);
  return {
    kind: 'mark' as const,
    id: asNodeId(id),
    layer: 'default' as const,
    pose: { x, y, width, height },
    data: { path, fill: { paint: solid(color) }, ...(vertexColors ? { vertexColors } : {}) },
  };
}

const tile = [
  [1, { shape: 'round', radius: 24 }],
  [3, { shape: 'bevel', radius: 18 }],
  [4, { shape: 'scoop', radius: 20 }],
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
        1, { shape: 'squircle', radius: 26 },
      ), '#d4a574'),
      pathNode('prism', withCorner(
        pathFromD('M120 260 L260 260 L190 380 Z'),
        2, { shape: 'round', radius: 30 },
      ), '#ffffff', [1, 0.3, 0.3, 1, 0.3, 0.6, 1, 1, 0.4, 0.9, 0.4, 1]),
    ],
  });

/** Which path is open and which of its anchors are selected, held beside the
 *  trial so the lab opens on one corner and its panel can read them. */
function useEditHost(): { host: PathEditHost; selection: CornerControlsSelection } {
  return useState(() => {
    let id: string | null = FIRST;
    let anchors = FIRST_ANCHORS;
    const listeners = new Set<() => void>();
    const changed = () => listeners.forEach((l) => l());
    const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
    return {
      host: {
        editingId: () => id,
        setEditingId: (next: string | null) => { id = next; changed(); },
        selectedAnchors: () => anchors,
        setSelectedAnchors: (next: ReadonlySet<number>) => { anchors = next; changed(); },
      },
      selection: { editingId: () => id, selectedAnchors: () => anchors, subscribe },
    };
  })[0];
}

const FEATURES = ['draw', cornerShapePreset] as const;
const TUNE: ActionTunings = { cycleCornerShape: { bindings: [{ kind: 'key', key: 'k' }] } };

function CornersTrial({ ctx }: { ctx: RenderContext<State, Config> }) {
  const scene = useTrialScene(ctx, createLabScene);
  const { host, selection } = useEditHost();
  const redrawOn = useMemo(() => [selection], [selection]);
  const selectionOptions = useMemo(() => ({ initial: [asNodeId(FIRST)] }), []);
  return (
    <div className={s.frame}>
      <TrialSceneCanvas
        features={FEATURES}
        defaultTools={['pen']}
        scene={scene}
        trial={ctx.trial}
        pathEdit={host}
        redrawOn={redrawOn}
        selectionOptions={selectionOptions}
        tune={TUNE}
      />
      <CornerPanel scene={scene} selection={selection} />
    </div>
  );
}

const cornersInstrument = defineInstrument<State, Config>({
  name: 'Corners',
  config,
  initialState: () => ({ scene: null }),
  undo: {},
  tools: {
    tools: [
      { id: 'select', label: 'Select', icon: icon('core:select'), shortcut: 'V' },
      { id: 'pen', label: 'Pen', icon: icon('core:pen'), shortcut: 'P' },
    ],
  },
  render: (ctx) => <CornersTrial ctx={ctx} />,
});

export function CornerShapeLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title={CORNER_CONTROLS.name} instruments={[cornersInstrument]} defaultInstrument="Corners" />
    </div>
  );
}
