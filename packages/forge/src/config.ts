import type { LabContribution, LabPage } from '@weasel-js/labkit';
import type { Theme } from '@weasel-js/theme';
import type { ControlRenderer } from '@weasel-js/labkit/config';
import type { FrameSetup } from './frame/FrameController';
import type { Globals } from './protocol/messages';
import type { GlobalDeclarations } from './shell/globals';
import type { Library } from './story/library';

/** A shell config module: what the workshop adds to the lab. Only the workshop page imports it. */
export interface ShellConfig {
  /** The workshop's name, in its header and as the document title. Default `weaselforge`. The served page reads
   *  it from this module's source, so write it as a string or a `const` of this file; a computed one titles the
   *  page only once the workshop has loaded. */
  title?: string;
  /** Whether the lab offers the CSS Vars panel and its header toggle. Default true; the panel starts hidden. */
  cssVars?: boolean;
  labChrome?: readonly LabContribution[];
  controls?: Record<string, ControlRenderer>;
  /** Globals the lab's header sets for every story, each pinnable per trial. Frames apply them with `applyGlobals`. */
  globals?: GlobalDeclarations;
  /** The theme the workshop's own chrome takes at the lab's current globals, so a global can restyle the workshop
   *  as well as the stories. Default: labkit's. */
  labTheme?: (globals: Globals) => Theme;
  /** The project's libraries, each a stretch of file path and the label its stories carry in the tree's package
   *  filter, on index pages, and in Get Info. A story under none of them takes its title's first segment. */
  libraries?: readonly Library[];
  /** The project's other labs, offered in the workshop's title menu. */
  pages?: readonly LabPage[];
  /** Which of `pages` the workshop is, when the URL alone cannot say, as across dev servers on different ports. */
  path?: string;
  /** What a Pixels capture may load besides the dev server's own pages, such as the origins of a web-font service
   *  the stories' fonts come from. Every other request a capture makes is refused. The dev server reads the list
   *  from this module's source, as it does `title`, so write each origin as a string. */
  capture?: { allowOrigins?: readonly string[] };
  /** The workshop's lenses. `modeGlobal` names the global holding the color mode, which a lens's opposite-mode
   *  comparison flips through its declaration's `opposite`. Default `mode`. */
  loupe?: { modeGlobal?: string };
}

/** A frame config module's default export. The workshop page imports it as well as every frame document, so CSS it imports reaches both; the plugin's `frameStyles` is for CSS meant for frames alone. */
export function defineFrameConfig(config: FrameSetup): FrameSetup {
  return config;
}

/** A shell config module's default export. */
export function defineShellConfig(config: ShellConfig): ShellConfig {
  return config;
}
