/**
 * The panel over the canvas: how many triangles the mesh has and how many
 * have turned over, the key to the mesh's colors, and what to try.
 */
import { useSyncExternalStore } from 'react';
import { LEGEND } from './meshLayer';
import type { MeshModel } from './meshModel';
import s from './PuppetSolverLab.module.css';

export interface Counts {
  triangles: number;
  inverted: number;
  invertedOnOutline: number;
}

export interface Readout {
  set(model: MeshModel | null): void;
  get(): Counts | null;
  subscribe(listener: () => void): () => void;
}

/** The counts of the model the mesh layer last painted. The layer reports from
 *  inside a paint, so listeners hear of a change on the next microtask. */
export function createReadout(): Readout {
  let counts: Counts | null = null;
  const listeners = new Set<() => void>();
  return {
    set(model) {
      const next = model && { triangles: model.ratio.length, inverted: model.inverted, invertedOnOutline: model.invertedOnOutline };
      if (next?.triangles === counts?.triangles && next?.inverted === counts?.inverted
        && next?.invertedOnOutline === counts?.invertedOnOutline) return;
      counts = next;
      queueMicrotask(() => listeners.forEach((l) => l()));
    },
    get: () => counts,
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

export function SolverPanel({ readout, caption }: { readout: Readout; caption: string }) {
  const counts = useSyncExternalStore(readout.subscribe, readout.get);
  return (
    <section className={s.panel} aria-label="Mesh">
      <dl className={s.readout}>
        <div className={s.row}><dt>Triangles</dt><dd data-testid="triangles">{counts?.triangles ?? '–'}</dd></div>
        <div className={s.row}><dt>Turned over</dt><dd data-testid="inverted">{counts?.inverted ?? '–'}</dd></div>
        <div className={s.row}><dt>Turned over on the outline</dt><dd data-testid="inverted-outline">{counts?.invertedOnOutline ?? '–'}</dd></div>
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
