// Duck-typed, not `instanceof`: an event from an iframe's document carries that window's `Element`.
/** Whether `target` is an element, from this window's document or any other. */
export function isElement(target: EventTarget | null | undefined): target is Element {
  return typeof target === 'object' && target !== null && (target as Partial<Node>).nodeType === 1;
}

/** Whether `target` is an `<input>`, from this window's document or any other. */
export function isInputElement(target: EventTarget | null | undefined): target is HTMLInputElement {
  return isElement(target) && target.tagName === 'INPUT';
}
