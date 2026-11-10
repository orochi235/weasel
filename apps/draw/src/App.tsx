/**
 * WeaselDraw's editor: one `<SceneCanvas features={['draw', pathTools]}>` with every built-in tool over a
 * `useScene` document, saved to local storage 300 ms after each change.
 */
import { useScene, useSelection } from '@weasel-js/core';
import { createRecentColorsStore, RecentColorsProvider } from '@weasel-js/ui/components/RecentColors';
import { type ReactElement, useState } from 'react';
import './app.css';
import { DRAW_LAYERS, DRAW_REGISTRY, type WeaselDrawData, type WeaselDrawLayer, type WeaselDrawPose } from './drawDocument';
import { Editor } from './Editor';
import { useModality } from './modality/useModality';
import { loadInitial, loadInitialDoc } from './sceneLoading';
import { ColorContextProvider } from './tools/colorContext/ColorContextProvider';
import { drawToolOptionValues } from './toolOptions';
import { useSessionPersistence } from './useSessionPersistence';

const RECENT_COLORS_KEY = 'weaseldraw:recent-colors';


export function App(): ReactElement {
  const [initialScene] = useState(loadInitial);
  const [initialDoc] = useState(loadInitialDoc);
  const scene = useScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>({
    systemLayers: DRAW_LAYERS,
    registry: DRAW_REGISTRY,
    initial: initialScene,
    doc: initialDoc,
  });
  const selection = useSelection({ mode: 'multi', scene });
  const modality = useModality(scene);
  useSessionPersistence(scene);

  const [recentColors] = useState(() => createRecentColorsStore({ key: RECENT_COLORS_KEY }));

  return (
    <RecentColorsProvider store={recentColors}>
      <ColorContextProvider values={drawToolOptionValues()}>
        <Editor scene={scene} selection={selection} modality={modality} />
      </ColorContextProvider>
    </RecentColorsProvider>
  );
}

export default App;
