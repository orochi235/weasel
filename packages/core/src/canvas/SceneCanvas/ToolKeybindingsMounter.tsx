import { useKeybindings } from 'tools/useKeybindings';
import type { ToolsApi } from '../../tools/overlayBinding';
import type { CanvasExtensionApi } from '../canvasExtension';
import { useContributionRoles, type VersionCheck } from './useContributionRoles';

/**
 * Mounts `useKeybindings`, whose `tool.activate` / `tool.offhand` /
 * `tool.resetToDefault` registrations land in this canvas's scope.
 *
 * Two calls: the hook snapshots the initial active tool for
 * Escape-returns-to-default, so the internal and consumer-supplied `ToolsApi`
 * each need their own instance and the hook count has to stay stable across
 * the takeover branch.
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
  // Entry-owned roles live here and not in the tool hooks because the hooks
  // run above the provider. Not gated on `enableKeybindings` — these back
  // wheel and pointer bindings too, not just keys.
  useContributionRoles(toolsTakeover ?? internalTools, canvasApi, versionCheck);
  return null;
}
