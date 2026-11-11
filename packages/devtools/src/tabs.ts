/** The panel's tabs, in order. A new area of the protocol is a new entry here and a view of its own. */
import type { ComponentType } from 'react';
import type { IconRef } from '@weasel-js/icons';
import type { DevtoolsClient } from './client';
import { icon } from './icons.gen';
import { DispatchView } from './views/DispatchView';
import { FrameView } from './views/FrameView';
import { HistoryView } from './views/HistoryView';
import { RegistryView } from './views/RegistryView';
import { SceneView } from './views/SceneView';
import { StateView } from './views/StateView';

/** What every tab's view is handed: the connection, and the root the picker has chosen. */
export interface DevtoolsViewProps {
  client: DevtoolsClient;
  rootId: string;
}

/** A tab of the panel, as `DevtoolsPanel`'s `tabs` and `defaultTab` name it. */
export type DevtoolsTabId = 'scene' | 'state' | 'registry' | 'dispatch' | 'history' | 'frame';

export interface DevtoolsTab {
  id: DevtoolsTabId;
  label: string;
  /** Shown beside the label in the tab bar. */
  icon: IconRef;
  View: ComponentType<DevtoolsViewProps>;
}

export const DEVTOOLS_TABS: readonly DevtoolsTab[] = [
  { id: 'scene', label: 'Scene', icon: icon('ui:layers'), View: SceneView },
  { id: 'state', label: 'State', icon: icon('ui:typeBraces'), View: StateView },
  { id: 'registry', label: 'Registry', icon: icon('ui:repoBook'), View: RegistryView },
  { id: 'dispatch', label: 'Dispatch', icon: icon('ui:demoRoute'), View: DispatchView },
  { id: 'history', label: 'History', icon: icon('ui:commitHistory'), View: HistoryView },
  { id: 'frame', label: 'Frame', icon: icon('ui:speed'), View: FrameView },
];
