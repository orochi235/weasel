/** The node style an edit holds: the one it rewrote, if any, and the resolved style the overlay is dressed in. */
import { useCallback, useRef, useState } from 'react';
import { resolveTextStyle, type ResolvedTextStyle, type TextStyle } from '@weasel-js/text';
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
  const baseRef = useRef<ResolvedTextStyle>(resolveTextStyle(undefined));
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
  /** Places the open edit's overlay; set by the edit for as long as it is open. */
  const placeRef = useRef<() => void>(() => {});
  /** Hold `style` as the node's, or the node's own for `null`, dress the overlay in it, and place it again. */
  const restyleNode = useCallback((overlay: HTMLDivElement, id: string, style: TextStyle | null) => {
    holdNodeStyle(style);
    // The root's own decoration and slant reach every run by inheritance.
    const base = (baseRef.current = resolveTextStyle(style ?? optsRef.current.getStyle(id), optsRef.current.getPaint?.(id)));
    applyOverlayStyle(overlay, base);
    // Dressing resets the sizes `place` set from the pose.
    placeRef.current();
    return base;
  }, [holdNodeStyle, optsRef]);
  return { nodeStyle, nodeStyleRef, baseRef, holdNodeStyle, styleOf, restyleNode, placeRef };
}
