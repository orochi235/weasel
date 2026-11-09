import type { IconSpec } from '@weasel-js/icons';

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
  /** Shown in the tooltip. Not bound here — the instrument owns its keymap. */
  shortcut?: string;
  /** Shown but cannot be chosen. */
  disabled?: boolean;
  /** Why it is disabled, read in its tooltip while it is. */
  disabledReason?: string;
  /** Presentation grouping in the palette: a group's tools sit together where its first one is. */
  group?: string;
}

/** What an instrument declares to get a palette region. */
export interface ToolCapability {
  tools: TrialTool[];
  /** Which tool a fresh trial starts in. Defaults to the first. */
  initial?: string;
}
