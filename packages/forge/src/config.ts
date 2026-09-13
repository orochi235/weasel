import type { LabContribution } from '@weasel-js/labkit';
import type { ControlRenderer } from '@weasel-js/labkit/config';
import type { FrameSetup } from './frame/FrameController';
import type { GlobalDeclarations } from './shell/globals';

/** A shell config module: what the workshop adds to the lab. Only the workshop page imports it. */
export interface ShellConfig {
  labChrome?: readonly LabContribution[];
  controls?: Record<string, ControlRenderer>;
  /** Globals the lab's header sets for every story, each pinnable per trial. Frames apply them with `applyGlobals`. */
  globals?: GlobalDeclarations;
}

/** A frame config module's default export. Only frame documents import it, so its CSS stays out of the workshop. */
export function defineFrameConfig(config: FrameSetup): FrameSetup {
  return config;
}

/** A shell config module's default export. */
export function defineShellConfig(config: ShellConfig): ShellConfig {
  return config;
}
