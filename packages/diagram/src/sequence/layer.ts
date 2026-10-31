/**
 * What makes a sequence's parts grabbable: a head, a message or note, a
 * fragment's tab, a box's label strip, an activation bar, a destruction's
 * cross, and each end of a message, as regions over every sequence root in the scene.
 * The parts themselves take no press, so these regions are the only way in.
 */
import {
  composeAffordanceLayer, composeWorldPose, scenePoseAdapter, type Affordance, type AffordanceRegion, type RectPose,
  type RenderLayer, type Scene, type Vec2,
} from '@weasel-js/core';
import { keyedIndex } from '../keyedIndex';
import type { SeqRect } from './layout';
import { sequenceRootOf, type SequenceGeometry } from './trait';

/** The layer id the sequence regions are composed into. */
export const SEQUENCE_LAYER_ID = 'diagram-sequence';

/** The affordance kind a press on a sequence part reports. */
export const SEQUENCE_AFFORDANCE_KIND = `layer:${SEQUENCE_LAYER_ID}` as const;

/** What a press on a sequence part hands the sequence actions, as the hit's `payload`. */
export interface SequenceScratch {
  targetId: string;
  /** The sequence root's id. */
  root: string;
  /** A head, a message's, note's or fragment's row, one end of a message, a box, or a part drawn for lifeline marks. */
  part: 'head' | 'step' | 'end' | 'box' | 'mark';
  /** The participant's, step's, or box's id; for a mark's part, the part's id under the root (`act:0`). */
  id: string;
  end?: 'from' | 'to';
}

/** Read a sequence press's scratch back off the hit an action was handed. */
export function sequenceScratchOf(hit: { payload?: unknown } | null | undefined): SequenceScratch | null {
  const p = hit?.payload as SequenceScratch | undefined;
  return p !== undefined && typeof p.root === 'string' && typeof p.id === 'string' && typeof p.part === 'string' ? p : null;
}

type AnyScene = Scene<unknown, string, unknown>;

/** One root an edit may touch: its id, its world origin and size, and the geometry its parts were built with. */
export interface PlacedSequence { id: string; origin: Vec2; width: number; height: number; geometry: SequenceGeometry }

/** Every sequence root in `scene` that is neither locked nor hidden. */
export function placedSequences(scene: AnyScene): PlacedSequence[] {
  const out: PlacedSequence[] = [];
  const poses = scenePoseAdapter(scene as never);
  for (const node of scene.renderOrderNodes()) {
    const root = sequenceRootOf(node);
    if (root === null || scene.isLocked(node.id) || scene.isHidden(node.id)) continue;
    const at = composeWorldPose(poses, node.id, scene.composition.compose as never) as RectPose;
    out.push({ id: node.id, origin: { x: at.x, y: at.y }, width: at.width, height: at.height, geometry: root.geometry });
  }
  return out;
}

/** Half the height a message's line takes a press across. */
const REACH = 6;
/** Half an end handle's side. */
const END = 7;

const moved = (r: SeqRect, o: Vec2): SeqRect => ({ x: r.x + o.x, y: r.y + o.y, width: r.width, height: r.height });

/** The rect a message takes a press in: its line, its loop, and its text. */
export function messageReach(m: SequenceGeometry['messages'][number]): SeqRect {
  const x0 = Math.min(m.x1, m.x2);
  const x1 = m.loopY !== undefined ? m.x1 + 32 : Math.max(m.x1, m.x2);
  const y1 = (m.loopY ?? m.y) + REACH;
  const top = Math.min(m.y - REACH, m.text?.y ?? Infinity);
  const left = Math.min(x0, m.text?.x ?? Infinity);
  const right = Math.max(x1, m.text ? m.text.x + m.text.width : -Infinity);
  return { x: left, y: top, width: right - left, height: y1 - top };
}

function region(id: string, r: SeqRect, scratch: SequenceScratch, cursor: string): AffordanceRegion {
  return {
    id, targetId: null, shape: { kind: 'rect', x: r.x, y: r.y, width: r.width, height: r.height }, cursor: cursor as never,
    strength: 'exclusive', claimedKinds: ['pointer'], bind: () => ({ initialScratch: scratch }),
  };
}

/** The regions for heads and rows, and the ones for message ends, which win wherever they overlap the rest. */
function regionsOf(all: readonly PlacedSequence[]): { parts: AffordanceRegion[]; ends: AffordanceRegion[] } {
  const parts: AffordanceRegion[] = [];
  const ends: AffordanceRegion[] = [];
  for (const { id: root, origin, geometry } of all) {
    const base = { targetId: root, root };
    for (const h of geometry.heads) parts.push(region(`${root}/head:${h.id}`, moved(h.box, origin), { ...base, part: 'head', id: h.id }, 'ew-resize'));
    for (const m of geometry.marks ?? []) parts.push(region(`${root}/${m.id}`, moved(m.grip, origin), { ...base, part: 'mark', id: m.id }, 'default'));
    for (const b of geometry.boxes ?? []) parts.push(region(`${root}/box:${b.id}`, moved(b.grip, origin), { ...base, part: 'box', id: b.id }, 'default'));
    for (const f of geometry.fragments ?? []) parts.push(region(`${root}/frag:${f.id}`, moved(f.grip, origin), { ...base, part: 'step', id: f.id }, 'ns-resize'));
    for (const n of geometry.notes) parts.push(region(`${root}/note:${n.id}`, moved(n.box, origin), { ...base, part: 'step', id: n.id }, 'ns-resize'));
    for (const m of geometry.messages) {
      parts.push(region(`${root}/msg:${m.id}`, moved(messageReach(m), origin), { ...base, part: 'step', id: m.id }, 'ns-resize'));
      const at = [['from', m.x1, m.y], ['to', m.x2, m.loopY ?? m.y]] as const;
      for (const [end, x, y] of at) {
        const r = { x: x - END + origin.x, y: y - END + origin.y, width: END * 2, height: END * 2 };
        ends.push(region(`${root}/msg:${m.id}/${end}`, r, { ...base, part: 'end', id: m.id, end }, 'crosshair'));
      }
    }
  }
  return { parts, ends };
}

const INDEXES = new WeakMap<AnyScene, () => { parts: AffordanceRegion[]; ends: AffordanceRegion[] } | null>();

function regionsIn(scene: AnyScene) {
  let index = INDEXES.get(scene);
  if (index === undefined) {
    index = keyedIndex(
      () => (typeof scene.getVersion === 'function' ? [scene.getVersion()] : undefined),
      () => regionsOf(placedSequences(scene)),
    );
    INDEXES.set(scene, index);
  }
  return index() ?? regionsOf(placedSequences(scene));
}

/** The composed layer, for `CanvasExtensionApi.registerLayer`. Register it last: the last registered is hit first. */
export function sequenceLayer(scene: Scene<unknown, string, unknown>): RenderLayer<unknown> {
  const parts: Affordance = { id: SEQUENCE_LAYER_ID, regions: () => regionsIn(scene).parts };
  const ends: Affordance = { id: `${SEQUENCE_LAYER_ID}-ends`, regions: () => regionsIn(scene).ends };
  return composeAffordanceLayer(SEQUENCE_LAYER_ID, 'Sequence diagram parts', [parts, ends]) as unknown as RenderLayer<unknown>;
}
