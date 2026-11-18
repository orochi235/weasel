/** The keys held as a `Checkbox` or a `Switch` changed: Alt turns a switch in a list of them into a solo (ui-input's
 *  `soloChanges`). */
export interface ToggleModifiers {
  alt: boolean;
}

/** What `event` says was held, from the click that changed a checkbox or switch: a pointer's, or the one a key
 *  press makes, which carries the key's modifiers. */
export const modifiersOf = (event: { altKey?: boolean } | undefined): ToggleModifiers => ({ alt: event?.altKey === true });
