import {
  BUILTIN_TOOL_IDS,
  SceneCanvas,
  type SceneCanvasApi,
  type SelectionApi,
  type ToolsApi,
  transformPath,
  useCanvasSize,
  type UseSceneTextEditReturn,
  useShapeBuilderTool,
  useSliceTool,
  type View,
  workspaceTintLayer
} from '@weasel-js/core';
import { unpackSvgFiles } from '@weasel-js/svg';
import { SceneGradientHandles, ToastRegion } from '@weasel-js/ui';
import { type ReactElement, type RefObject, useCallback, useMemo } from 'react';
import { BooleansAdapterPublisher, CreateOutlinesAdapterPublisher } from './adapterPublishers';
import { PAPER_PRESETS } from './docPersistence';
import type { DrawScene, WeaselDrawData, WeaselDrawLayer, WeaselDrawPose } from './drawDocument';
import { useInsertPaint } from './insertPaint';
import { ModeBreadcrumb } from './modality/chrome/ModeBreadcrumb';
import { useCanvasModes, useModeTargetLabel } from './modality/useCanvasModes';
import type { UseModalityReturn } from './modality/useModality';
import { useModeId } from './modality/useModeId';
import { OpacityHud } from './opacityScrub/OpacityHud';
import { useOpacityScrub } from './opacityScrub/useOpacityScrub';
import { usePaperLayer } from './pageLayers';
import type { PaperSizeKey } from './paperSizes';
import { reportPasteOmissions } from './pasteOmissions';
import { clipboardJsonReviver } from './persistence';
import { TextEditDepPublisher } from './TextEditDepPublisher';
import { useColorContext } from './tools/colorContext';
import { useEditorAmbient } from './useEditorAmbient';
import { useGrid } from './useGrid';
import { usePageFit } from './usePageFit';

// OS-dropped and pasted SVG files unpack into real scene nodes rather than one embedded-image
// node. `clipboard.reviver` revives typed-array node data carried by weasel-JSON clipboard
// payloads. Module const: SceneCanvas keys its dep wiring off the prop identity.
const DRAW_INGESTION = {
  svg: { unpack: unpackSvgFiles },
  clipboard: { reviver: clipboardJsonReviver, onOmitted: reportPasteOmissions },
};

export interface WorkspaceProps {
  scene: DrawScene;
  selection: SelectionApi;
  modality: UseModalityReturn;
  /** The `.wd-canvas-host` element, which the text-edit overlay and the toasts mount in. */
  hostRef: RefObject<HTMLDivElement | null>;
  textEdit: UseSceneTextEditReturn;
  view: View;
  onViewChange: (view: View) => void;
  paperSize: PaperSizeKey;
  backgroundColor: string;
  onToolsCreated: (tools: ToolsApi) => void;
  onCanvas: (api: SceneCanvasApi | null) => void;
  openPrefs: () => void;
  openPalette: () => void;
}

/**
 * The workspace: the striped area holding the canvas, which fills it, with the document page
 * drawn on the canvas as a world-space layer.
 */
