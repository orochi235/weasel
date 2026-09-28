/** Published entry points, keyed by their `dist/<key>.js` name; read by both build configs. */
const shims = [
  'math',
  'move',
  'resize',
  'insert',
  'clipboard',
  'clone',
  'patterns-builtin',
  'renderer',
  'routing',
  'test-seams',
] as const;

export const entries: Record<string, string> = {
  index: 'src/index.ts',
  ...Object.fromEntries(shims.map((s) => [s, `src/import-shims/${s}.ts`])),
};
