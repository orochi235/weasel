import type { CanvasProps } from '../canvasProps';
import type { SceneCanvasProps } from './props';

type Props = SceneCanvasProps<unknown, string, unknown>;

/** Every prop `<SceneCanvas>` reads itself instead of handing to `<Canvas>`. */
const OWN_PROPS = [
  // `<Canvas>` props SceneCanvas sets itself and its props type leaves out, dropped should one arrive untyped: the
  // spread comes last, so one passed through would replace what the canvas wires.
  'gestureSource', 'previewPoseExtra', 'boundsOfPose', 'boundsOf', 'adapter', 'viewState', 'getIsVisible',
  'contentVersion',
  'scene', 'composition', 'geometry', 'poseDescriptor', 'selectTool', 'insertNodeFactories',
  'ingestion', 'reflowTransition', 'poseTransition', 'geometryProjection', 'routing',
  'selection', 'selectionOptions', 'selectable', 'tools', 'features', 'enableKeybindings',
  'claimKeys', 'enableGestureDispatcher', 'onToolsCreated', 'defaultTools', 'toolOptions', 'toolOptionValues',
  'defaultActiveTool', 'ambient', 'versionCheck', 'longPress', 'viewport', 'layers', 'actions',
  'tune', 'bindingOverrides', 'describeKind', 'animator', 'views', 'children', 'debug', 'alphaFor', 'layerVisibility',
  'layerOrder', 'isPointerInteractive', 'enteredGroup', 'onDoubleClick', 'onClick', 'onHover', 'chromeVisibility', 'modes',
  'pathEdit', 'defaultPathEdit', 'getFocused', 'cursorCoordsHud', 'pickHud', 'modalityHud', 'view',
  'onViewChange', 'defaultView', 'viewBounds', 'redrawOn', 'snap', 'worker', 'workerTimeout', 'clock', 'sampleLayers',
] as const satisfies readonly (keyof Props | keyof CanvasProps<unknown>)[];

/** The props `<SceneCanvas>` passes through to its `<Canvas>`: all but its own. */
export function canvasPassThrough<P extends object>(props: P): Omit<P, (typeof OWN_PROPS)[number]> {
  const rest = { ...props } as Record<string, unknown>;
  for (const key of OWN_PROPS) delete rest[key];
  return rest as Omit<P, (typeof OWN_PROPS)[number]>;
}
