/** How a focus change came about. */
export interface FocusScopeOptions {
  /** Whether the target shows its focus ring: the scope's `:focus-visible`. Keyboard moves show one, a press does
   *  not. Default `false` for {@link FocusScope.focus}, `true` for {@link FocusScope.moveFocus}. */
  readonly visible?: boolean;
}

/**
 * Keyboard focus over a set of targets, whatever draws them: a HUD's widgets and a DOM subtree's elements both
 * answer it, so code that moves or reads focus is written once for either.
 */
export interface FocusScope<T> {
  /** The target holding keyboard focus, or null. One per scope. */
  readonly focused: T | null;
  /** Whether the focused target shows its focus ring. */
  readonly focusVisible: boolean;
  /** Focus `target`, or blur with `null`. Returns whether `target` now holds focus: false when it is not in this
   *  scope or cannot take focus, and focus is then unchanged. */
  focus(target: T | null, options?: FocusScopeOptions): boolean;
  /** Move focus one step through {@link tabOrder}, passing over a target that will not take focus, and return the
   *  one that did. From nothing, `'next'` lands on the first target and `'prev'` on the last; past either end the
   *  scope blurs and returns null, which is where focus leaves it. */
  moveFocus(direction: 'next' | 'prev', options?: FocusScopeOptions): T | null;
  /** The targets Tab visits, in order. */
  tabOrder(): T[];
  /** Run `fn` whenever the focused target changes. Returns an unsubscribe. */
  subscribeFocus(fn: (focused: T | null) => void): () => void;
}
