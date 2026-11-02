import { useCallback, useEffect, useMemo } from 'react';
import { useAnimator } from '@weasel-js/animator/react';
import { DiagramView, diagramScene, edgeIdOf, type DataEdge, type DataNode } from '@weasel-js/diagram';
import { Button } from '@weasel-js/ui/components/Button';
import { FONT } from './diagram/shared';
import { DemoStage } from './DemoStage';

const W = 640, H = 360;
const BOX = { width: 120, height: 44 };

const NODES: DataNode[] = [
  { id: 'read', at: { x: 30, y: 158 }, ...BOX, lines: ['read'] },
  { id: 'parse', at: { x: 250, y: 50 }, ...BOX, lines: ['parse'] },
  { id: 'check', at: { x: 250, y: 266 }, ...BOX, lines: ['check'] },
  { id: 'write', at: { x: 490, y: 158 }, ...BOX, lines: ['write'] },
];
/** In the order they draw on. */
const EDGES: DataEdge[] = [
  { from: 'read', to: 'parse' },
  { from: 'read', to: 'check', router: 'orthogonal' },
  { from: 'parse', to: 'write' },
  { from: 'check', to: 'write', router: 'orthogonal' },
  { from: 'parse', to: 'check', router: 'straight' },
];
const EDGE_IDS = EDGES.map(edgeIdOf);
const DRAW = 'draw-on';

export function DiagramDrawOnDemo() {
  const animator = useAnimator();
  const specs = useMemo(() => diagramScene({ nodes: NODES, edges: EDGES }, { layout: 'none', font: FONT }), []);

  const play = useCallback(() => {
    animator.cancelKey(DRAW);
    const ends = EDGE_IDS.map((id) => animator.trimOverrides.target(id, 'end'));
    for (const end of ends) {
      end.stop({ commit: false });
      end.commit(0);
    }
    animator.stagger(ends, 450).tween({ to: 1, ms: 700, easing: 'easeInOutCubic', cancelKey: DRAW });
  }, [animator]);

  useEffect(() => {
    play();
    return () => animator.cancelKey(DRAW);
  }, [animator, play]);

  return (
    <div className="ckd-stack">
      <div className="ckd-row">
        <Button onClick={play}>Replay</Button>
      </div>
      <DemoStage width={W} height={H}>
        <DiagramView specs={specs} className="ckd-canvas" animator={animator} />
      </DemoStage>
    </div>
  );
}
