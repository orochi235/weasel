import type { IconComponent } from '../chrome/types';

/**
 * A tool a trial can be in. labkit's own — core's `ToolsApi` carries hotkey
 * slots, ambient tools, eligibility tiers and canvas overlay layers, all bound
 * to the gesture dispatcher, and a labkit instrument is an arbitrary canvas or
 * DOM tree rather than a weasel scene.
 */
export interface TrialTool {
  id: string;
  label: string;
  icon: IconComponent;
  /** Shown in the tooltip. Not bound here — the instrument owns its keymap. */
  shortcut?: string;
  /** Presentation grouping in the palette. Ungrouped tools sort after grouped. */
  group?: string;
}

/** What an instrument declares to get a palette region. */
export interface ToolCapability {
  tools: TrialTool[];
  /** Which tool a fresh trial starts in. Defaults to the first. */
  initial?: string;
}
