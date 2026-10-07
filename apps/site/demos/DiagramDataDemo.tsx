import { useMemo, useState } from 'react';
import { DiagramView, diagramScene, type DiagramData } from '@weasel-js/diagram';

/** Sinks listed out of order on purpose: the barycenter pass is what keeps
 *  these edges down to the one crossing K2,2 cannot avoid. */
const DATA: DiagramData = {
  nodes: [
    { id: 'mix', lines: ['level mix', '0–1'] },
    { id: 'inv', lines: ['1 − mix'] },
    { id: 'warm', lines: ['warm', 'keys · 1000 ms'] },
    { id: 'cool', lines: ['cool', 'keys · 1000 ms'] },
    { id: 'scale', lines: ['scale', 'mul'] },
    { id: 'color', lines: ['color', 'hex'] },
    { id: 'pose', lines: ['pose', '× 32 dots'] },
  ],
  edges: [
    { from: 'mix', to: 'inv' },
    { from: 'inv', to: 'warm', label: 'weight' },
    { from: 'mix', to: 'cool', label: 'weight' },
    { from: 'warm', to: 'color' },
    { from: 'warm', to: 'scale' },
    { from: 'cool', to: 'color' },
    { from: 'cool', to: 'scale' },
    { from: 'color', to: 'pose' },
    { from: 'scale', to: 'pose' },
  ],
};

export function DiagramDataDemo() {
  const specs = useMemo(() => diagramScene(DATA), []);
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <div className="ckd-stack">
      <div className="ckd-row">picked: {picked ?? 'none'}</div>
      <DiagramView specs={specs} width={640} height={420} selected={picked} onSelect={setPicked} className="ckd-canvas" />
    </div>
  );
}
