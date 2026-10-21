/**
 * WeaselDraw's editor: one `<SceneCanvas features={['draw', pathTools]}>` with every built-in tool over a
 * `useScene` document, saved to local storage 300 ms after each change.
 */
import { DEFAULT_STROKE_COLOR, useScene, useSelection } from '@weasel-js/core';
import { createRecentColorsStore, RecentColorsProvider } from '@weasel-js/ui/components/RecentColors';
import { type ReactElement, useState } from 'react';
import type { ActivePaint } from './ActiveSwatches';
import './app.css';
import { DRAW_LAYERS, DRAW_REGISTRY, type WeaselDrawData, type WeaselDrawLayer, type WeaselDrawPose } from './drawDocument';
import { Editor } from './Editor';
import { useModality } from './modality/useModality';
import { loadInitial } from './sceneLoading';
import { ColorContextProvider } from './tools/colorContext/ColorContextProvider';
import { useSessionPersistence } from './useSessionPersistence';

const RECENT_COLORS_KEY = 'weaseldraw:recent-colors';

/** Seed fill for a fresh document: a blue rather than the kit's white `DEFAULT_FILL_COLOR`,
 *  so a new shape lands visible against the white page. */
const INITIAL_FILL: ActivePaint = { kind: 'solid', color: '#7ab8d4ff' };
const INITIAL_STROKE: ActivePaint = { kind: 'solid', color: DEFAULT_STROKE_COLOR };

export function App(): ReactElement {
  const [initialScene] = useState(loadInitial);
  const scene = useScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>({
    systemLayers: DRAW_LAYERS,
    registry: DRAW_REGISTRY,
    initial: initialScene,
  });
  const selection = useSelection({ mode: 'multi', scene });
  const modality = useModality(scene);
  useSessionPersistence(scene);

  const [recentColors] = useState(() => createRecentColorsStore({ key: RECENT_COLORS_KEY }));

  return (
    <RecentColorsProvider store={recentColors}>
      <ColorContextProvider initialFill={INITIAL_FILL} initialStroke={INITIAL_STROKE}>
        <Editor scene={scene} selection={selection} modality={modality} />
      </ColorContextProvider>
    </RecentColorsProvider>
  );
}

export default App;
