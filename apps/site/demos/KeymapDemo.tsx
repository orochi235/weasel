import { asNodeId, key, keymapContribution, SceneCanvas } from '@weasel-js/core';
import { KeymapHint } from '@weasel-js/ui/components/KeymapHint';
import { DemoStage } from './DemoStage';
import s from './KeymapDemo.module.css';

const W = 420, H = 300;

const RECTS = [
  { id: 'a', x: 40,  y: 40,  width: 70, height: 50, color: '#7fb069' },
  { id: 'b', x: 170, y: 100, width: 50, height: 70, color: '#d4a574' },
  { id: 'c', x: 270, y: 170, width: 90, height: 60, color: '#a48bd4' },
];

const SCENE = {
  version: 3,
  systemLayers: [{ id: 'default' }],
  nodes: RECTS.map(({ id, color, ...pose }) => ({
    id, kind: 'mark', layer: 'default', pose, data: { fill: { paint: { color } } },
  })),
};

/**
 * One leader, Mod+K, opens a keymap of the `arrange` preset's actions. Its keys
 * are live only while it is open, so they take letters no other binding could
 * spare, and a click inside it aligns to the pointer.
 */
const ARRANGE = keymapContribution({
  id: 'arrange',
  label: 'Arrange',
  leader: key('Mod+K'),
  bindings: [
    { spec: key('L'), actionId: 'align.left', opts: { id: 'arrange.left', params: { to: 'union' } } },
    { spec: key('T'), actionId: 'align.top', opts: { id: 'arrange.top', params: { to: 'union' } } },
    { spec: key('H'), actionId: 'flip', opts: { id: 'arrange.flipX', params: { axis: 'x', pivot: 'union' } } },
    { spec: key('V'), actionId: 'flip', opts: { id: 'arrange.flipY', params: { axis: 'y', pivot: 'union' } } },
    { spec: { kind: 'click' }, actionId: 'align.left', opts: { id: 'arrange.leftToPointer', params: { to: 'pointer' } } },
  ],
});

export function KeymapDemo() {
  return (
    <DemoStage width={W} height={H}>
      <SceneCanvas
        className="ckd-canvas"
        scene={SCENE}
        features={['pick', 'move', 'transform', 'arrange']}
        ambient={ARRANGE}
        claimKeys
        selectionOptions={{ mode: 'multi', initial: RECTS.map((r) => asNodeId(r.id)) }}
      >
        <KeymapHint className={s.hint} />
      </SceneCanvas>
    </DemoStage>
  );
}
