import { registerCanvasFont } from '@weasel-js/font';
import { f, meta, story } from '@weasel-js/forge';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { EffectProblem, NodeGraphOptions, RackOptions, CompactOptions, LanesOptions } from '@weasel-js/diagram/effect';
import { EffectChart, EFFECT_LOOKS, BRANCH_SYMBOLS, type BranchChoice } from '@weasel-js/diagram/effect';
import { SAMPLES } from './samples';
import s from './EffectLab.stories.module.css';

registerCanvasFont('sans-serif');

const GROUND = { color: '#0e151b' } as const;

export default meta({ title: 'diagram/EffectChart', layout: 'fullscreen', tags: ['lab'] });

interface LabConfig {
  sample: string;
  look: keyof typeof EFFECT_LOOKS;
  branch: BranchChoice;
  showParams: boolean;
  nodeGap: number;
  rankGap: number;
  router: NonNullable<NodeGraphOptions['router']>;
  side: NonNullable<RackOptions['side']>;
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
  // Every look takes one bag; each reads the keys it knows.
  const options = useMemo((): NodeGraphOptions & RackOptions & LanesOptions & CompactOptions => ({
    branch: config.branch,
    showParams: config.showParams,
    nodeGap: config.nodeGap,
    rankGap: config.rankGap,
    router: config.router,
    side: config.side,
    collapseSkips: config.collapseSkips,
  }), [config.branch, config.showParams, config.nodeGap, config.rankGap, config.router, config.side, config.collapseSkips]);
  const [boxRef, size] = useBoxSize<HTMLDivElement>();
  const look = EFFECT_LOOKS[config.look];
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
              background={GROUND}
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
    branch: f.enum('auto', ['auto', ...Object.keys(BRANCH_SYMBOLS)]).label('Branch symbol'),
    showParams: f.boolean(true).label('Show params'),
    nodeGap: f.number(32).range(8, 96).step(4).label('Node gap'),
    rankGap: f.number(72).range(24, 200).step(4).label('Rank gap'),
    router: f.enum('bezier', ['bezier', 'orthogonal', 'straight']).label('Router').showIf((c) => c.look !== 'rack'),
    side: f.enum('below', ['below', 'above']).radio().label('Side inputs').showIf((c) => c.look === 'rack'),
    collapseSkips: f.boolean(true).label('Collapse skip-ahead decisions').showIf((c) => c.look === 'rack'),
  }),
  render: ({ config }) => <LabView config={config as LabConfig} />,
});
