const NOT_TEXT = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

/** Whether `target` is where the user types text, so the browser's own undo
 *  applies to it. A slider or a checkbox is an input and is not. */
export function editsText(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLTextAreaElement || target.isContentEditable) return true;
  // jsdom has no `isContentEditable`.
  const editable = target.getAttribute('contenteditable');
  if (editable !== null && editable !== 'false') return true;
  return target instanceof HTMLInputElement && !NOT_TEXT.has(target.type);
}
