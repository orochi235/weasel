import { useKeybindings } from 'tools/useKeybindings';
import type { ToolsApi } from '../../tools/overlayBinding';
import type { CanvasExtensionApi } from '../canvasExtension';
import { useContributionRoles, type VersionCheck } from './useContributionRoles';

/**
 * Mounts the gesture dispatcher on this canvas's input scope.
 *
 * Accepts `selectionRef`, `boundsOf`, `pickEvery`, and `viewRef` so
 * it can wire `affordanceAt` + `classifyTarget` thunks into the dispatcher.
 * These thunks convert client coords → world coords via the canvas rect + view,
 * then classify the pointer position against affordances and scene bodies.
 */
/**
 * Mounts `useKeybindings`, whose `tool.activate` / `tool.offhand` /
 * `tool.resetToDefault` registrations land in this canvas's scope.
 *
 * Two calls, mirroring the pair that used to live in `SceneCanvasInner`: the
 * hook snapshots the initial active tool for Escape-returns-to-default, so
 * the internal and consumer-supplied `ToolsApi` each need their own instance
 * and the hook count has to stay stable across the takeover branch.
 */
export function ToolKeybindingsMounter({
  internalTools,
  toolsTakeover,
  enableKeybindings,
  isToolEligible,
  canvasApi,
  versionCheck,
}: {
  internalTools: ToolsApi;
  toolsTakeover?: ToolsApi;
  enableKeybindings: boolean;
  isToolEligible: (toolId: string) => boolean;
  canvasApi: CanvasExtensionApi | null;
  versionCheck?: VersionCheck;
}) {
  useKeybindings(internalTools, {
    disable: !!toolsTakeover || !enableKeybindings,
    isToolEligible,
  });
  useKeybindings(toolsTakeover ?? internalTools, {
    disable: !toolsTakeover || !enableKeybindings,
    isToolEligible,
  });
  // Entry-owned roles: actions (polygon.adjustSides, …), deps and `attach`.
  // Same reason this lives here and not in the tool hooks: the hooks run above
  // the provider. Not gated on `enableKeybindings` — these back wheel and
  // pointer bindings too, not just keys.
  useContributionRoles(toolsTakeover ?? internalTools, canvasApi, versionCheck);
  return null;
}
