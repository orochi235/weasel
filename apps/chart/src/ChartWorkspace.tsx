import {
  SceneCanvas, isTextData, useCanvasSize, useLatest, useScene, useSceneTextEdit, useSelection,
  type SceneCanvasApi, type Tool, type ToolsApi, type View,
} from '@weasel-js/core';
import { diagramResizable, diagramTypeOf, dropEmptyEdgeLabel, offPageTagOf } from '@weasel-js/diagram';
import { Sidebar } from '@weasel-js/ui/components/Sidebar';
import { ToastRegion } from '@weasel-js/ui/components/Toast';
import { TextEditDepPublisher, usePageFit, usePaperLayer, useSessionPersistence } from '@editor/index';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { useChartCommands } from './chartCommands';
import { useExportCommands } from './exportCommands';
import { ImportExportCommands } from './importExport';
import {
  CHART_LAYERS, CHART_PAGE, CHART_REGISTRY, type ChartData, type ChartLayer, type ChartPose,
} from './chartDocument';
import { CHART_HISTORY_KEY, CHART_SCENE_KEY, loadChartSession } from './chartPersistence';
import { NewChart } from './NewChartDialog';
import { ChartPageStrip } from './pages/ChartPageStrip';
import { PAGE_FIT_PADDING, useChartPages } from './pages/useChartPages';
import { isStencilTool, StencilPanel } from './StencilPanel';
import { StylePanel } from './theme/StylePanel';
import { ChartToolbar } from './toolbar/ChartToolbar';
import { chartThemeOf, ThemeCommands } from './theme/themeCommands';
import { ThemePanel } from './theme/ThemePanel';
import {
  AvoidRoutingPublisher, BodyFollowerPublisher, ContainerDropPublisher, HopsPublisher, StencilInsertPublisher, useChartDiagram,
  WaypointFollowerPublisher,
} from './useChartDiagram';
import { useChartSnap } from './useChartSnap';
import './workspace.css';

// Module consts: SceneCanvas keys its wiring off these props' identity.
const SESSION = { sceneKey: CHART_SCENE_KEY, historyKey: CHART_HISTORY_KEY };
const NO_VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const FALLBACK_PAGE = { x: 0, y: 0, ...CHART_PAGE };

/** Text a double-click edits: an off-page tag's is the pass's to write. */
const isEditableText = (data: ChartData): boolean => isTextData(data) && offPageTagOf({ data }) === null;

/** The palette's tools: select, hand and the connector; the stencils have the Shapes panel. */
const isPaletteTool = (tool: Tool): boolean => !isStencilTool(tool);

