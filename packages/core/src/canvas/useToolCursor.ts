import { useLayoutEffect } from 'react';
import { resolveCursorTier, type CursorSink, type ResolvedCursor } from '@weasel-js/cursor';
import type { ToolsApi } from '../tools/overlayBinding';

function resolveToolsCursor(tools: ToolsApi): ResolvedCursor | undefined {
  // The tool input routes to, so a tool the mode bars shows no cursor of its own.
  const id = tools.routed;
  const tool = id === null ? undefined : tools.registry[id];
  if (!tool?.cursor) return undefined;
  if (typeof tool.cursor !== 'function') return resolveCursorTier(tool.cursor);
  try {
    return resolveCursorTier(tool.cursor());
  } catch {
    return undefined;
  }
}

/**
 * Writes the active tool's cursor to `sink` as its base, and `rest` (the
 * element's own cursor) for when the tool declares none.
 *
 * `element` is what the sink writes to, named so the base is written again
 * when a detached surface's input element arrives a render late.
 */
export function useToolCursor(
  sink: CursorSink,
  tools: ToolsApi | undefined,
  element: HTMLElement | null | undefined,
  rest: string | undefined,
): void {
  const tier = tools ? resolveToolsCursor(tools) : undefined;
  // Keyed on the value, not the object: the tier is rebuilt every render.
  const key = tier === undefined
    ? ''
    : tier.kind === 'css'
      ? `css|${tier.css}`
      : `${tier.glyph}|${tier.mark}|${tier.angle}|${tier.size}|${tier.worldRadius}`;
  useLayoutEffect(() => {
    sink.setBase(tier ?? null, rest ?? '');
    // `tier` is a fresh object each render; the key is its identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sink, key, element, rest]);
}
