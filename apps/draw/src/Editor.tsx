import {
  ActiveToolContextProvider,
  type SceneCanvasApi,
  type SelectionApi,
  type ToolsApi,
  useActionsRegistry,
  type View
} from '@weasel-js/core';
import { CharacterOptions, CommandPalette, ResizeHandle, Sidebar, ToolPalette } from '@weasel-js/ui';
import { type CSSProperties, type ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActiveSwatches } from './ActiveSwatches';
import { lookupShortcutByToolId } from './dev/keybindingsView';
import { PAPER_PRESETS } from './docPersistence';
import type { DrawScene } from './drawDocument';
import { EditorStatusBar } from './EditorStatusBar';
import { showFirstRunNotice } from './firstRunNotice';
import { LoupeControls } from './LoupeControls';
import type { UseModalityReturn } from './modality/useModality';
import { useLoupeSource } from './pageLayers';
import { PreferencesModal } from './PreferencesModal';
import { toolEnumSources } from './registry/toolEnumSource';
import { RightSidebar } from './RightSidebar';
import { Toolbar } from './Toolbar';
import { useDocumentState } from './useDocumentState';
import { useLastTool } from './useLastTool';
import { useMachineFontOutlines } from './useMachineFontOutlines';
import { useRightSidebarWidth } from './useRightSidebarWidth';
import { useTextEditSession } from './useTextEditSession';
import { Workspace } from './Workspace';

export interface EditorProps {
  scene: DrawScene;
  selection: SelectionApi;
  modality: UseModalityReturn;
}

/** The editor's chrome around the workspace: the command bar, the tool-options strip, the two
 *  sidebars, and the status bar. */
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

  // `useHud` and `createLoupe` both read the canvas handle in a mount effect
  // and neither retries, so the loupe chrome can only mount once the handle
  // exists — which is a render later than this component's first, because
  // `<SceneCanvas>` waits on the host's measured size.
  const canvasRef = useRef<SceneCanvasApi | null>(null);
  const [canvasReady, setCanvasReady] = useState(false);
  const attachCanvas = useCallback((api: SceneCanvasApi | null) => {
    canvasRef.current = api;
    setCanvasReady(api !== null);
  }, []);
  const loupeSource = useLoupeSource(scene, PAPER_PRESETS[doc.paperSize], doc.backgroundColor);

  // `hostRef.current` is null on the first render and populated by the time the canvas mounts,
  // which re-renders this component, so the overlay always has a container before an edit can
  // start.
  const hostRef = useRef<HTMLDivElement | null>(null);
  const textEdit = useTextEditSession(scene, hostRef.current, modality.machine);

  return (
    <ActiveToolContextProvider>
      <div className="wd-app">
        <Toolbar
          scene={scene}
          selection={selection}
          paperSize={doc.paperSize}
          setPaperSize={doc.setPaperSize}
          filename={doc.filename}
          setFilename={doc.setFilename}
          backgroundColor={doc.backgroundColor}
          setBackgroundColor={doc.setBackgroundColor}
          onClearJournalCache={() => modality.machine.clearJournalCache()}
        />
        <PreferencesModal open={prefsOpen} onClose={() => setPrefsOpen(false)} registryEnumSources={prefSources} />
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
        {/* Permanently reserved, never mounted on demand: the canvas is sized
            to the workspace, so appearing mid-edit would resize it under the
            caret. Empty until a text edit is in progress. */}
        <CharacterOptions style={textEdit.effectiveStyle} onPatch={textEdit.applyStyleToSelection}>
          {canvasReady && (
            <LoupeControls canvasRef={canvasRef} source={loupeSource} />
          )}
        </CharacterOptions>
        <div className="wd-body">
          <Sidebar side="left" className="wd-sidebar left" ariaLabel="Tools">
            {tools && (
              <ToolPalette
                tools={tools}
                orientation="vertical"
                lookupShortcut={(id) => lookupShortcutByToolId(id, actionsReg?.list() ?? [])}
                modeRegistry={modality.machine.registry}
              />
            )}
            <ActiveSwatches />
          </Sidebar>
          <Workspace
            scene={scene}
            selection={selection}
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
            <RightSidebar
              scene={scene}
              selection={selection}
              filename={doc.filename}
              setFilename={doc.setFilename}
              backgroundColor={doc.backgroundColor}
              setBackgroundColor={doc.setBackgroundColor}
              paperSize={doc.paperSize}
              setPaperSize={doc.setPaperSize}
              docSelected={doc.docSelected}
              setDocSelected={doc.setDocSelected}
            />
          </Sidebar>
        </div>
        <EditorStatusBar scene={scene} selection={selection} view={view} machine={modality.machine} />
      </div>
    </ActiveToolContextProvider>
  );
}
