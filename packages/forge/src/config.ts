import type { LabContribution, LabPage } from '@weasel-js/labkit';
import type { Theme } from '@weasel-js/theme';
import type { ControlRenderer } from '@weasel-js/labkit/config';
import type { FrameSetup } from './frame/FrameController';
import type { Globals } from './protocol/messages';
import type { GlobalDeclarations } from './shell/globals';

/** A shell config module: what the workshop adds to the lab. Only the workshop page imports it. */
export interface ShellConfig {
  labChrome?: readonly LabContribution[];
  controls?: Record<string, ControlRenderer>;
  /** Globals the lab's header sets for every story, each pinnable per trial. Frames apply them with `applyGlobals`. */
  globals?: GlobalDeclarations;
  /** The theme the workshop's own chrome takes at the lab's current globals, so a global can restyle the workshop
   *  as well as the stories. Default: labkit's. */
  labTheme?: (globals: Globals) => Theme;
  /** The project's other labs, offered in the workshop's title menu. */
  pages?: readonly LabPage[];
  /** Which of `pages` the workshop is, when the URL alone cannot say, as across dev servers on different ports. */
  path?: string;
}

/** A frame config module's default export. Only frame documents import it, so its CSS stays out of the workshop. */
export function defineFrameConfig(config: FrameSetup): FrameSetup {
  return config;
}

/** A shell config module's default export. */
export function defineShellConfig(config: ShellConfig): ShellConfig {
  return config;
}