export function Workspace(props: WorkspaceProps): ReactElement {
  const { scene, selection, modality, hostRef, textEdit, view, onViewChange, backgroundColor } = props;
  const { machine } = modality;
  const page = PAPER_PRESETS[props.paperSize];
  const hostDims = useCanvasSize(hostRef);
  const recenter = usePageFit(hostDims, props.paperSize, page, onViewChange);

  const paperLayer = usePaperLayer(page, backgroundColor);
  const grid = useGrid(page, backgroundColor);
  // The mode tint covers the workspace around the page, not the page itself.
  // Bolder than the modes' own 0.12 so it reads through the stripes.
  const workspaceTint = useMemo(() => workspaceTintLayer({
    registry: machine.registry,
    page: () => ({ x: 0, y: 0, width: page.width, height: page.height }),
    intensity: 0.4,
  }), [machine, page.width, page.height]);

  const modeId = useModeId(machine);
  const targetLabel = useModeTargetLabel(machine, scene);
  const modes = useCanvasModes(machine, scene, selection);
  const ambient = useEditorAmbient({
    scene,
    selection,
    modeKeys: modes.keys,
    grid: grid.commands,
    view,
    setView: onViewChange,
    openPrefs: props.openPrefs,
    openPalette: props.openPalette,
  });
  const insertPaint = useInsertPaint();
  const sliceTool = useSliceTool();
  const shapeBuilderTool = useShapeBuilderTool();
  const { tool: opacityScrubTool, percent: opacityScrubPercent } = useOpacityScrub({
    scene: scene as unknown as Parameters<typeof useOpacityScrub>[0]['scene'],
    selection,
  });

  // The overlay draws the node being edited, so the scene layer must not draw it too. Composed
  // over the modality scoping dim: an isolation-dimmed node can also be the one editing.
  const scopingAlphaFor = modality.scopingDim.alphaFor;
  const editingId = textEdit.editingId;
  const alphaFor = useCallback(
    (id: string) => (id === editingId ? 0 : scopingAlphaFor(id)),
    [editingId, scopingAlphaFor],
  );
  const redrawOnScoping = useMemo(() => [modality.scopingDim], [modality.scopingDim]);

  // On-canvas gradient handles edit one node's one paint; which paint is the side the swatches
  // have focus on.
  const colors = useColorContext();
  const selectedIds = selection.get();
  const soleSelectedId = selectedIds.length === 1 ? selectedIds[0] : null;

  return (
    <div
      className="wd-canvas-host"
      ref={hostRef}
      onDoubleClick={textEdit.onDoubleClick}
      data-mode={modeId}
    >
      <OpacityHud percent={opacityScrubPercent} />
      <ModeBreadcrumb
        mode={machine.registry.byId(modeId)}
        targetLabel={targetLabel}
        onExit={() => machine.exitMode()}
        onCommit={() => machine.commitMode()}
        onCancel={() => machine.cancelMode()}
      />
      {hostDims.width > 0 && hostDims.height > 0 && (
        <SceneCanvas<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose> features={['draw']}
          claimKeys
          ref={props.onCanvas}
          ambient={ambient}
          width={hostDims.width}
          height={hostDims.height}
          view={view}
          onViewChange={onViewChange}
          scene={scene}
          selection={selection}
          defaultTools={BUILTIN_TOOL_IDS}
          tools={{ slice: sliceTool, shapeBuilder: shapeBuilderTool, opacityScrub: opacityScrubTool }}
          ingestion={DRAW_INGESTION}
          insertPaint={insertPaint}
          // Pick on the drawn shape, not the bounding box: clicking the blank right half of a
          // text box, or the notch of a star, should reach whatever is behind it.
          geometry={{ picking: 'shape' }}
          viewport={{ pinchZoom: true, recenter }}
          cursorCoordsHud
          pickHud
          modalityHud
          onToolsCreated={props.onToolsCreated}
          selectTool={grid.snap ? { snap: grid.snap } : undefined}
          toolOptions={grid.snapPoint ? { snapPoint: grid.snapPoint } : undefined}
          layers={{
            paper: { layer: paperLayer, before: 'grid' },
            ...(grid.layer ? { grid: { layer: grid.layer } } : {}),
            modeTint: { layer: workspaceTint, after: 'grid' },
          }}
          decorationLayer={modality.decorationLayer}
          alphaFor={alphaFor}
          redrawOn={redrawOnScoping}
          isPointerInteractive={modality.scopingDim.isPointerInteractive}
          onDoubleClick={modes.onDoubleClick}
          modes={machine.registry}
          pathEdit={modes.pathEdit}
          geometryProjection={{
            transform: (node, m) => {
              const data = node.data as WeaselDrawData;
              if (!data.path) return null; // text / no geometry — kit leaves data alone
              return { ...data, path: transformPath(data.path, m) };
            },
          }}
        >
          <BooleansAdapterPublisher scene={scene} selection={selection} />
          <CreateOutlinesAdapterPublisher scene={scene} selection={selection} />
          <TextEditDepPublisher edit={textEdit} />
        </SceneCanvas>
      )}
      {/* In the workspace, not the viewport: a fixed region sits outside the theme and over the status bar. */}
      {hostRef.current && <ToastRegion portalContainer={hostRef.current} />}
      <SceneGradientHandles
        scene={scene}
        containerRef={hostRef}
        nodeId={soleSelectedId}
        slot={colors.focused}
        view={view}
      />
    </div>
  );
}
