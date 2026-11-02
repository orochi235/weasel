/**
 * The panel over the canvas: a scrubber over the steps of the solve and what
 * the step shown does, how many triangles have turned over there, the key to
 * the mesh's colors, and what to try.
 */
import type { ArapStage } from '@weasel-js/geom/warp';
import { createEmitter } from '@weasel-js/registry';
import { useSyncExternalStore } from 'react';
import { LEGEND } from './meshLayer';
import type { MeshModel, StepPick } from './meshModel';
import s from './PuppetSolverLab.module.css';

export interface Shown {
  triangles: number;
  inverted: number;
  invertedOnOutline: number;
  steps: readonly { stage: ArapStage; round: number }[];
  index: number;
}

export interface Readout {
  set(model: MeshModel | null): void;
  get(): Shown | null;
  subscribe(listener: () => void): () => void;
}

const same = (a: Shown | null, b: Shown | null) => a === b || (!!a && !!b
  && a.triangles === b.triangles && a.inverted === b.inverted && a.invertedOnOutline === b.invertedOnOutline
  && a.index === b.index && a.steps.length === b.steps.length && a.steps.every((st, i) => st.stage === b.steps[i].stage));

/** What the mesh layer last painted. The layer reports from inside a paint,
 *  so listeners hear of a change on the next microtask. */
export function createReadout(): Readout {
  let shown: Shown | null = null;
  const changed = createEmitter();
  return {
    set(model) {
      const next = model && {
        triangles: model.ratio.length, inverted: model.inverted, invertedOnOutline: model.invertedOnOutline,
        steps: model.steps, index: model.index,
      };
      if (same(next, shown)) return;
      shown = next;
      queueMicrotask(() => changed.emit());
    },
    get: () => shown,
    subscribe: changed.subscribe,
  };
}

const STAGES: Record<ArapStage, { name: (round: number) => string; says: string }> = {
  similarity: {
    name: () => 'Step 1: scale and turn',
    says: 'Each triangle may turn and scale to fit the pins: the first linear step of Igarashi, Moscovich and Hughes (2005).',
  },
  rigid: {
    name: () => 'Step 2: rigid copies',
    says: 'An unscaled copy of each rest triangle is fitted to step 1, and the vertices that best agree with every copy are solved for.',
  },
  'local-global': {
    name: (round) => `Local/global round ${round}`,
    says: 'Each round turns every triangle’s copy to fit the last result best (local), then solves for the vertices again (global), '
      + 'as Sorkine and Alexa (2007) and Liu et al. (2008) do. It takes out stretch, but nothing in it stops a triangle turning over.',
  },
  injective: {
    name: (round) => `Untangling round ${round}`,
    says: 'Runs only when a triangle is still turned over. With the pins held exactly, each round lowers an untangling energy '
      + '(Garanzha et al., 2021) whose softening shrinks as the turned triangles right themselves; once none is left, no round '
      + 'may flatten one. The count can rise before it falls. The last round is the result.',
  },
};

export function SolverPanel({ readout, caption, onPick }: { readout: Readout; caption: string; onPick(pick: StepPick): void }) {
  const shown = useSyncExternalStore(readout.subscribe, readout.get);
  const step = shown?.steps[shown.index];
  const last = shown ? shown.steps.length - 1 : 0;
  return (
    <section className={s.panel} aria-label="Solver">
      <label className={s.scrub}>
        <span className={s.row}>
          <span>{step ? STAGES[step.stage].name(step.round) : 'Solve'}</span>
          <span className={s.count} data-testid="step">{shown ? `${shown.index + 1}/${shown.steps.length}` : '–'}</span>
        </span>
        <input
          type="range" min={0} max={last} step={1} value={shown?.index ?? 0} disabled={!shown}
          aria-label="Step of the solve"
          onChange={(e) => { const i = Number(e.currentTarget.value); onPick(i >= last ? null : i); }}
        />
      </label>
      {step && <p className={s.caption}>{STAGES[step.stage].says}</p>}
      <dl className={s.readout}>
        <div className={s.row}><dt>Triangles</dt><dd data-testid="triangles">{shown?.triangles ?? '–'}</dd></div>
        <div className={s.row}><dt>Turned over</dt><dd data-testid="inverted">{shown?.inverted ?? '–'}</dd></div>
        <div className={s.row}><dt>Turned over on the outline</dt><dd data-testid="inverted-outline">{shown?.invertedOnOutline ?? '–'}</dd></div>
      </dl>
      <ul className={s.legend}>
        {LEGEND.map(({ label, color }) => (
          <li key={label}>
            <svg className={s.swatch} width="10" height="10" aria-hidden="true"><rect width="10" height="10" fill={color} /></svg>
            {label}
          </li>
        ))}
      </ul>
      <p className={s.caption}>{caption}</p>
    </section>
  );
}
