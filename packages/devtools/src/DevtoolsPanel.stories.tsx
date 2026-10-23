import { useMemo } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { SceneCanvas, useScene, type NodeId } from '@weasel-js/core';
import { DevtoolsPanel, createInPagePanelTransport } from '@weasel-js/devtools';
import s from './DevtoolsPanel.stories.module.css';

type Pose = { x: number; y: number; width: number; height: number };

function Board() {
  const scene = useScene<{ name: string }, 'main', Pose>({
    systemLayers: [{ id: 'main' }],
    initial: [
      { id: 'frame' as NodeId, kind: 'group', layer: 'main', pose: { x: 20, y: 20, width: 160, height: 120 }, data: { name: 'frame' } },
      { id: 'card' as NodeId, kind: 'mark', layer: 'main', parent: 'frame' as NodeId, pose: { x: 40, y: 40, width: 60, height: 40 }, data: { name: 'card' } },
      { id: 'badge' as NodeId, kind: 'mark', layer: 'main', parent: 'frame' as NodeId, locked: true, pose: { x: 110, y: 50, width: 40, height: 40 }, data: { name: 'badge' } },
      { id: 'note' as NodeId, kind: 'mark', layer: 'main', pose: { x: 220, y: 60, width: 80, height: 50 }, data: { name: 'note' } },
    ],
  });
  return <SceneCanvas scene={scene} width={340} height={260} tools={{ hand: true, rect: true }} aria-label="Story board" />;
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
