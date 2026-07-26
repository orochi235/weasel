/**
 * Ambient types for the CSS Modules core imports (PickHud, ModalityHud,
 * ToolDebugOverlay).
 *
 * Core carried no `.d.ts` of its own until it moved into `packages/core/`.
 * These declarations — and `vite/client`'s `ImportMeta.env` — were reaching it
 * by accident, through `apps/site/vite-env.d.ts` landing in the same
 * root-tsconfig program. Building core in isolation broke that leak, which is
 * the point: a published package must type-check without a demo app present.
 */
declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}
