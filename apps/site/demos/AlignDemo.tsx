import { asNodeId, SceneCanvas } from '@weasel-js/core';
import type { ActionParamSchema, ActionTunings, TunedBinding } from '@weasel-js/core';
import { DemoStage } from './DemoStage';

const W = 400, H = 300;

const RECTS = [
  { id: 'a', x: 40,  y: 40,  width: 70, height: 50, color: '#7fb069' },
  { id: 'b', x: 160, y: 90,  width: 50, height: 70, color: '#d4a574' },
  { id: 'c', x: 260, y: 150, width: 90, height: 60, color: '#a48bd4' },
];

const SCENE = {
  version: 3,
  systemLayers: [{ id: 'default' }],
  nodes: RECTS.map(({ id, color, ...pose }) => ({
    id, kind: 'mark', layer: 'default', pose, data: { fill: { paint: { color } } },
  })),
};

/** A letter aligns to the selection's own union; with Shift, to the cursor. */
function alignKeys(key: string): TunedBinding<ActionParamSchema['align.left']>[] {
  const keys = [key, key.toUpperCase()];
  return [
    { spec: { kind: 'key', key: keys }, opts: { params: { to: 'union' } } },
    { spec: { kind: 'key', key: keys, mods: { shift: true } }, opts: { params: { to: 'pointer' } } },
  ];
}

/**
 * The `arrange` preset registers align with no keys of its own; `tune` adds
 * bindings to it and to flip, and a binding's params pick what the selection
 * lines up against.
 */
const TUNE: ActionTunings = {
  'align.left': { bindings: alignKeys('l') },
  'align.top': { bindings: alignKeys('t') },
  'align.centerX': { bindings: alignKeys('c') },
  flip: { bindings: [{ spec: { kind: 'key', key: ['f', 'F'] }, opts: { params: { axis: 'x', pivot: 'pointer' } } }] },
};

export function AlignDemo() {
  return (
    <DemoStage width={W} height={H}>
      <SceneCanvas
        className="ckd-canvas"
        scene={SCENE}
        features={['pick', 'move', 'transform', 'arrange']}
        tune={TUNE}
        claimKeys
        selectionOptions={{ mode: 'multi', initial: RECTS.map((r) => asNodeId(r.id)) }}
      />
    </DemoStage>
  );
}
