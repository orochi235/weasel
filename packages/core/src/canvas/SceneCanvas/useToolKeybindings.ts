import type { ModeRegistry } from '@weasel-js/modes';
import { useKeybindings } from 'tools/useKeybindings';
import type { ToolsApi } from '../../tools/overlayBinding';
import type { CanvasExtensionApi } from '../canvasExtension';
import type { SurfaceContribution } from '../surfaceContribution';
import { useContributionRoles, type VersionCheck } from './useContributionRoles';

/**
 * Runs `useKeybindings`, whose `tool.activate` / `tool.offhand` /
 * `tool.resetToDefault` registrations land in this canvas's scope.
 *
 * Two calls: the hook snapshots the initial active tool for
 * Escape-returns-to-default, so the internal and consumer-supplied `ToolsApi`
 * each need their own instance and the hook count has to stay stable across
 * the takeover branch.
 */
export function useToolKeybindings({
  internalTools,
  toolsTakeover,
  surface,
  enableKeybindings,
  modes,
  canvasApi,
  versionCheck,
}: {
  internalTools: ToolsApi;
  toolsTakeover?: ToolsApi;
  /** The surface's own entries installed beside a takeover. */
  surface?: readonly SurfaceContribution[];
  enableKeybindings: boolean;
  modes?: ModeRegistry;
  canvasApi: CanvasExtensionApi | null;
  versionCheck?: VersionCheck;
}): void {
  useKeybindings(internalTools, {
    disable: !!toolsTakeover || !enableKeybindings,
    modes,
  });
  useKeybindings(toolsTakeover ?? internalTools, {
    disable: !toolsTakeover || !enableKeybindings,
    modes,
  });
  // Entry-owned roles live here and not in the tool hooks because the hooks
  // run above the provider. Not gated on `enableKeybindings` — these back
  // wheel and pointer bindings too, not just keys.
  useContributionRoles(toolsTakeover ?? internalTools, canvasApi, versionCheck, surface);
}
