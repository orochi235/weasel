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
