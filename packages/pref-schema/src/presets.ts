/** One feature preset as data: what it holds by id, for a tool that lists or rearranges presets. Core's
 *  `describePresets` makes these from a canvas's presets. */
export interface PresetDescription {
  id: string;
  label: string;
  /** The package that ships it, as `describePresets` was told. */
  package: string;
  /** It has a role beyond actions, built-in tools, and includes, so its parts only work together. */
  atom: boolean;
  /** Its own action ids, in registration order. */
  actions: readonly string[];
  /** Its own tools' ids: built-ins with their sets opened, then tools of its own. */
  tools: readonly string[];
  /** The ids of the presets it includes. */
  includes: readonly string[];
}
