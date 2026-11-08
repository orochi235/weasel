import type { RenderLayer } from 'core/layers/render';

/** The `<SceneCanvas>` prop that says what its `colorAt` dep samples. */
export interface SceneCanvasSampleProps {
  /**
   * The layers the `colorAt` dep redraws at a point to say what color is
   * there, bottom first — the same list a loupe's vector mode re-renders.
   * Default: the scene's own layers, as the canvas shows them, annotation
   * layers left out. Never the chrome, overlays or ambient contributions
   * painted over them. Registering a `colorAt` dep of your own replaces the
   * whole answer.
   */
  sampleLayers?: readonly RenderLayer<unknown>[];
}
