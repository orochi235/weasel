/**
 * Text measured while its face was still loading is measured again once it
 * lands. Every commit path measures synchronously, so a body, a label or a
 * sequence committed before a lazily registered face arrives is sized for the
 * text as it measured then; this lays them out again when the faces change.
 */
import { faceGeneration, subscribeGlyphReady } from '@weasel-js/font';
import type { Scene } from '@weasel-js/core';
import type { MeasureRowText } from './body';
import { relayoutBodies, type RelayoutScene } from './bodyRelayout';
import { labelFitOps } from './labels/fit';
import { diagramLabelOf } from './labelTrait';
import { redrawSequences } from './sequence/commit';
import type { DiagramTheme } from './theme/types';
import { diagramNodeOf } from './trait';

type AnyScene = Scene<unknown, string, unknown>;

/** How {@link remeasureText} measures, and draws the sequences it builds again. */
export interface RemeasureOptions {
  /** What the scene's text was first measured with, such as `rendererMeasure`. */
  measure: MeasureRowText;
  /** Default the scene's own `diagram:theme`. */
  theme?: DiagramTheme;
}

const NONE: ReadonlySet<never> = new Set();

/**
 * Measures every body, label and sequence in `scene` again with `opts.measure`
 * and lays each out to fit: a body grows to what its rows now need and never
 * shrinks, a label takes its text's size, and a sequence is built again from
 * its data. Untracked, since nothing was edited: undo never brings back a size
 * measured in a face that has since loaded.
 */
export function remeasureText<TPose>(scene: Scene<unknown, string, TPose>, opts: RemeasureOptions): void {
  const sc = scene as unknown as AnyScene;
  const bodies: string[] = [];
  const labels = new Set<string>();
  for (const node of sc.renderOrderNodes()) {
    if (diagramNodeOf(node)?.body !== undefined) bodies.push(node.id);
    else if (diagramLabelOf(node) !== null) labels.add(node.id);
  }
  const summary = { added: NONE, removed: NONE, posed: NONE, reparented: NONE, dataChanged: labels, docChanged: NONE };
  sc.untracked(() => {
    relayoutBodies(sc as unknown as RelayoutScene, bodies, opts.measure);
    for (const [id, size] of labelFitOps(sc, summary as never, opts.measure).sizes) {
      sc.setPose(id as never, { ...(sc.get(id as never)!.pose as object), ...size } as never);
    }
    redrawSequences(sc, opts);
  });
}

/**
 * Calls {@link remeasureText} on `scene` each time the registered faces
 * change (`faceGeneration`): a lazy face landing or failing, a canvas face
 * measured again. A burst of changes is measured once, after it. Returns the
 * unsubscribe.
 */
export function installFaceRemeasure<TPose>(scene: Scene<unknown, string, TPose>, opts: RemeasureOptions): () => void {
  let seen = faceGeneration();
  let queued = false;
  let live = true;
  const run = (): void => {
    queued = false;
    if (!live || faceGeneration() === seen) return;
    seen = faceGeneration();
    remeasureText(scene, opts);
  };
  const off = subscribeGlyphReady(() => {
    if (queued || faceGeneration() === seen) return;
    queued = true;
    queueMicrotask(run);
  });
  return () => { live = false; off(); };
}
