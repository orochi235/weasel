import { useCallback, useMemo } from 'react';
import type { NodeRoutingEntry } from 'core/scene/NodeRouting';
import type { InsertNodeFactories } from '../deps/insert';
import type { EnabledPresets } from './features';
import { insertBuilds, presetInsertFactories, presetRouting, usePresetShapes } from './presetTraits';

/** The node-kind traits a canvas runs with: its presets' merged with its own props, and their
 *  painters installed while it runs them. */
export function usePresetTraits(
  enabled: EnabledPresets,
  props: { routing?: readonly NodeRoutingEntry[]; insertNodeFactories?: InsertNodeFactories },
): {
  routing: readonly NodeRoutingEntry[];
  /** The canvas's props with `routing` and `insertNodeFactories` resolved. */
  props: { routing: readonly NodeRoutingEntry[]; insertNodeFactories: InsertNodeFactories | undefined };
  /** Whether an insert of a kind builds a node here. */
  insertBuilds: (kind: string) => boolean;
} {
  const routing = useMemo(() => presetRouting(enabled.presets, props.routing), [enabled, props.routing]);
  const insertNodeFactories = useMemo(
    () => presetInsertFactories(enabled.presets, props.insertNodeFactories),
    [enabled, props.insertNodeFactories],
  );
  usePresetShapes(enabled);
  const builds = useCallback((kind: string) => insertBuilds(kind, insertNodeFactories), [insertNodeFactories]);
  return { routing, props: { routing, insertNodeFactories }, insertBuilds: builds };
}