/** Chart mode: the scene is the document — stencil bodies joined by edges, on a page. */
export function ChartWorkspace(): ReactElement {
  const [initial] = useState(loadChartSession);
  const scene = useScene<ChartData, ChartLayer, ChartPose>({
    systemLayers: CHART_LAYERS, registry: CHART_REGISTRY, initial: initial.specs, doc: initial.doc,
  });
  const selection = useSelection({ mode: 'multi', scene });
  useSessionPersistence(scene, SESSION);
  useChartCommands(scene);
  const theme = chartThemeOf(scene);
  const diagram = useChartDiagram(scene, selection, theme, diagramTypeOf(scene));
  const selectTool = useMemo(() => ({ resize: { resizable: diagramResizable(scene) } }), [scene]);

  const hostRef = useRef<HTMLDivElement | null>(null);
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const attachHost = useCallback((el: HTMLDivElement | null) => { hostRef.current = el; setHost(el); }, []);
  const dims = useCanvasSize(hostRef);
  const [view, setView] = useState<View>(NO_VIEW);
  const pages = useChartPages(scene, view, dims, setView);
  useExportCommands(scene, pages);
  const fitted = useRef<View | null>(null);
  const setFitted = useCallback((fit: View) => { fitted.current = fit; setView(fit); }, []);
  const recenter = usePageFit(dims, 'chart', pages.shown ?? pages.placed[0] ?? CHART_PAGE, setFitted, PAGE_FIT_PADDING);
  // The tool palette fills in after the first fit and shrinks the host: until the view is moved, keep the page fitted.
  const viewRef = useLatest(view);
  useEffect(() => {
    if (fitted.current !== null && viewRef.current === fitted.current) recenter();
  }, [dims.width, dims.height, recenter, viewRef]);
  const paperLayer = usePaperLayer(pages.placed, theme.page);
  const { gridLayer, snap, features } = useChartSnap(pages.shown ?? FALLBACK_PAGE, theme.page);
  const layers = useMemo(() => ({
    paper: { layer: paperLayer, before: 'grid' },
    ...(gridLayer ? { grid: { layer: gridLayer } } : {}),
  }), [paperLayer, gridLayer]);
  const [tools, setTools] = useState<ToolsApi | null>(null);
  const [themeOpen, setThemeOpen] = useState(false);

  const textEdit = useSceneTextEdit(scene, host, { escape: 'commit', isText: isEditableText, onEnd: (id) => dropEmptyEdgeLabel(scene, id) });
  const editingId = textEdit.editingId;
  const alphaFor = useCallback((id: string) => (id === editingId ? 0 : 1), [editingId]);

  // `registerLayer` is the only attach route that is hit-tested, and the canvas mounts once the host has a size.
  const [canvas, setCanvas] = useState<SceneCanvasApi | null>(null);
  useEffect(() => {
    if (canvas === null) return;
    const disposers = diagram.layers.map((layer) => canvas.registerLayer(layer));
    return () => disposers.forEach((dispose) => dispose());
  }, [canvas, diagram.layers]);

  return (
    <div className="wc-workspace">
      <ChartToolbar tools={tools} include={isPaletteTool} view={view} setView={setView} dims={dims} />
      <div className="wc-body">
        <Sidebar side="left" className="wc-sidebar" ariaLabel="Shapes">
          {tools && <StencilPanel tools={tools} scene={scene} theme={theme} scale={Math.abs(view.scale.x)} />}
        </Sidebar>
        <div className="wc-stage">
          <div className="wc-host" ref={attachHost} onDoubleClick={textEdit.onDoubleClick}>
            {dims.width > 0 && dims.height > 0 && (
              <SceneCanvas<ChartData, ChartLayer, ChartPose>
                aria-label="Chart"
                ref={setCanvas}
                features={features}
                snap={snap}
                claimKeys
                scene={scene}
                selection={selection}
                width={dims.width}
                height={dims.height}
                view={view}
                onViewChange={setView}
                viewport={{ recenter }}
                tools={diagram.tools}
                selectTool={selectTool}
                ambient={diagram.ambient}
                onToolsCreated={setTools}
                alphaFor={alphaFor}
                layers={layers}
              >
                <StencilInsertPublisher theme={theme} />
                <WaypointFollowerPublisher scene={scene} />
                <BodyFollowerPublisher scene={scene} />
                <AvoidRoutingPublisher scene={scene} />
                <HopsPublisher scene={scene} />
                <ContainerDropPublisher scene={scene} />
                <TextEditDepPublisher edit={textEdit} />
              </SceneCanvas>
            )}
          </div>
          <ChartPageStrip pages={pages} />
        </div>
        <Sidebar side="right" className="wc-sidebar wc-format" ariaLabel="Format">
          <StylePanel scene={scene} selected={selection.current} theme={theme} />
          {themeOpen && <ThemePanel scene={scene} onClose={() => setThemeOpen(false)} />}
        </Sidebar>
        <ThemeCommands scene={scene} onEdit={() => setThemeOpen(true)} />
        <ImportExportCommands scene={scene} pages={pages} />
        <NewChart scene={scene} />
        <ToastRegion />
      </div>
    </div>
  );
}
