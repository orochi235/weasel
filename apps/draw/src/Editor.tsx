import {
  ActiveToolContextProvider,
  createMeasurements,
  type SceneCanvasApi,
  type SelectionApi,
  type Tool,
  type ToolsApi,
  toolSetHas,
  useActionsRegistry,
  type View
} from '@weasel-js/core';
import { RESHAPE_TOOLS } from '@weasel-js/path-tools';
import { CharacterOptions } from '@weasel-js/ui/components/CharacterOptions';
import { CommandPalette } from '@weasel-js/ui/components/CommandPalette';
import { ContextMenuHost } from '@weasel-js/ui/components/ContextMenu';
import { MenuBar } from '@weasel-js/ui/components/MenuBar';
import { ResizeHandle } from '@weasel-js/ui/components/ResizeHandle';
import { Sidebar } from '@weasel-js/ui/components/Sidebar';
import { ToolPalette } from '@weasel-js/ui/components/ToolPalette';
import { type CSSProperties, type ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActiveSwatches } from './ActiveSwatches';
import { lookupShortcutByToolId } from './dev/keybindingsView';
import { PAPER_PRESETS } from './docPersistence';
import { ANNOTATION_LAYER, type DrawScene } from './drawDocument';
import { EditorStatusBar } from './EditorStatusBar';
import { showFirstRunNotice } from './firstRunNotice';
import { LoupeProvider } from './LoupeProvider';
import { DRAW_MENU_BAR } from './menuBar';
import type { UseModalityReturn } from './modality/useModality';
import { useLoupeSource } from './pageLayers';
import { PreferencesModal } from './PreferencesModal';
import { toolEnumSources } from './registry/toolEnumSource';
import { RightSidebar } from './RightSidebar';
import { FIXED_CHROME, ShowChrome } from './surfaces/chrome';
import { SurfaceHostContext } from './surfaces/hostContext';
import { StripDock } from './surfaces/StripSurfaces';
import type { SidebarHost } from './surfaces/types';
import { Toolbar } from './Toolbar';
import { useDocumentState } from './useDocumentState';
import { useLastTool } from './useLastTool';
import { useMachineFontOutlines } from './useMachineFontOutlines';
import { useRightSidebarWidth } from './useRightSidebarWidth';
import { useHoldContentUnderChrome } from './useHoldContentUnderChrome';
import { useTextEditSession } from './useTextEditSession';
import { Workspace } from './Workspace';

const isCoreTool = (tool: Tool): boolean => !toolSetHas(RESHAPE_TOOLS, tool.id);
/** The path palette's groups: the Girth tool, the stroke tools, then the warps. */
const PATH_TOOL_GROUPS = ['shape', 'path', 'warp'] as const;
const CORE_TOOL_STACKS = [['rect', 'ellipse', 'polygon', 'star'], ['pen', 'spiro', 'pencil']];
const PATH_TOOL_STACKS = [['trim', 'extend'], ['distort', 'envelope', 'puppet']];

export interface EditorProps {
  scene: DrawScene;
  selection: SelectionApi;
  modality: UseModalityReturn;
}

/** The editor's chrome around the workspace: the command bar led by the menu bar, the toolbar dock under it, the
 *  tool-options strip, the two sidebars, and the status bar. */
