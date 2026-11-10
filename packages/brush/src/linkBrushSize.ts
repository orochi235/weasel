import type { PrefNumber } from '@weasel-js/prefs';
import type { ToolOptions, ToolOptionValues } from '@weasel-js/routing';

/** The id `linkBrushSize` keeps the shared size under in the store it wraps, unless told another. */
export const SHARED_BRUSH_SLOT = 'sharedBrush';
/** The option the shared size is kept as, within its slot. */
export const SHARED_BRUSH_SIZE = 'size';

/** A tool as `linkBrushSize` reads it: its id, and the options that name its size. */
export interface BrushTool {
  readonly id: string;
  readonly options?: ToolOptions;
}

/** Options for {@link linkBrushSize}. */
export interface LinkBrushSizeOptions {
  /** The id the shared size is kept under in the wrapped store. Default {@link SHARED_BRUSH_SLOT}. */
  slot?: string;
}

interface Link {
  option: string;
  leaf: PrefNumber | undefined;
}

function linkOf(tool: BrushTool): Link | undefined {
  const option = tool.options?.size?.option;
  if (option === undefined) return undefined;
  const children = tool.options!.prefs.children;
  const leaf = (Object.hasOwn(children, option) ? children[option] : undefined) as { kind?: string } | undefined;
  return { option, leaf: leaf?.kind === 'number' ? (leaf as PrefNumber) : undefined };
}

const clamp = (v: number, leaf: PrefNumber | undefined) =>
  Math.min(leaf?.max ?? Infinity, Math.max(leaf?.min ?? -Infinity, v));

/**
 * `values`, with one size shared by every tool in `tools` whose options name a
 * `size`: each reads the shared size as its own, held to its own bounds, and a
 * size any of them sets is set for all. Until one is set, each keeps its own.
 * Everything else reads and writes through to `values` as before.
 *
 * Link only tools whose sizes measure the same thing: a radius in screen px
 * shared with one in world units means a different brush in each.
 */
export function linkBrushSize(
  values: ToolOptionValues,
  tools: Iterable<BrushTool>,
  options: LinkBrushSizeOptions = {},
): ToolOptionValues {
  const slot = options.slot ?? SHARED_BRUSH_SLOT;
  const links = new Map<string, Link>();
  for (const tool of tools) {
    const link = linkOf(tool);
    if (link) links.set(tool.id, link);
  }
  // `get` hands back the same object until something it reads changes.
  const cache = new Map<string, { inner: Readonly<Record<string, number>>; shared: number; out: Readonly<Record<string, number>> }>();
  return {
    get(toolId) {
      const inner = values.get(toolId);
      const link = links.get(toolId);
      const shared = values.get(slot)[SHARED_BRUSH_SIZE];
      if (!link || typeof shared !== 'number' || !Number.isFinite(shared)) return inner;
      const hit = cache.get(toolId);
      if (hit && hit.inner === inner && hit.shared === shared) return hit.out;
      const out = Object.freeze({ ...inner, [link.option]: clamp(shared, link.leaf) });
      cache.set(toolId, { inner, shared, out });
      return out;
    },
    set(toolId, option, value) {
      if (links.get(toolId)?.option === option) values.set(slot, SHARED_BRUSH_SIZE, value);
      else values.set(toolId, option, value);
    },
    subscribe: (listener) => values.subscribe(listener),
  };
}
