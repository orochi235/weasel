import { useMemo } from 'react';
import type { Measurements, SelectionApi } from '@weasel-js/core';
import type { CornerControlsSelection } from '@weasel-js/path-tools';
import type { DrawScene } from '../drawDocument';
import { useBridgeTension, useSimplifyTolerance } from '../ui/PathCommands';
import type { useDocumentState } from '../useDocumentState';
import type { SidebarHost } from './types';

export interface EditorSurfaceHostInput {
  scene: DrawScene;
  selection: SelectionApi;
  measurements: Measurements;
  doc: ReturnType<typeof useDocumentState>;
  cornerSelection: CornerControlsSelection;
}

/** The editor state every surface's assets read, for `SurfaceHostContext`. */
export function useEditorSurfaceHost({ scene, selection, measurements, doc, cornerSelection }: EditorSurfaceHostInput): SidebarHost {
  const [simplifyTolerance, setSimplifyTolerance] = useSimplifyTolerance();
  const [bridgeTension, setBridgeTension] = useBridgeTension();
  const { filename, setFilename, backgroundColor, setBackgroundColor, paperSize, setPaperSize, docSelected, setDocSelected } = doc;
  return useMemo((): SidebarHost => ({
    scene, selection, measurements,
    filename, setFilename, backgroundColor, setBackgroundColor, paperSize, setPaperSize, docSelected, setDocSelected,
    cornerSelection, simplifyTolerance, setSimplifyTolerance, bridgeTension, setBridgeTension,
  }), [scene, selection, measurements, filename, setFilename, backgroundColor, setBackgroundColor, paperSize, setPaperSize,
    docSelected, setDocSelected, cornerSelection, simplifyTolerance, setSimplifyTolerance, bridgeTension, setBridgeTension]);
}