export function Editor({ scene, selection, modality }: EditorProps): ReactElement {
  const [tools, setTools] = useState<ToolsApi | null>(null);
  useLastTool(tools);
  const prefSources = useMemo(() => toolEnumSources(tools), [tools]);
  const actionsReg = useActionsRegistry();
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const openPrefs = useCallback(() => setPrefsOpen(true), []);
  const openPalette = useCallback(() => setPaletteOpen(true), []);
  useEffect(() => showFirstRunNotice(), []);
  useMachineFontOutlines();

  const doc = useDocumentState(selection.current.length > 0);
  const rightSidebar = useRightSidebarWidth();
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: { x: 1, y: 1 } });
  // Measurements are nodes on the annotation layer; this is which one is picked.
  const [measurements] = useState(() => createMeasurements({ layer: ANNOTATION_LAYER }));

  // `useHud` and `createLoupe` both read the canvas handle in a mount effect
  // and neither retries, so the loupe's lens can only mount once the handle
  // exists — which is a render later than this component's first, because
  // `<SceneCanvas>` waits on the host's measured size.
  const canvasRef = useRef<SceneCanvasApi | null>(null);
  const [canvasReady, setCanvasReady] = useState(false);
  const attachCanvas = useCallback((api: SceneCanvasApi | null) => {
    canvasRef.current = api;
    setCanvasReady(api !== null);
  }, []);
  const loupeSource = useLoupeSource(scene, PAPER_PRESETS[doc.paperSize], doc.backgroundColor);

  const surfaceHost = useMemo((): SidebarHost => ({
    scene, selection, measurements,
    filename: doc.filename, setFilename: doc.setFilename,
    backgroundColor: doc.backgroundColor, setBackgroundColor: doc.setBackgroundColor,
    paperSize: doc.paperSize, setPaperSize: doc.setPaperSize,
    docSelected: doc.docSelected, setDocSelected: doc.setDocSelected,
  }), [scene, selection, measurements, doc.filename, doc.setFilename, doc.backgroundColor, doc.setBackgroundColor,
    doc.paperSize, doc.setPaperSize, doc.docSelected, doc.setDocSelected]);

  // `hostRef.current` is null on the first render and populated by the time the canvas mounts,
  // which re-renders this component, so the overlay always has a container before an edit can
  // start.
  const hostRef = useRef<HTMLDivElement | null>(null);
  const textEdit = useTextEditSession(scene, hostRef.current, modality.machine);
  // The character strip shows only during a text edit, and moves the workspace as it comes and goes.
  const optionsRef = useRef<HTMLDivElement | null>(null);
  useHoldContentUnderChrome(optionsRef, setView, textEdit.effectiveStyle != null);

  return (
    <ActiveToolContextProvider>
      <LoupeProvider canvasRef={canvasRef} ready={canvasReady} source={loupeSource}>
        <div className="wd-app">
          <Toolbar
            menus={<MenuBar schema={DRAW_MENU_BAR} label="Menu bar" className="wd-menubar" />}
            scene={scene}
            selection={selection}
            paperSize={doc.paperSize}
            setPaperSize={doc.setPaperSize}
            filename={doc.filename}
            setFilename={doc.setFilename}
            backgroundColor={doc.backgroundColor}
            setBackgroundColor={doc.setBackgroundColor}
            cornerSelection={modality.cornerSelection}
          />
          <PreferencesModal open={prefsOpen} onClose={() => setPrefsOpen(false)} registryEnumSources={prefSources} />
          <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
          <ContextMenuHost />
          <SurfaceHostContext.Provider value={surfaceHost}>
            <StripDock className="wd-dock">
              <div className="wd-dock-main">
                <div ref={optionsRef}>
                  <CharacterOptions style={textEdit.effectiveStyle} onPatch={textEdit.applyStyleToSelection} />
                </div>
                <div className="wd-body">
                  <ShowChrome id={FIXED_CHROME.tools.id}>
                    <Sidebar side="left" className="wd-sidebar left" ariaLabel={FIXED_CHROME.tools.label}>
                      {tools && (
                        <ToolPalette
                          tools={tools}
                          include={isCoreTool}
                          stacks={CORE_TOOL_STACKS}
                          orientation="vertical"
                          lookupShortcut={(id) => lookupShortcutByToolId(id, actionsReg?.list() ?? [])}
                          modeRegistry={modality.machine.registry}
                        />
                      )}
                      <ActiveSwatches />
                    </Sidebar>
                  </ShowChrome>
                  <ShowChrome id={FIXED_CHROME.pathTools.id}>
                    <Sidebar side="left" className="wd-sidebar left path" ariaLabel={FIXED_CHROME.pathTools.label}>
                      {tools && (
                        <ToolPalette
                          tools={tools}
                          include={RESHAPE_TOOLS}
                          ariaLabel={FIXED_CHROME.pathTools.label}
                          groupOrder={PATH_TOOL_GROUPS}
                          stacks={PATH_TOOL_STACKS}
                          orientation="vertical"
                          lookupShortcut={(id) => lookupShortcutByToolId(id, actionsReg?.list() ?? [])}
                          modeRegistry={modality.machine.registry}
                        />
                      )}
                    </Sidebar>
                  </ShowChrome>
                  <Workspace
                    scene={scene}
                    selection={selection}
                    measurements={measurements}
                    modality={modality}
                    hostRef={hostRef}
                    textEdit={textEdit}
                    view={view}
                    onViewChange={setView}
                    paperSize={doc.paperSize}
                    backgroundColor={doc.backgroundColor}
                    onToolsCreated={setTools}
                    onCanvas={attachCanvas}
                    openPrefs={openPrefs}
                    openPalette={openPalette}
                  />
                  <ResizeHandle
                    value={rightSidebar.width}
                    min={rightSidebar.min}
                    max={rightSidebar.max}
                    invert
                    onInput={rightSidebar.onInput}
                    onChange={rightSidebar.onChange}
                    ariaLabel="Resize properties sidebar"
                  />
                  <Sidebar
                    side="right"
                    className="wd-sidebar right"
                    ariaLabel="Properties"
                    // Width lives in a custom property so app.css keeps ownership of the
                    // clamp; only the number crosses the boundary.
                    style={{ '--wd-right-width': `${rightSidebar.width}px` } as CSSProperties}
                  >
                    <RightSidebar />
                  </Sidebar>
                </div>
              </div>
            </StripDock>
          </SurfaceHostContext.Provider>
          <ShowChrome id={FIXED_CHROME.statusBar.id}>
            <EditorStatusBar scene={scene} selection={selection} view={view} machine={modality.machine} />
          </ShowChrome>
        </div>
      </LoupeProvider>
    </ActiveToolContextProvider>
  );
}
