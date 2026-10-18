/**
 * Spiro curves: a curve drawn by its on-curve points alone, solved by
 * `@weasel-js/geom`'s `solveSpiro`. A spiro node keeps its solved curve on
 * `data.path` and its points' kinds on `data.representation`.
 *
 * @packageDocumentation
 */
export { spiroPreset } from './spiroPreset';
export { useSpiroTool, type UseSpiroToolOptions } from './useSpiroTool';
export { releaseSpiroAction, setSpiroKindAction } from './spiroCommands';
export { spiroExtension, spiroRepresentation } from './spiroRepresentation';
export { spiroMarker } from './spiroMarkers';
export { createSpiroPreviewLayer, type CreateSpiroPreviewLayerOptions, type SpiroPreviewState } from './spiroPreviewLayer';
export {
  asSpiro, respiro, respiroWithKind, SPIRO_FORM, spiroContours, spiroEditPath, spiroNodeData, spiroOf, withoutSpiro,
  type SpiroShape,
} from './spiroShape';
