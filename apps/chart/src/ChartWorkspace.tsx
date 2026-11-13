import {
  SceneCanvas, createToolOptionValues, isTextData, useCanvasSize, useLatest, useScene, useSceneTextEdit, useSelection,
  useToolOptionValues, type Tool, type ToolOptionValues, type ToolsApi,
} from '@weasel-js/core';
import {
  commitSequence, createSequenceDeleteAction, diagramResizable, diagramTypeOf, dropEmptyEdgeLabel, foldSequenceText, isSequenceText,
  offPageTagOf, rendererMeasure, sequencePartOf,
} from '@weasel-js/diagram';
import { foldPlotText, isPlotText, plotEditing, plotMarkOf, replacePlotData } from '@weasel-js/plot';
import { Sidebar } from '@weasel-js/ui/components/Sidebar';
import { usePaperLayer, useSessionPersistence } from '@weasel-js/editor';
import { useCallback, useMemo, useRef, useState, type ReactElement } from 'react';
import { useChartCommands } from './chartCommands';
import { useExportCommands } from './exportCommands';
import { ImportExportCommands } from './importExport';
import {
  CHART_LAYERS, CHART_PAGE, CHART_REGISTRY, type ChartData, type ChartLayer, type ChartPose, type ChartScene,
} from './chartDocument';
import { CHART_SESSION, loadChartSession } from './chartPersistence';
import { reportChartSave } from './reportFailure';
import { NewChart } from './NewChartDialog';
import { PlotDataSection } from './PlotDataSection';
import { ChartPageStrip } from './pages/ChartPageStrip';
import { useChartPages } from './pages/useChartPages';
import { useFittedView } from './pages/useFittedView';
import { isSequenceTool, SequencePanel } from './SequencePanel';
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
const FALLBACK_PAGE = { x: 0, y: 0, ...CHART_PAGE };
/** Delete takes a selected sequence part out of its sequence's data, and anything else out of the scene. */
const ACTIONS = { delete: createSequenceDeleteAction({ measure: rendererMeasure }) };

/** Text a double-click edits: an off-page tag's is the pass's to write, and a sequence's or a chart's only where its
 *  data holds it. */
const isEditableText = (data: ChartData): boolean =>
  isTextData(data) && offPageTagOf({ data }) === null && (sequencePartOf({ data }) === null || isSequenceText(data))
  && (plotMarkOf({ data }) === null || isPlotText(data));

/** What closing a text edit writes besides the text: an emptied edge label removed, a sequence's or a chart's text folded
 *  into its data. */
/** Publishes `values` as the canvas's `toolOptionValues` dep, which the Sequence panel's pickers write. */
function ToolOptionValuesPublisher({ values }: { values: ToolOptionValues }): null {
  useToolOptionValues(values);
  return null;
}

function endTextEdit(scene: ChartScene, id: string): void {
  dropEmptyEdgeLabel(scene, id);
  const loose = scene as never;
  foldSequenceText(loose, id, (edit) => commitSequence(loose, edit.id, edit.data, edit.label, { measure: rendererMeasure }));
  foldPlotText(loose, id, (edit) => replacePlotData(scene, edit.rootId, edit.data, { label: edit.label }));
}

/** The palette's tools: select, hand and the connector; the stencils have the Shapes panel, the sequence tools the
 *  Sequence panel. */
const isPaletteTool = (tool: Tool): boolean => !isStencilTool(tool) && !isSequenceTool(tool);

