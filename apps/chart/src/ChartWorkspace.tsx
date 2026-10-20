import {
  SceneCanvas, useCanvasSize, useScene, useSceneTextEdit, useSelection,
  type SceneCanvasApi, type Tool, type ToolsApi, type View,
} from '@weasel-js/core';
import { diagramResizable, dropEmptyEdgeLabel } from '@weasel-js/diagram';
import { Sidebar } from '@weasel-js/ui/components/Sidebar';
import { ToolPalette } from '@weasel-js/ui/components/ToolPalette';
import { TextEditDepPublisher, usePageFit, usePaperLayer, useSessionPersistence } from '@editor/index';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { useChartCommands } from './chartCommands';
import {
  CHART_LAYERS, CHART_PAGE, CHART_PAGE_COLOR, CHART_REGISTRY, type ChartData, type ChartLayer, type ChartPose,
} from './chartDocument';
import { CHART_HISTORY_KEY, CHART_SCENE_KEY, loadChartSession } from './chartPersistence';
import { isStencilTool, StencilPanel } from './StencilPanel';
import { stencilDropHandler } from './stencilDrop';
import { StencilInsertPublisher, useChartDiagram } from './useChartDiagram';
import './workspace.css';

const FEATURES = ['draw'] as const;
// Module consts: SceneCanvas keys its wiring off these props' identity.
const INGESTION = { handlers: [stencilDropHandler] };
const SESSION = { sceneKey: CHART_SCENE_KEY, historyKey: CHART_HISTORY_KEY };
const NO_VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

/** The palette's tools: select, hand and the connector; the stencils have the Shapes panel. */
const isPaletteTool = (tool: Tool): boolean => !isStencilTool(tool);

/** Chart mode: the scene is the document — stencil bodies joined by edges, on a page. */
export function ChartWorkspace(): ReactElement {
  const [initial] = useState(loadChartSession);
  const scene = useScene<ChartData, ChartLayer, ChartPose>({ systemLayers: CHART_LAYERS, registry: CHART_REGISTRY, initial });
  const selection = useSelection({ mode: 'multi', scene });
  useSessionPersistence(scene, SESSION);
  useChartCommands(scene);
  const diagram = useChartDiagram(scene, selection);
  const selectTool = useMemo(() => ({ resize: { resizable: diagramResizable(scene) } }), [scene]);

  const hostRef = useRef<HTMLDivElement | null>(null);
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const attachHost = useCallback((el: HTMLDivElement | null) => { hostRef.current = el; setHost(el); }, []);
  const dims = useCanvasSize(hostRef);
  const [view, setView] = useState<View>(NO_VIEW);
  const recenter = usePageFit(dims, 'chart', CHART_PAGE, setView);
  const paperLayer = usePaperLayer(CHART_PAGE, CHART_PAGE_COLOR);
  const [tools, setTools] = useState<ToolsApi | null>(null);

  const textEdit = useSceneTextEdit(scene, host, { escape: 'commit', onEnd: (id) => dropEmptyEdgeLabel(scene, id) });
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
    <div className="wc-body">
      <Sidebar side="left" className="wc-sidebar" ariaLabel="Shapes and tools">
        {tools && <ToolPalette tools={tools} include={isPaletteTool} orientation="horizontal" />}
        {tools && <StencilPanel tools={tools} />}
      </Sidebar>
      <div className="wc-host" ref={attachHost} onDoubleClick={textEdit.onDoubleClick}>
        {dims.width > 0 && dims.height > 0 && (
          <SceneCanvas<ChartData, ChartLayer, ChartPose>
            aria-label="Chart"
            ref={setCanvas}
            features={FEATURES}
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
            ingestion={INGESTION}
            onToolsCreated={setTools}
            alphaFor={alphaFor}
            layers={{ paper: { layer: paperLayer, before: 'scene' } }}
          >
            <StencilInsertPublisher />
            <TextEditDepPublisher edit={textEdit} />
          </SceneCanvas>
        )}
      </div>
    </div>
  );
}
