/**
 * The containers of every text editor a host mounted with `useSceneTextEdit`.
 * `<SceneCanvas>`'s own editor stands down for a canvas inside one, so a host
 * that wires its own never gets a second overlay on the same double-click.
 */
const containers = new Map<symbol, HTMLElement>();

/** Record `container` as holding a host's editor until the disposer runs. */
export function registerHostTextEditor(container: HTMLElement): () => void {
  const key = Symbol('textEditor');
  containers.set(key, container);
  return () => {
    containers.delete(key);
  };
}

/** Whether a host's editor holds `el`. */
export function hostTextEditorHolds(el: Element): boolean {
  for (const c of containers.values()) if (c.contains(el)) return true;
  return false;
}