/** Chart mode: the scene is the document — stencil bodies joined by edges, on a page. */
export function ChartWorkspace(): ReactElement {
  const [initial] = useState(loadChartSession);
  const scene = useScene<ChartData, ChartLayer, ChartPose>({
    systemLayers: CHART_LAYERS, registry: CHART_REGISTRY, initial: initial.specs, doc: initial.doc,
  });
  const selection = useSelection({ mode: 'multi', scene });
  useSessionPersistence(scene, { ...CHART_SESSION, onSaved: reportChartSave });
  const theme = chartThemeOf(scene);
  const [toolOptionValues] = useState(createToolOptionValues);
  const diagram = useChartDiagram(scene, selection, theme, diagramTypeOf(scene));
  const plot = useMemo(() => plotEditing({ scene: scene as never }), [scene]);
  // The plot's handles first, so a diagram handle beside one is hit over it.
  const ambient = useMemo(() => [plot, ...diagram.ambient], [diagram.ambient, plot]);
  const selectTool = useMemo(() => ({ resize: { resizable: diagramResizable(scene) } }), [scene]);

  const hostRef = useRef<HTMLDivElement | null>(null);
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const attachHost = useCallback((el: HTMLDivElement | null) => { hostRef.current = el; setHost(el); }, []);
  const dims = useCanvasSize(hostRef);
  const { view, setView, fitTo } = useFittedView(scene, dims);
  const pages = useChartPages(scene, view, dims, setView);
  const showFirstPage = useCallback(() => fitTo(null), [fitTo]);
  useChartCommands(scene, showFirstPage);
  useExportCommands(scene, pages);
  const shownRef = useLatest(pages.shown);
  const recenter = useCallback(() => fitTo(shownRef.current?.id ?? null), [fitTo, shownRef]);
  const paperLayer = usePaperLayer(pages.placed, theme.page);
  const { gridLayer, snap, features } = useChartSnap(pages.shown ?? FALLBACK_PAGE, theme.page);
  const layers = useMemo(() => ({
    paper: { layer: paperLayer, before: 'grid' },
    ...(gridLayer ? { grid: { layer: gridLayer } } : {}),
  }), [paperLayer, gridLayer]);
  const [tools, setTools] = useState<ToolsApi | null>(null);
  const [themeOpen, setThemeOpen] = useState(false);

  const textEdit = useSceneTextEdit(scene, host, { escape: 'commit', isText: isEditableText, onEnd: (id) => endTextEdit(scene, id) });
  const editingId = textEdit.editingId;
  const alphaFor = useCallback((id: string) => (id === editingId ? 0 : 1), [editingId]);


  return (
    <div className="wc-workspace">
      <ChartToolbar tools={tools} include={isPaletteTool} view={view} setView={setView} dims={dims} />
      <div className="wc-body">
        <Sidebar side="left" className="wc-sidebar" aria-label="Shapes">
          {tools && <StencilPanel tools={tools} scene={scene} theme={theme} scale={Math.abs(view.scale.x)} />}
          {tools && (
            <SequencePanel tools={tools} scene={scene} selected={selection.current} values={toolOptionValues} />
          )}
        </Sidebar>
        <div className="wc-stage">
          <div className="wc-host" ref={attachHost}>
            {dims.width > 0 && dims.height > 0 && (
              <SceneCanvas<ChartData, ChartLayer, ChartPose>
                aria-label="Chart"
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
                ambient={ambient}
                actions={ACTIONS}
                onToolsCreated={setTools}
                alphaFor={alphaFor}
                layers={layers}
              >
                <ToolOptionValuesPublisher values={toolOptionValues} />
                <StencilInsertPublisher theme={theme} />
                <WaypointFollowerPublisher scene={scene} />
                <BodyFollowerPublisher scene={scene} />
                <AvoidRoutingPublisher scene={scene} />
                <HopsPublisher scene={scene} />
                <ContainerDropPublisher scene={scene} />
              </SceneCanvas>
            )}
          </div>
          <ChartPageStrip scene={scene} pages={pages} theme={theme} />
        </div>
        <Sidebar side="right" className="wc-sidebar wc-format" aria-label="Format">
          <PlotDataSection scene={scene} selected={selection.current} />
          <StylePanel scene={scene} selected={selection.current} theme={theme} />
          {themeOpen && <ThemePanel scene={scene} onClose={() => setThemeOpen(false)} />}
        </Sidebar>
        <ThemeCommands scene={scene} onEdit={() => setThemeOpen(true)} />
        <ImportExportCommands scene={scene} pages={pages} onReplaced={showFirstPage} />
        <NewChart scene={scene} onReplaced={showFirstPage} />
      </div>
    </div>
  );
}
