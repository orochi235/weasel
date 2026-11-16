import { useMemo } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { asNodeId, SceneCanvas, useScene, type RectPose } from '@weasel-js/core';
import { DevtoolsPanel, createInPagePanelTransport } from '@weasel-js/devtools';
import { devtools } from '@weasel-js/devtools/hook';
import s from './DevtoolsPanel.stories.module.css';

const AMBIENT = [devtools];

function Board() {
  const scene = useScene<{ name: string }, 'main', RectPose>({
    systemLayers: [{ id: 'main' }],
    initial: [
      { id: asNodeId('frame'), kind: 'group', layer: 'main', pose: { x: 20, y: 20, width: 160, height: 120 }, data: { name: 'frame' } },
      { id: asNodeId('card'), kind: 'mark', layer: 'main', parent: asNodeId('frame'), pose: { x: 40, y: 40, width: 60, height: 40 }, data: { name: 'card' } },
      { id: asNodeId('badge'), kind: 'mark', layer: 'main', parent: asNodeId('frame'), locked: true, pose: { x: 110, y: 50, width: 40, height: 40 }, data: { name: 'badge' } },
      { id: asNodeId('note'), kind: 'mark', layer: 'main', pose: { x: 220, y: 60, width: 80, height: 50 }, data: { name: 'note' } },
    ],
  });
  return <SceneCanvas scene={scene} width={340} height={260} tools={{ hand: true, rect: true }} ambient={AMBIENT} aria-label="Story board" />;
}

/** A canvas and the panel reading it, side by side. */
function PanelBesideCanvas() {
  const transport = useMemo(() => createInPagePanelTransport(), []);
  return (
    <div className={s.layout}>
      <Board />
      <div className={s.panel}><DevtoolsPanel transport={transport} /></div>
    </div>
  );
}

const meta: Meta<typeof PanelBesideCanvas> = {
  title: 'devtools/DevtoolsPanel',
  component: PanelBesideCanvas,
};
export default meta;

type Story = StoryObj<typeof PanelBesideCanvas>;

export const BesideACanvas: Story = {};
