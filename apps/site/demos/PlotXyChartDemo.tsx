import { useState } from 'react';
import { PlotView, type XyChartData } from '@weasel-js/plot';
import { DemoStage } from './DemoStage';

const SALES: XyChartData = {
  kind: 'xychart',
  title: 'Sales',
  x: { kind: 'band', title: 'Month', categories: ['jan', 'feb', 'mar', 'apr', 'may', 'jun'] },
  y: { title: 'Revenue', min: 0, max: 100 },
  series: [
    { kind: 'bar', values: [42, 55, 61, 48, 70, 83] },
    { kind: 'line', values: [30, 45, 52, 60, 58, 75] },
  ],
};

export function PlotXyChartDemo() {
  const [data, setData] = useState(SALES);
  return (
    <div className="ckd-stack">
      <div className="ckd-row">bars: {data.series[0]!.values.join(', ')}</div>
      <DemoStage width={640} height={400}>
        <PlotView data={data} onChange={(next) => setData(next as XyChartData)} width={640} height={400} className="ckd-canvas" />
      </DemoStage>
    </div>
  );
}
