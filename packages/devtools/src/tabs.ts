/** The panel's tabs, in order. A new area of the protocol is a new entry here and a view of its own. */
import type { ComponentType } from 'react';
import type { DevtoolsClient } from './client';
import { DispatchView } from './views/DispatchView';
import { FrameView } from './views/FrameView';
import { SceneView } from './views/SceneView';
import { StateView } from './views/StateView';

/** What every tab's view is handed: the connection, and the root the picker has chosen. */
export interface DevtoolsViewProps {
  client: DevtoolsClient;
  rootId: string;
}

export type DevtoolsTabId = 'scene' | 'state' | 'dispatch' | 'frame';

export interface DevtoolsTab {
  id: DevtoolsTabId;
  label: string;
  View: ComponentType<DevtoolsViewProps>;
}

export const DEVTOOLS_TABS: readonly DevtoolsTab[] = [
  { id: 'scene', label: 'Scene', View: SceneView },
  { id: 'state', label: 'State', View: StateView },
  { id: 'dispatch', label: 'Dispatch', View: DispatchView },
  { id: 'frame', label: 'Frame', View: FrameView },
];
