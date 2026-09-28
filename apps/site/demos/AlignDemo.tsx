import { asNodeId, SceneCanvas } from '@weasel-js/core';
import type { ActionsProp, BoundGesture } from '@weasel-js/core';

const W = 400, H = 300;

const RECTS = [
  { id: 'a', x: 40,  y: 40,  width: 70, height: 50, color: '#7fb069' },
  { id: 'b', x: 160, y: 90,  width: 50, height: 70, color: '#d4a574' },
  { id: 'c', x: 260, y: 150, width: 90, height: 60, color: '#a48bd4' },
];

const SCENE = {
  version: 1,
  systemLayers: [{ id: 'default' }],
  nodes: RECTS.map(({ id, color, ...pose }) => ({
    id, kind: 'leaf', layer: 'default', pose, data: { fill: { color } },
  })),
};

/** A letter aligns to the selection's own union; with Shift, to the cursor. */
function alignKeys(key: string): BoundGesture[] {
  const keys = [key, key.toUpperCase()];
  return [
    { spec: { kind: 'key', key: keys }, opts: { params: { to: 'union' } } },
    { spec: { kind: 'key', key: keys, mods: { shift: true } }, opts: { params: { to: 'pointer' } } },
  ];
}

/**
 * The `arrange` preset registers align and flip with no keys of their own;
 * `actions` gives them bindings, and a binding's params pick what the
 * selection lines up against.
 */
const ACTIONS: ActionsProp = {
  'align.left': { defaultBinding: alignKeys('l') },
  'align.top': { defaultBinding: alignKeys('t') },
  'align.centerX': { defaultBinding: alignKeys('c') },
  'flip': {
    defaultBinding: [
      { spec: { kind: 'key', key: ['f', 'F'] }, opts: { params: { axis: 'x', pivot: 'pointer' } } },
    ],
  },
};

export function AlignDemo() {
  return (
    <SceneCanvas
      width={W}
      height={H}
      className="ckd-canvas"
      scene={SCENE}
      features={['pick', 'move', 'transform', 'arrange']}
      actions={ACTIONS}
      selectionOptions={{ mode: 'multi', initial: RECTS.map((r) => asNodeId(r.id)) }}
    />
  );
}
