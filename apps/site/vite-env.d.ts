/// <reference types="vite/client" />

declare module '*.png' {
  const src: string;
  export default src;
}

/** Provided by the `demo-timestamps` vite plugin (`scripts/vite-demo-timestamps.ts`).
 *  Keyed by demo source path relative to repo root. */
declare module 'virtual:demo-timestamps' {
  const timestamps: Record<string, { created: string; lastModified: string }>;
  export default timestamps;
}

/** Provided by the `demo-sources` vite plugin (`scripts/vite-demo-sources.ts`).
 *  Keyed by demo source path relative to repo root; each value is the demo's
 *  code-panel tabs, its own TSX first. Contents load on demand. */
declare module 'virtual:demo-sources' {
  const sources: Record<string, import('./registry').DemoSourceTab[]>;
  export default sources;
}

/** Provided by the `changelogs` vite plugin (`scripts/vite-changelogs.ts`).
 *  Every published release, newest first. */
declare module 'virtual:changelogs' {
  const releases: import('../shared/releases').Release[];
  export default releases;
}
