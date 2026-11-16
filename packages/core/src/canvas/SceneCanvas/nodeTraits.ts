/**
 * The node-kind traits a set of presets brings, as one public reading: what a
 * canvas classifies, builds and paints with, and what a properties panel edits.
 */
import type { NodeRoutingEntry } from 'core/scene/NodeRouting';
import type { NodePropertiesEntry } from 'core/scene/NodeProperties';
import type { InsertNodeFactories, InsertNodeFactory } from '../deps/insertFactories';
import type { NodeShapeEntry } from '../NodeShape';
import { resolveFeatures, type FeaturePreset, type PresetNodeShape } from './features';
import { inferredNodeProperties } from './defaultNodeProperties';
import { mergeNamedEntries, presetInsertFactories, presetRouting, presetShapes } from './presetTraits';

/** What {@link nodeTraitsOf} answers. */
export interface NodeTraits {
  /** The routing classifiers, in the order they are tried. */
  readonly routing: readonly NodeRoutingEntry[];
  /** The properties-trait entries a panel edits. */
  readonly properties: readonly NodePropertiesEntry[];
  /** The insert factories by kind, or undefined where nothing gives one. */
  readonly insertNodeFactories: InsertNodeFactories | undefined;
  /** The painters the presets install, in registration order. */
  readonly shapes: readonly PresetNodeShape[];
}

/** The consumer's own traits, which {@link nodeTraitsOf} merges the presets' with. */
export interface NodeTraitBase {
  /** As `<SceneCanvas routing>`: unset, `inferredNodeRouting`. */
  routing?: readonly NodeRoutingEntry[];
  /** As `SelectionPanel`'s `properties`: unset, `inferredNodeProperties`. */
  properties?: readonly NodePropertiesEntry[];
  /** As `<SceneCanvas insertNodeFactories>`. */
  insertNodeFactories?: InsertNodeFactories;
}

/**
 * The traits `features`, with every preset they include, bring beside `base`:
 * the same reading `<SceneCanvas features>` makes, so a panel or a 3D host given
 * the canvas's presets classifies and edits exactly what the canvas does.
 *
 * Presets' routing and properties go ahead of the base's, in preset order; a
 * name the base gives keeps the base's, and with the base unset a preset's
 * entry replaces the default of its name. Insert factories merge by kind, the
 * base's winning. Two presets may give one name the same value — a routing
 * entry with the same `matches`, a properties entry with the same `schema` and
 * `settle`, the same factory — and it counts once; different values throw.
 */
export function nodeTraitsOf(features: readonly FeaturePreset[] | undefined, base: NodeTraitBase = {}): NodeTraits {
  const { presets } = resolveFeatures(features);
  return {
    routing: presetRouting(presets, base.routing),
    properties: mergeNamedEntries(presets, 'properties entry', (p) => p.properties, base.properties, inferredNodeProperties,
      (a, b) => a.schema === b.schema && a.settle === b.settle),
    insertNodeFactories: presetInsertFactories(presets, base.insertNodeFactories),
    shapes: presetShapes(presets),
  };
}

/** What {@link nodeKindPreset} builds a preset from: one kind's traits under one name, beside
 *  any other preset role. */
export interface NodeKindPresetSpec extends Omit<FeaturePreset, 'routing' | 'insertNodeFactories' | 'shapes' | 'properties'> {
  /** The kind's name: its routing kind, its properties entry's name, and the insert kind its
   *  factory answers. */
  readonly kind: string;
  /** Which nodes are of this kind, as a routing entry's `matches`. */
  readonly matches: NodeRoutingEntry['matches'];
  /** Paints the kind and says what of it is grabbable. */
  readonly shape?: NodeShapeEntry<never, never> | PresetNodeShape;
  /** Builds an insert of `kind`. */
  readonly insert?: InsertNodeFactory;
  /** What a properties panel edits on it. */
  readonly properties?: Omit<NodePropertiesEntry, 'name'>;
}

/**
 * A preset teaching a canvas one node kind: its routing, painter, insert
 * factory and properties under one name, with whatever tools, actions or
 * contributions it brings. Turned on with `features`, everything it declares
 * installs; turned off, all of it goes, its tools included.
 */
export function nodeKindPreset(spec: NodeKindPresetSpec): FeaturePreset {
  const { kind, matches, shape, insert, properties, ...rest } = spec;
  return {
    ...rest,
    routing: [{ name: kind, matches }],
    ...(shape ? { shapes: [shape] } : {}),
    ...(insert ? { insertNodeFactories: { [kind]: insert } } : {}),
    ...(properties ? { properties: [{ ...properties, name: kind }] } : {}),
  };
}
