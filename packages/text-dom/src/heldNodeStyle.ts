/** The node style an edit holds: the one it rewrote, if any, and the resolved style the overlay is dressed in. */
import { useCallback, useRef, useState } from 'react';
import { resolveTextStyle, type TextStyle } from '@weasel-js/text';
import type { OverlayRunBase } from './domRuns';
import { applyOverlayStyle } from './overlayStyle';
import type { UseTextEditOptions } from './textEditTypes';

/**
 * The node style an edit has rewritten, published for render and mirrored in a ref for the handlers that rewrite
 * and commit it, and the editing node's resolved style, which run spans inheriting small caps are split by whenever
 * the runs are rewritten.
 */
export function useHeldNodeStyle(
  optsRef: { readonly current: Pick<UseTextEditOptions, 'getStyle' | 'getPaint'> },
) {
  const baseRef = useRef<OverlayRunBase>(resolveTextStyle(undefined));
  const [nodeStyle, setNodeStyle] = useState<TextStyle | null>(null);
  const nodeStyleRef = useRef<TextStyle | null>(null);
  const holdNodeStyle = useCallback((style: TextStyle | null) => {
    nodeStyleRef.current = style;
    setNodeStyle(style);
  }, []);
  const styleOf = useCallback(
    (id: string): TextStyle | undefined => nodeStyleRef.current ?? optsRef.current.getStyle(id),
    [optsRef],
  );
  /** Hold `style` as the node's, or the node's own for `null`, and dress the overlay in it. */
  const restyleNode = useCallback((overlay: HTMLDivElement, id: string, style: TextStyle | null) => {
    holdNodeStyle(style);
    // The root's own decoration and slant reach every run by inheritance.
    const base = (baseRef.current = resolveTextStyle(style ?? optsRef.current.getStyle(id), optsRef.current.getPaint?.(id)));
    applyOverlayStyle(overlay, base);
    return base;
  }, [holdNodeStyle, optsRef]);
  return { nodeStyle, nodeStyleRef, baseRef, holdNodeStyle, styleOf, restyleNode };
}
