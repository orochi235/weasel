// `@weasel-js/core/render-worker` — what a render worker's module imports: the host that paints a
// scene into the canvas `<SceneViewCanvas worker>` hands it. Kept off the main entry so a worker
// bundle reaches no component and no stylesheet.
export { hostSceneRender, serveSceneRender } from '../canvas/renderWorker/serveSceneRender';
export type { RenderPort, SceneRenderServeOptions } from '../canvas/renderWorker/serveSceneRender';
export type { SceneMirrorOptions } from '../canvas/renderWorker/sceneMirror';
