import type { HarfBuzzModule } from 'harfbuzzjs';

export * from 'harfbuzzjs';
/** Binds every export to `module`; call once, before any other. */
export function init(module: HarfBuzzModule): void;
