import type { AnalyserTap, AudioGraph } from '@weasel-js/audio';
import { PREVIEW_SIZE } from '../draw';
import { closeBitmaps, previewsOf } from '../runner/previews';
import type { EffectRun, EffectStageRun } from '../types';
import { drawScope, drawSpectrum, type AudioPreview } from './scope';

/** The analyser taps behind a live runner's previews, and the runs it has drawn them into. */
export interface LivePreviews {
  mode(): AudioPreview;
  setMode(mode: AudioPreview, graph: AudioGraph, ids: readonly string[]): void;
  /** After an edit: forgets taps of `removed` nodes (the graph disposed them) and taps any planned node without one. */
  follow(graph: AudioGraph, removed: readonly string[], planned: readonly string[]): void;
  /** Forgets every tap: they went with the graph they were on. */
  restart(): void;
  /** A run with the previews drawn from every tap, over `errors`; undefined when nothing is tapped. */
  draw(errors: Readonly<Record<string, string>>): EffectRun | undefined;
  /** Notes a run the runner published, so `drawn` can tell which came before it. */
  track(run: EffectRun): void;
  drawn(run: EffectRun | undefined): void;
  /** Closes every bitmap still held and disposes the taps. */
  dispose(): void;
}

export function createLivePreviews(): LivePreviews {
  let mode: AudioPreview = 'off';
  let taps = new Map<string, AnalyserTap>();
  // Runs published and not yet known to be off screen, oldest first.
  let published: EffectRun[] = [];

  const tapAll = (graph: AudioGraph, ids: readonly string[]) => {
    for (const id of ids) if (!taps.has(id)) taps.set(id, graph.tap(id));
  };
  const disposeTaps = () => {
    for (const t of taps.values()) t.dispose();
    taps = new Map();
  };

  return {
    mode: () => mode,
    setMode(next, graph, ids) {
      mode = next;
      if (next === 'off') disposeTaps();
      else tapAll(graph, ids);
    },
    follow(graph, removed, planned) {
      if (mode === 'off') return;
      for (const id of removed) taps.delete(id);
      const live = new Set(planned);
      for (const id of [...taps.keys()]) if (!live.has(id)) taps.delete(id);
      tapAll(graph, planned);
    },
    restart() {
      taps = new Map();
    },
    draw(errors) {
      if (mode === 'off' || taps.size === 0) return undefined;
      const paint = mode === 'scope' ? drawScope : drawSpectrum;
      const stages: Record<string, EffectStageRun> = Object.fromEntries(
        Object.entries(errors).map(([id, error]) => [id, { error }]),
      );
      for (const [id, tap] of taps) {
        stages[id] = { ...stages[id], previews: { out: paint(tap, { width: PREVIEW_SIZE, height: PREVIEW_SIZE }) } };
      }
      return { stages };
    },
    track(run) {
      published.push(run);
    },
    drawn(run) {
      const at = run === undefined ? published.length : published.indexOf(run);
      if (at <= 0) return;
      const keep = new Set(run === undefined ? [] : previewsOf(run));
      closeBitmaps(published.slice(0, at).flatMap(previewsOf).filter((b) => !keep.has(b)));
      published = published.slice(at);
    },
    dispose() {
      disposeTaps();
      closeBitmaps(published.flatMap(previewsOf));
      published = [];
    },
  };
}
