import {
  BUILTIN_TOOLS,
  withoutTools,
  type Measurements,
  measurementsContribution,
  measureEndSource,
  SceneCanvas,
  type SceneCanvasApi,
  type SelectionApi,
  type PlacedPage,
  type ToolsApi,
  transformPath,
  type UseSceneTextEditReturn,
  useMeasureTool,
  type View,
  workspaceTintLayer
} from '@weasel-js/core';
import { usePathToolsTools } from '@weasel-js/path-tools';
import { unpackSvgFiles } from '@weasel-js/svg';
import { SceneGradientHandles } from '@weasel-js/ui/components/GradientEditor';
import { MeasureReadout } from '@weasel-js/ui/components/MeasureReadout';
import { ToastRegion } from '@weasel-js/ui/components/Toast';
import { type ReactElement, type RefObject, useMemo } from 'react';
import { BooleansAdapterPublisher, CreateOutlinesAdapterPublisher, NoticesPublisher, ToolOptionsPublisher } from './adapterPublishers';
import type { DrawScene, WeaselDrawData, WeaselDrawLayer, WeaselDrawPose } from './drawDocument';
import { useInsertPaint } from './insertPaint';
import { ModeBreadcrumb } from './modality/chrome/ModeBreadcrumb';
import { canvasAlphaFor, useDrawEnteredGroup, useEnteredGroupLabel } from './modality/enteredGroup';
import { useCanvasModes, useModeTargetLabel } from './modality/useCanvasModes';
import type { UseModalityReturn } from './modality/useModality';
import { useModeId } from './modality/useModeId';
import { OpacityHud } from './opacityScrub/OpacityHud';
import { DrawPageStrip } from './pages/DrawPageStrip';
import { useOpacityScrub } from './opacityScrub/useOpacityScrub';
import { type DocPages, TextEditDepPublisher, usePaperLayer } from '@editor/index';
import { reportPasteOmissions } from './pasteOmissions';
import { clipboardJsonReviver } from './persistence';
import { useColorContext } from './tools/colorContext';
import { DRAW_FEATURES } from './drawFeatures';
import { LastOperation } from './ui/LastOperation';
import { DRAW_TUNE } from './constraintKeys';
import { useEditorAmbient } from './useEditorAmbient';
import { useGrid } from './useGrid';
import { DRAW_NODE_ROUTING } from './nodeKinds';
import { usePathOverlays } from './usePathOverlays';
import { useSymmetry } from './useSymmetry';
import { useSpacingHints } from './useSpacingHints';

/** Every built-in but the sticky tool, whose `background` and `padding` the
 *  document's SVG round trip does not carry. */
const DRAW_TOOLS = [withoutTools(BUILTIN_TOOLS, 'sticky')];

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
  /** Which measurement is picked; the measurements are nodes on the annotation layer. */
  measurements: Measurements;
  modality: UseModalityReturn;
  /** The `.wd-canvas-host` element, which the text-edit overlay and the toasts mount in. */
  hostRef: RefObject<HTMLDivElement | null>;
  textEdit: UseSceneTextEditReturn;
  view: View;
  onViewChange: (view: View) => void;
  /** The workspace's measured size, which the canvas fills. */
  hostDims: { width: number; height: number };
  pages: DocPages;
  /** The page the grid, the symmetry center and the mode tint go by: the one in view, or the last that was. */
  shownPage: Pick<PlacedPage, 'x' | 'y' | 'width' | 'height'>;
  /** Fits the view to the shown page, for `viewport.recenter`. */
  recenter: () => void;
  backgroundColor: string;
  onToolsCreated: (tools: ToolsApi) => void;
  onCanvas: (api: SceneCanvasApi | null) => void;
  openPrefs: () => void;
  openPalette: () => void;
}

/**
 * The workspace: the striped area holding the canvas, which fills it, with the document's pages
 * drawn on the canvas as a world-space layer, over the page tabs.
 */
