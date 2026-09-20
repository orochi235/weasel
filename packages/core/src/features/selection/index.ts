/**
 * The feature half of selection: drawing it, and publishing it.
 *
 * The other half — `SelectionApi`, `useSelection`, `ChromeState`,
 * `MULTI_RESIZE_TARGET_ID` — is in `core/selection`, and stays there. The
 * layering is `core` → `affordances` → `tools` → `features`, and affordances
 * and tools both read the selection protocol, so it cannot move up here. That
 * is why this barrel covers two files rather than the whole subject.
 */
export type { SelectionContextValue } from './SelectionContext';
export {
  SelectionContextProvider,
  SelectionContextProviderIfRoot,
  useSelectionContext,
  usePublishSelection,
} from './SelectionContext';
export type {
  ComposeSelectionPoseOpts,
  SelectionHandlesLayerOpts,
  SelectionHandleStyle,
  SelectionOutlineLayerOpts,
  SelectionOverlayLayerOpts,
} from './overlay';
export {
  composeSelectionPose,
  createSelectionHandlesLayer,
  createSelectionOutlineLayer,
  createSelectionOverlayLayer,
} from './overlay';
