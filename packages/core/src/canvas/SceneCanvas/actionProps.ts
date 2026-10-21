import type { ActionsProp, ActionTunings, BindingOverrides } from '@weasel-js/routing';

/** The `<SceneCanvas>` props that change the actions and bindings a canvas has. */
export interface SceneCanvasActionProps {
  /**
   * Tune actions on this canvas without restating them, keyed by action id:
   * `params` every invocation starts from, and `bindings` added beside the
   * action's own. A tuning applies to whichever descriptor holds the id, a
   * preset's or a tool's. Pass a stable object; a params thunk is read on
   * every call. See the core README ("Tuning an action").
   */
  tune?: ActionTunings;

  /**
   * Replace or remove bindings by binding id, on actions and contributions
   * alike: a route string (`'[*:*] keyDown(=) +mod'`), a spec (`key('Mod+=')`),
   * or `null` to unbind. Pass a stable object.
   */
  bindingOverrides?: BindingOverrides;

  /**
   * Replace, add or mute whole action descriptors. Pass `null` to disable
   * all defaults. To change a built-in's params or add a key, use `tune`.
   */
  actions?: ActionsProp;
}
