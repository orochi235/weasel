import {
  createMeasurements,
  placedPagesOf,
  type SceneCanvasApi,
  type SelectionApi,
  TOOL_GROUP_ORDER,
  type ToolsApi,
  useActionsRegistry,
  useCanvasSize,
  type View
} from '@weasel-js/core';
import type { ModeRegistry } from '@weasel-js/modes';
import { PATH_OVERLAYS_GROUP } from '@weasel-js/path-tools';
import { ActionBar } from '@weasel-js/ui/components/ActionBar';
import { CharacterOptions } from '@weasel-js/ui/components/CharacterOptions';
import { ActiveToolOptions } from './ui/ToolOptions';
import { drawToolOptionValues } from './toolOptions';
import { CommandPalette } from '@weasel-js/ui/components/CommandPalette';
import { ResizeHandle } from '@weasel-js/ui/components/ResizeHandle';
import { Sidebar } from '@weasel-js/ui/components/Sidebar';
import { ToolPalette } from '@weasel-js/ui/components/ToolPalette';
import { type CSSProperties, type ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActiveSwatches } from './ActiveSwatches';
import { lookupShortcutByToolId } from './dev/keybindingsView';
import { EditorShell, usePageFit, usePages } from '@weasel-js/editor';
import { DRAW_PREFERENCES_COMMAND } from './appCommands/actions';
import { DEFAULT_PAPER_SIZE, PAPER_PRESETS } from './paperSizes';
import { ANNOTATION_LAYER, type DrawScene } from './drawDocument';
import { EditorStatusBar } from './EditorStatusBar';
import { showFirstRunNotice } from './firstRunNotice';
import { LoupeProvider } from './LoupeProvider';
import { DRAW_MENU_CONTRIBUTIONS, DRAW_MENU_TITLES } from './menuBar';
import type { UseModalityReturn } from './modality/useModality';
import { useModeId } from './modality/useModeId';
import { useLoupeSource } from './pageLayers';
import { useDrawPrefsDialog } from './drawPrefsDialog';
import { drawPrefs } from './prefs';
import { RegistryEnumSourcesContext } from './registry/RegistrySelect';
import { toolEnumSources } from './registry/toolEnumSource';
import { RightSidebar } from './RightSidebar';
import { FIXED_CHROME, ShowChrome } from './surfaces/chrome';
import { SurfaceHostContext } from './surfaces/hostContext';
import { StripDock } from './surfaces/StripSurfaces';
import { useEditorSurfaceHost } from './surfaces/useEditorSurfaceHost';
import { Toolbar } from './Toolbar';
import { useDocumentState } from './useDocumentState';
import { useLastTool } from './useLastTool';
import { useMachineFontOutlines } from './useMachineFontOutlines';
import { useRightSidebarWidth } from './useRightSidebarWidth';
import { useHoldContentUnderChrome } from './useHoldContentUnderChrome';
import { useTextEditSession } from './useTextEditSession';
import { Workspace } from './Workspace';

/** The palette's groups: core's, then path-tools' reshaping tools and its warps. */
const TOOL_GROUPS = [...TOOL_GROUP_ORDER, 'path', 'warp'];
const TOOL_STACKS = [
  ['rect', 'ellipse', 'polygon', 'star'], ['pen', 'spiro', 'pencil'], ['trim', 'extend'], ['distort', 'envelope', 'puppet'],
];
/** What the view fits before the scene has a page to fit. */
const FALLBACK_PAGE = { x: 0, y: 0, ...PAPER_PRESETS[DEFAULT_PAPER_SIZE] };

export interface EditorProps {
  scene: DrawScene;
  selection: SelectionApi;
  modality: UseModalityReturn;
}

/** The editor's chrome around the workspace, in `<EditorShell>`: the command bar led by the menu bar, the toolbar
 *  dock under it, the tool-options strip, the two sidebars, and the status bar. */
