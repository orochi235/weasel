import type { SceneCanvasProps } from './props';

type Props = SceneCanvasProps<unknown, string, unknown>;

/** Every prop `<SceneCanvas>` reads itself instead of handing to `<Canvas>`. */
const OWN_PROPS = [
  'scene', 'geometry', 'poseDescriptor', 'selectTool', 'insertNodeFactories', 'insertPaint',
  'ingestion', 'layoutDropTarget', 'reflowTransition', 'poseTransition', 'geometryProjection', 'routing',
  'selection', 'selectionOptions', 'selectable', 'tools', 'features', 'enableKeybindings',
  'claimKeys', 'enableGestureDispatcher', 'onToolsCreated', 'defaultTools', 'toolOptions',
  'initialActiveTool', 'ambient', 'versionCheck', 'longPress', 'viewport', 'layers', 'actions',
  'tune', 'bindingOverrides', 'describeKind', 'animator', 'views', 'children', 'debug', 'alphaFor', 'layerVisibility',
  'layerOrder', 'isPointerInteractive', 'isolatedGroup', 'onDoubleClick', 'onClick', 'onHover', 'chromeVisibility', 'modes',
  'pathEdit', 'defaultPathEdit', 'getFocused', 'cursorCoordsHud', 'pickHud', 'modalityHud', 'view',
  'onViewChange', 'defaultView', 'viewBounds', 'redrawOn', 'snap',
] as const satisfies readonly (keyof Props)[];

/** The props `<SceneCanvas>` passes through to its `<Canvas>`: all but its own. */
export function canvasPassThrough<P extends object>(props: P): Omit<P, (typeof OWN_PROPS)[number] | 'presetSource'> {
  const rest = { ...props } as Record<string, unknown>;
  for (const key of OWN_PROPS) delete rest[key];
  delete rest.presetSource;
  return rest as Omit<P, (typeof OWN_PROPS)[number] | 'presetSource'>;
}