export function Workspace(props: WorkspaceProps): ReactElement {
  const { scene, selection, modality, hostRef, textEdit, view, onViewChange, backgroundColor, hostDims, recenter } = props;
  const { machine } = modality;
  const page = props.shownPage;

  const paperLayer = usePaperLayer(props.pages.placed, backgroundColor);
  const grid = useGrid(page, backgroundColor);
  const spacingHints = useSpacingHints();
  const pathOverlays = usePathOverlays();
  const symmetry = useSymmetry(scene, page);
  const group = useDrawEnteredGroup(scene);
  const groupLabel = useEnteredGroupLabel(group, scene);
  const leaveAll = group.entered.leaveAll;
  const groupCrumb = useMemo(
    () => (groupLabel === null ? null : { label: groupLabel, onExit: leaveAll }),
    [groupLabel, leaveAll],
  );
  // The mode tint covers the workspace around the page, not the page itself.
  // Bolder than the modes' own 0.12 so it reads through the stripes.
  const workspaceTint = useMemo(() => workspaceTintLayer({
    registry: machine.registry,
    page: () => ({ x: page.x, y: page.y, width: page.width, height: page.height }),
    intensity: 0.4,
    fallback: group.tint,
  }), [machine, page.x, page.y, page.width, page.height, group.tint]);

  const modeId = useModeId(machine);
  const targetLabel = useModeTargetLabel(machine, scene);
  const modes = useCanvasModes(machine, scene, selection, modality.pathEdit);
  const ambient = useEditorAmbient({
    scene,
    selection,
    modes: modes.ambient,
    grid: grid.commands,
    pathOverlays: pathOverlays.contribution,
    symmetry,
    view,
    setView: onViewChange,
    openPrefs: props.openPrefs,
    openPalette: props.openPalette,
  });
  const insertPaint = useInsertPaint();
  const pathToolsTools = usePathToolsTools();
  const { measurements } = props;
  const measureTool = useMeasureTool({ measurements });
  const measureEntry = useMemo(
    () => measurementsContribution(scene as never, measurements),
    [scene, measurements],
  );
  const ambientEntries = useMemo(() => [...ambient, measureEntry], [ambient, measureEntry]);
  // Measurement ends, and the canvas's default path anchors, snap a gesture
  // within a few screen pixels; past them it takes the grid.
  const gridSource = grid.snapSource;
  const snap = useMemo(
    () => ({ sources: [...(gridSource ? [gridSource] : []), measureEndSource()] }),
    [gridSource],
  );
  const { tool: opacityScrubTool, percent: opacityScrubPercent } = useOpacityScrub({
    scene: scene as unknown as Parameters<typeof useOpacityScrub>[0]['scene'],
    selection,
  });

  const scopingAlphaFor = modality.scopingDim.alphaFor;
  const groupScope = group.scope;
  const editingId = textEdit.editingId;
  const alphaFor = useMemo(
    () => canvasAlphaFor(scopingAlphaFor, groupScope, editingId),
    [editingId, scopingAlphaFor, groupScope],
  );
  const redrawOnScoping = useMemo(
    () => [modality.scopingDim, modality.anchors, groupScope],
    [modality.scopingDim, modality.anchors, groupScope],
  );

  // On-canvas gradient handles edit one node's one paint; which paint is the side the swatches
  // have focus on.
  const colors = useColorContext();
  const selectedIds = selection.get();
  const soleSelectedId = selectedIds.length === 1 ? selectedIds[0] : null;

  return (
    <div className="wd-stage">
      <div
        className="wd-canvas-host"
        ref={hostRef}
        onDoubleClick={textEdit.onDoubleClick}
        data-mode={modeId}
      >
        <OpacityHud percent={opacityScrubPercent} />
        <MeasureReadout scene={scene as never} measurements={measurements} />
        <ModeBreadcrumb
          mode={machine.registry.byId(modeId)}
          targetLabel={targetLabel}
          group={groupCrumb}
          onExit={() => machine.exitMode()}
          onCommit={() => machine.commitMode()}
          onCancel={() => machine.cancelMode()}
        />
        {hostDims.width > 0 && hostDims.height > 0 && (
          <SceneCanvas<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose> features={[...DRAW_FEATURES, ...(spacingHints ? [spacingHints] : [])]}
            claimKeys
            aria-label="Drawing"
            ref={props.onCanvas}
            ambient={ambientEntries}
            width={hostDims.width}
            height={hostDims.height}
            view={view}
            onViewChange={onViewChange}
            scene={scene}
            routing={DRAW_NODE_ROUTING}
            selection={selection}
            defaultTools={DRAW_TOOLS}
            tools={{ ...pathToolsTools, measure: measureTool, opacityScrub: opacityScrubTool }}
            ingestion={DRAW_INGESTION}
            tune={DRAW_TUNE}
            insertPaint={insertPaint}
            // Pick on the drawn shape, not the bounding box: clicking the blank right half of a
            // text box, or the notch of a star, should reach whatever is behind it.
            geometry={{ picking: 'shape' }}
            viewport={{ pinchZoom: true, recenter }}
            cursorCoordsHud
            pickHud
            modalityHud
            onToolsCreated={props.onToolsCreated}
            snap={snap}
            layers={{
              paper: { layer: paperLayer, before: 'grid' },
              ...(grid.layer ? { grid: { layer: grid.layer } } : {}),
              modeTint: { layer: workspaceTint, after: 'grid' },
            }}
            decorationLayer={modality.decorationLayer}
            alphaFor={alphaFor}
            redrawOn={redrawOnScoping}
            isPointerInteractive={modality.scopingDim.isPointerInteractive}
            enteredGroup={group.entered}
            modes={machine.registry}
            pathEdit={modes.pathEdit}
            chromeVisibility={pathOverlays.chromeVisibility}
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
            <NoticesPublisher />
            <ToolOptionsPublisher />
            <TextEditDepPublisher edit={textEdit} />
          </SceneCanvas>
        )}
        {/* In the workspace, not the viewport: a fixed region sits outside the theme and over the status bar. */}
        {hostRef.current && <ToastRegion portalContainer={hostRef.current} />}
        <LastOperation />
        <SceneGradientHandles
          scene={scene}
          containerRef={hostRef}
          nodeId={soleSelectedId}
          slot={colors.focused}
          view={view}
        />
      </div>
      <DrawPageStrip pages={props.pages} />
    </div>
  );
}
