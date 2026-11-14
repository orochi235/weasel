import { useEffect, useRef } from 'react';

/** `preview` shown from `show` until `hide`, at most once at a time, and taken
 *  down when the button unmounts or stops offering one. */
export function usePreviewWhileNear(preview: (() => () => void) | undefined): { show: () => void; hide: () => void } {
  const stop = useRef<(() => void) | null>(null);
  const hide = () => {
    stop.current?.();
    stop.current = null;
  };
  const show = () => {
    if (preview && !stop.current) stop.current = preview();
  };
  // Keyed on whether there is one, not its identity: a caller builds it each render.
  const offered = preview !== undefined;
  useEffect(() => () => {
    stop.current?.();
    stop.current = null;
  }, [offered]);
  return { show, hide };
}
