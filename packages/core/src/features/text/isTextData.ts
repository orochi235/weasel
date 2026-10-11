/**
 * The kit's one answer to "is this node text?": its data carries a string
 * `text`. Routing, the `textEdit` dep, and `useSceneTextEdit` all ask it.
 */
export function isTextData(data: unknown): data is { text: string } {
  return typeof data === 'object' && data !== null
    && typeof (data as { text?: unknown }).text === 'string';
}
