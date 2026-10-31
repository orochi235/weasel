import { useEffect, useState } from 'react';
import { DIAGRAM_MERMAID, type PlotPage } from '@weasel-js/diagram-formats';
import { PlotView, type PlotData } from '@weasel-js/plot';
import { Button } from '@weasel-js/ui/components/Button';
import { PlotDataPanel } from '@weasel-js/ui/components/PlotDataPanel';
import gantt from './plotKinds/gantt.mmd?raw';
import gitgraph from './plotKinds/gitgraph.mmd?raw';
import journey from './plotKinds/journey.mmd?raw';
import packet from './plotKinds/packet.mmd?raw';
import pie from './plotKinds/pie.mmd?raw';
import quadrant from './plotKinds/quadrant.mmd?raw';
import radar from './plotKinds/radar.mmd?raw';
import sankey from './plotKinds/sankey.mmd?raw';
import timeline from './plotKinds/timeline.mmd?raw';
import { DemoStage } from './DemoStage';

const SAMPLES = { gantt, timeline, pie, quadrant, journey, gitgraph, sankey, packet, radar };
type Kind = keyof typeof SAMPLES;

export function PlotKindsDemo() {
  const [kind, setKind] = useState<Kind>('gantt');
  const [charts, setCharts] = useState<Partial<Record<Kind, PlotData>>>({});
  const data = charts[kind];
  useEffect(() => {
    if (data !== undefined) return;
    let live = true;
    void Promise.resolve(DIAGRAM_MERMAID.read!(SAMPLES[kind])).then(({ document }) => {
      if (live) setCharts((c) => ({ ...c, [kind]: (document.pages[0] as PlotPage).data }));
    });
    return () => { live = false; };
  }, [kind, data]);
  return (
    <div className="ckd-stack">
      <div className="ckd-row">
        {(Object.keys(SAMPLES) as Kind[]).map((k) => (
          <Button key={k} pressed={k === kind} onClick={() => setKind(k)}>{k}</Button>
        ))}
      </div>
      <DemoStage width={640} height={400}>
        {data && (
          <PlotView
            key={kind} data={data} onChange={(next) => setCharts((c) => ({ ...c, [kind]: next }))}
            width={640} height={400} className="ckd-canvas"
          />
        )}
      </DemoStage>
      {data && <PlotDataPanel data={data} onChange={(next) => setCharts((c) => ({ ...c, [kind]: next }))} />}
    </div>
  );
}
