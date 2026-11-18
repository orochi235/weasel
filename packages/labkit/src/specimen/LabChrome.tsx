import { ActionButton } from '@weasel-js/ui/components/ActionButton';
import { Bar } from '@weasel-js/ui/components/Bar';
import { FloatingPanel } from '@weasel-js/ui/components/FloatingPanel';
import { Legend, type LegendEntry } from '@weasel-js/ui/components/Legend';
import { ScaleBar } from '@weasel-js/ui/components/ScaleBar';
import { ZoomControl } from '@weasel-js/ui/components/ZoomControl';
import { useState } from 'react';
import type { JobHandle } from '../job/types';
import { JobProgress } from '../primitives/JobProgress';
import { Split } from '../primitives/Split';
import { Cell } from './Cell';
import { Section } from './Section';

const LEGEND: LegendEntry[] = [
  { key: 'contour', label: 'contour', color: 'var(--wzl-fg-muted)' },
  { key: 'floor', label: 'floor', color: 'var(--wzl-fg-subtle)', mark: 'dash' },
  { key: 'authored', label: 'authored', color: 'var(--wzl-success)', mark: 'dot' },
  { key: 'replaced', label: 'replaced', color: 'var(--wzl-danger)', mark: 'band' },
];

const JOB: JobHandle = {
  status: 'running',
  done: 34,
  total: 120,
  failures: [],
  error: null,
  start: () => {},
  cancel: () => {},
};

export function LabChrome() {
  const [zoom, setZoom] = useState(1);
  return (
    <Section title="Lab chrome">
      <Cell label="Bar" wide>
        <Bar label="My Trial" lead="label" roving size="sm" framed="band">
          <Bar.Group>
            <ActionButton label="Undo" onPress={() => {}} />
            <ActionButton label="Redo" onPress={() => {}} disabled />
          </Bar.Group>
          <Bar.Group end>
            <ActionButton label="Save" onPress={() => {}} />
          </Bar.Group>
        </Bar>
      </Cell>
      <Cell label="Legend, JobProgress">
        <Legend entries={LEGEND} />
        <JobProgress job={JOB} />
      </Cell>
      <Cell label="ScaleBar, ZoomControl">
        <ScaleBar zoom={zoom} />
        <ZoomControl zoom={zoom} onZoomInput={setZoom} onZoomChange={setZoom} min={0.1} max={8} />
      </Cell>
      <Cell label="FloatingPanel">
        <div className="lk-specimen__floating-host">
          <FloatingPanel anchor="top-right">
            <Legend entries={LEGEND.slice(0, 2)} />
          </FloatingPanel>
        </div>
      </Cell>
      <Cell label="Split" wide>
        <div className="lk-specimen__box">
          <Split
            sidebar={<div className="lk-specimen__pad">sidebar</div>}
            defaultWidth={160}
            minWidth={100}
            maxWidth={260}
          >
            <div className="lk-specimen__pad">content</div>
          </Split>
        </div>
      </Cell>
    </Section>
  );
}
