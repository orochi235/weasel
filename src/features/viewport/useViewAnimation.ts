import { useViewTween } from './useViewTween';
import type { View } from './view';

export function useViewAnimation(setView: (v: View) => void) {
  const { animateTo, cancel } = useViewTween(setView);
  return { animateTo, cancel };
}
