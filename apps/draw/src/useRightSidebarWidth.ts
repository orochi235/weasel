import { useCallback, useState } from 'react';
import { PREFS, usePref } from './prefs';

// Bounds for the sidebar drag come from the pref that stores the result, so the handle and the
// Preferences number field can't drift apart. app.css clamps to the same numbers as a backstop.
const { min: MIN, max: MAX } = PREFS.children.ui.children.rightSidebarWidth;

/**
 * The Properties sidebar's width as its resize handle drives it. A drag shadows the pref until it
 * ends, so a pointer-rate stream of samples doesn't schedule a prefs write per frame.
 */
export function useRightSidebarWidth() {
  const [prefWidth, setPrefWidth] = usePref('ui.rightSidebarWidth');
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const commit = useCallback((next: number) => {
    setPrefWidth(next);
    setDragWidth(null);
  }, [setPrefWidth]);
  return { width: dragWidth ?? prefWidth, min: MIN, max: MAX, onInput: setDragWidth, onChange: commit };
}