export function Editor({ scene, selection, modality }: EditorProps): ReactElement {
  const [tools, setTools] = useState<ToolsApi | null>(null);
  useLastTool(tools, modality.machine.registry);
  const prefSources = useMemo(() => toolEnumSources(tools), [tools]);
  const prefsDialog = useDrawPrefsDialog();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const openPalette = useCallback(() => setPaletteOpen(true), []);
  useEffect(() => showFirstRunNotice(), []);
  useMachineFontOutlines();

  const rightSidebar = useRightSidebarWidth();
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: { x: 1, y: 1 } });
  // `hostRef.current` is null on the first render and populated by the time the canvas mounts,
  // which re-renders this component, so the overlay always has a container before an edit can
  // start.
  const hostRef = useRef<HTMLDivElement | null>(null);
  const hostDims = useCanvasSize(hostRef);
  const pages = usePages(scene, view, hostDims, setView);
  const shownPage = pages.shown ?? FALLBACK_PAGE;
  const recenter = usePageFit(hostDims, 'draw', shownPage, setView);
  const { goTo } = pages;
  const showFirstPage = useCallback(() => {
    const first = placedPagesOf(scene)[0];
    if (first) goTo(first.id);
  }, [scene, goTo]);
  const doc = useDocumentState(pages, selection.current.length > 0);
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
  const loupeSource = useLoupeSource(scene, pages.placed, doc.backgroundColor);

  const surfaceHost = useEditorSurfaceHost({ scene, selection, measurements, doc, cornerSelection: modality.cornerSelection });

  const textEdit = useTextEditSession(scene, hostRef.current, modality.machine);
  const inPathEdit = useModeId(modality.machine) === 'path-edit';
  // The character strip shows only during a text edit, and moves the workspace as it comes and goes.
  const optionsRef = useRef<HTMLDivElement | null>(null);
  const activeTool = tools?.active ? tools.registry[tools.active] : undefined;
  const toolOptions = useMemo(() => drawToolOptionValues(), []);
  useHoldContentUnderChrome(optionsRef, setView, textEdit.effectiveStyle != null || activeTool?.options !== undefined);

  return (
    <SurfaceHostContext.Provider value={surfaceHost}>
      <RegistryEnumSourcesContext.Provider value={prefSources}>
        <div className="wd-app">
          <EditorShell
            prefs={drawPrefs()}
            prefsDialog={prefsDialog}
            preferences={DRAW_PREFERENCES_COMMAND}
            menus={DRAW_MENU_CONTRIBUTIONS}
            menuTitles={DRAW_MENU_TITLES}
            menuBar="inline"
            menuBarClassName="wd-menubar"
            topbar={(menuBar) => (
              <Toolbar
                menus={menuBar}
                scene={scene}
                selection={selection}
                paperSize={doc.paperSize}
                showFirstPage={showFirstPage}
                leaveMode={modality.machine.leaveMode}
                page={pages.shown}
                filename={doc.filename}
                setFilename={doc.setFilename}
                backgroundColor={doc.backgroundColor}
                setBackgroundColor={doc.setBackgroundColor}
              />
            )}
          >
            <LoupeProvider canvasRef={canvasRef} ready={canvasReady} source={loupeSource}>
              <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
              <StripDock className="wd-dock">
                <div className="wd-dock-main">
                  <div ref={optionsRef}>
                    <CharacterOptions style={textEdit.effectiveStyle} onPatch={textEdit.applyStyleToSelection} />
                    <ActiveToolOptions tool={activeTool} values={toolOptions} />
                  </div>
                  <div className="wd-body">
                    <ShowChrome id={FIXED_CHROME.tools.id}>
                      <Sidebar side="left" className="wd-sidebar left" ariaLabel={FIXED_CHROME.tools.label}>
                        {tools && <DrawToolPalette tools={tools} modeRegistry={modality.machine.registry} />}
                        {inPathEdit && <ActionBar group={PATH_OVERLAYS_GROUP} orientation="vertical" className="wd-path-overlays" />}
                        <ActiveSwatches />
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
                      hostDims={hostDims}
                      pages={pages}
                      shownPage={shownPage}
                      recenter={recenter}
                      backgroundColor={doc.backgroundColor}
                      onToolsCreated={setTools}
                      onCanvas={attachCanvas}
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
              <ShowChrome id={FIXED_CHROME.statusBar.id}>
                <EditorStatusBar scene={scene} selection={selection} view={view} machine={modality.machine} />
              </ShowChrome>
            </LoupeProvider>
          </EditorShell>
        </div>
      </RegistryEnumSourcesContext.Provider>
    </SurfaceHostContext.Provider>
  );
}

/** The tool palette, each tool's tooltip naming the key the actions registry binds to it. */
function DrawToolPalette({ tools, modeRegistry }: { tools: ToolsApi; modeRegistry: ModeRegistry }): ReactElement {
  const actionsReg = useActionsRegistry();
  return (
    <ToolPalette
      tools={tools}
      groupOrder={TOOL_GROUPS}
      stacks={TOOL_STACKS}
      orientation="vertical"
      lookupShortcut={(id) => lookupShortcutByToolId(id, actionsReg?.list() ?? [])}
      modeRegistry={modeRegistry}
      ineligible="hide"
    />
  );
}
