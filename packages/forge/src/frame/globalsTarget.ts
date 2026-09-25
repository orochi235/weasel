/** What a setup's `applyGlobals` is handed: the element the globals apply to, and a way to style it alone. */
export interface GlobalsTarget {
  /** A frame document's root, or one story's host in the workshop document. */
  root: HTMLElement;
  /** A selector matching `root` and nothing else, so a rule written under it reaches only this target. */
  scope: string;
  /** Replaces the CSS forge keeps for this target. */
  style: (css: string) => void;
}

/** A target over `root`, owning one `<style>` in the document's head; `dispose` removes it. */
export function createGlobalsTarget(root: HTMLElement, scope: string): GlobalsTarget & { dispose: () => void } {
  const doc = root.ownerDocument;
  let style: HTMLStyleElement | null = null;
  return {
    root,
    scope,
    style(css) {
      if (!style) {
        style = doc.createElement('style');
        style.setAttribute('data-fg-globals', scope);
        doc.head.append(style);
      }
      style.textContent = css;
    },
    dispose() {
      style?.remove();
      style = null;
    },
  };
}
