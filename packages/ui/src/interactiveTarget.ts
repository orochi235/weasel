const INTERACTIVE = [
  'button', 'input', 'select', 'textarea', 'a[href]', '[contenteditable=""]', '[contenteditable="true"]',
  '[role="button"]', '[role="checkbox"]', '[role="switch"]', '[role="menuitem"]', '[role="link"]',
].join(',');

/**
 * Whether `target` sits in a control of its own somewhere inside `host` — a
 * toggle in a list row. The host's handlers leave such an event to the
 * control, so a row's press, click and keys never swallow its controls'.
 */
export function isInControlWithin(target: EventTarget | null, host: Element): boolean {
  if (!(target instanceof Element)) return false;
  const control = target.closest(INTERACTIVE);
  return control !== null && control !== host && host.contains(control);
}
