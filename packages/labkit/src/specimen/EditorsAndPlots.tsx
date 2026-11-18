import type { Track } from '@weasel-js/animator';
import { type Band, BandEditor } from '@weasel-js/ui/components/BandEditor';
import type { ControlPoint } from '@weasel-js/ui/components/CurveEditor';
import { CurveEditor, POINT_PLOTTER_PROPS } from '@weasel-js/ui/components/CurveEditor';
import { Plot2D } from '@weasel-js/ui/components/Plot2D';
import { Timeline } from '@weasel-js/ui/components/Timeline';
import { useState } from 'react';
import { Cell } from './Cell';
import { Section } from './Section';

export function EditorsAndPlots() {
  const [curve, setCurve] = useState<ControlPoint[]>([
    { x: 0, y: 0 },
    { x: 0.3, y: 0.1 },
    { x: 0.7, y: 0.9 },
    { x: 1, y: 1 },
  ]);
  const [points, setPoints] = useState<ControlPoint[]>([
    { x: 0.2, y: 0.3 },
    { x: 0.5, y: 0.6 },
    { x: 0.8, y: 0.2 },
  ]);
  const [bands, setBands] = useState<Band<{ name: string }>[]>([
    { from: 1 / 64, data: { name: 'Radial' } },
    { from: 1 / 12, data: { name: 'Name plate' } },
  ]);
  const [band, setBand] = useState<number | null>(null);
  const [tracks, setTracks] = useState<Track[]>(
    () =>
      [
        {
          kind: 'sampled',
          label: 'x',
          keys: [
            { t: 0, value: 0 },
            { t: 800, value: 120, easing: 'easeOutCubic' },
            { t: 1600, value: 40 },
          ],
          onTick: () => {},
        },
        {
          kind: 'event',
          label: 'footstep',
          events: [
            { t: 300, fire: () => {} },
            { t: 900, fire: () => {} },
          ],
        },
      ] as Track[],
  );
  const [playhead, setPlayhead] = useState(0);
  return (
    <Section title="Editors & plots">
      <Cell label="Plot2D">
        <Plot2D
          width={260}
          height={130}
          grid={{ divisions: 3 }}
          axes={{}}
          xRange={[0, 2000]}
          yRange={[-0.35, 1.2]}
        />
      </Cell>
      <Cell label="CurveEditor">
        <CurveEditor
          value={curve}
          onInput={setCurve}
          domain="1d"
          interpolation="catmull-rom"
          endpoints="pinned-both"
          addPointMode="click-curve"
          axes={{}}
          fill={{ side: 'below' }}
          width={260}
          height={130}
        />
      </Cell>
      <Cell label="CurveEditor, point plotter">
        <CurveEditor
          {...POINT_PLOTTER_PROPS}
          value={points}
          onInput={setPoints}
          grid={{ divisions: 3 }}
          axes={{}}
          width={260}
          height={130}
        />
      </Cell>
      <Cell label="BandEditor" wide>
        <BandEditor<{ name: string }>
          min={1 / 64}
          max={1 / 2}
          scale="log"
          snap
          value={bands}
          onChange={setBands}
          selectedIndex={band}
          onSelectionChange={setBand}
          renderBand={(b) => b.data.name}
          ticks={[1 / 24, 1 / 12, 1 / 6].map((at) => ({ at, label: `1/${Math.round(1 / at)}` }))}
        />
      </Cell>
      <Cell label="Timeline" wide>
        <div className="lk-specimen__timeline">
          <Timeline
            tracks={tracks}
            duration={2000}
            playhead={playhead}
            onChange={setTracks}
            onSeek={setPlayhead}
          />
        </div>
      </Cell>
    </Section>
  );
}
