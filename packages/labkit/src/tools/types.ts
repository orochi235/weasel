import type { IconSpec } from '@weasel-js/icons';
import type { MenuShortcut } from '@weasel-js/menu';
import type { ToolOptions } from '@weasel-js/routing';

/**
 * A tool a trial can be in. labkit's own — core's `ToolsApi` carries hotkey
 * slots, ambient tools, eligibility tiers and canvas overlay layers, all bound
 * to the gesture dispatcher, and a labkit instrument is an arbitrary canvas or
 * DOM tree rather than a weasel scene.
 */
export interface TrialTool {
  id: string;
  label: string;
  icon: IconSpec;
  /** Shown in the tooltip, written for the platform it runs on. Not bound here — the instrument owns its keymap. */
  shortcut?: MenuShortcut;
  /** Shown but cannot be chosen. */
  disabled?: boolean;
  /** Why it is disabled, read in its tooltip while it is. */
  disabledReason?: string;
  /** Presentation grouping in the palette: a group's tools sit together where its first one is. */
  group?: string;
  /** Its options, which the lab's options palette draws while it is the active tool and keeps in the lab's records.
   *  Shared keys work as they do for a canvas's tools. */
  options?: ToolOptions;
}

/** What an instrument declares to get a palette region. */
export interface ToolCapability {
  tools: TrialTool[];
  /** Which tool a fresh trial starts in. Defaults to the first. */
  initial?: string;
}
