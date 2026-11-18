/** The frame loop that keeps an open edit's overlay over its node as the node moves on screen. */
import { useCallback, useRef } from 'react';
import { useVisibleRaf } from '@weasel-js/react';

/**
 * `follow(place)` calls `place` every frame — behind the visibility gate, so an overlay left open in a background
 * tab costs nothing — until the function it returns is called.
 */
export function useOverlayFollow(): (place: () => void) => () => void {
  // The loop is started per edit; the gate's frame callback reaches it through this ref.
  const tickRef = useRef<() => void>(() => {});
  const frameLoop = useVisibleRaf(() => { tickRef.current(); });
  return useCallback((place: () => void) => {
    tickRef.current = () => {
      place();
      frameLoop.request();
    };
    frameLoop.request();
    return () => {
      frameLoop.cancel();
      tickRef.current = () => {};
    };
  }, [frameLoop]);
}
