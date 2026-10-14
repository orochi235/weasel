import { registerCanvasFont } from '@weasel-js/font';
import { f, meta, story } from '@weasel-js/forge';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { EffectProblem } from '../check';
import type { EffectLook } from '../draw';
import { EffectChart } from '../EffectChart';
import { EFFECT_LOOKS } from '../looks';
import { SAMPLES } from './samples';
import s from './EffectLab.stories.module.css';

registerCanvasFont('sans-serif');

export default meta({ title: 'diagram/EffectChart lab', layout: 'fullscreen' });

interface LabConfig {
  sample: string;
  look: string;
  branch: string;
  showParams: boolean;
  nodeGap: number;
  rankGap: number;
  router: string;
  side: string;
  collapseSkips: boolean;
}

interface Size {
  width: number;
  height: number;
}

/** The element's box in whole pixels, or null until it has one. */
function useBoxSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<Size | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      const width = Math.round(el.clientWidth);
      const height = Math.round(el.clientHeight);
      setSize((prev) => (prev?.width === width && prev.height === height ? prev : { width, height }));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}

function LabView({ config }: { config: LabConfig }) {
  const [problems, setProblems] = useState<readonly EffectProblem[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  // Both looks take one bag; each reads the keys it knows.
  const options = useMemo(() => ({
    branch: config.branch,
    showParams: config.showParams,
    nodeGap: config.nodeGap,
    rankGap: config.rankGap,
    router: config.router,
    side: config.side,
    collapseSkips: config.collapseSkips,
  }), [config.branch, config.showParams, config.nodeGap, config.rankGap, config.router, config.side, config.collapseSkips]);
  const [boxRef, size] = useBoxSize<HTMLDivElement>();
  const look = EFFECT_LOOKS[config.look as keyof typeof EFFECT_LOOKS] as EffectLook<typeof options>;
  return (
    <div className={s.lab}>
      <div ref={boxRef} className={s.chart}>
        {size !== null && size.width > 0 && size.height > 0 && (
          <div className={s.canvas}>
            <EffectChart
              pipeline={SAMPLES[config.sample]!}
              look={look}
              options={options}
              width={size.width}
              height={size.height}
              selected={picked}
              onSelect={setPicked}
              onProblems={setProblems}
            />
          </div>
        )}
      </div>
      <div>
        <div className={s.status}>picked: {picked ?? 'none'}</div>
        <ul className={s.problems} aria-label="Problems">
          {problems.map((p, i) => <li key={i}>{p.message}</li>)}
        </ul>
      </div>
    </div>
  );
}

export const Lab = story({
  config: f.schema({
    sample: f.enum('skip', Object.keys(SAMPLES)).label('Pipeline'),
    look: f.enum('nodeGraph', Object.keys(EFFECT_LOOKS)).radio().label('Look'),
    branch: f.enum('auto', ['auto', 'diamond', 'bar', 'demux', 'switch']).label('Branch symbol'),
    showParams: f.boolean(true).label('Show params'),
    nodeGap: f.number(32).range(8, 96).step(4).label('Node gap'),
    rankGap: f.number(72).range(24, 200).step(4).label('Rank gap'),
    router: f.enum('bezier', ['bezier', 'orthogonal', 'straight']).label('Router').showIf((c) => c.look === 'nodeGraph'),
    side: f.enum('below', ['below', 'above']).radio().label('Side inputs').showIf((c) => c.look === 'rack'),
    collapseSkips: f.boolean(true).label('Collapse skip-ahead decisions').showIf((c) => c.look === 'rack'),
  }),
  render: ({ config }) => <LabView config={config as LabConfig} />,
});
