import { useState, type ComponentType, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import {
  ActionsProvider,
  DepRegistryProvider,
  asNodeId,
  useAction,
  useDepSource,
  useSelection,
  useStandardActions,
} from '@weasel-js/core';
import { CommandBar, type CommandBarProps } from './CommandBar';
import {
  preferencesAction,
  releaseCompoundAction,
  toggleGridAction,
  toggleSnapAction,
  type AppCommands,
} from './appCommands/actions';
import './app.css';

// Every strip but the file buttons is the kit's registry-driven `<ActionBar>`,
// so the story registers the kit actions and the app's own itself, the way
// `<SceneCanvas>` does in the app. Only a selection is published for the kit's:
// enough to light up the selection-gated buttons; undo, paste and ungroup read
// deps a story has no document for, and stay off.
function Actions({ selected, compound, children }: { selected: number; compound: boolean; children: ReactNode }) {
  const selection = useSelection({
    mode: 'multi',
    initial: Array.from({ length: selected }, (_, i) => asNodeId(`n${i}`)),
  });
  useStandardActions({ selection });
  const [gridVisible, setGrid] = useState(false);
  const [snapToGrid, setSnap] = useState(false);
  const commands: AppCommands = {
    gridVisible,
    toggleGrid: () => setGrid((v) => !v),
    snapToGrid,
    toggleSnap: () => setSnap((v) => !v),
    canReleaseCompound: compound,
    releaseCompound: noop,
    openPrefs: noop,
  };
  useDepSource('appCommands', () => commands);
  useAction(toggleGridAction);
  useAction(toggleSnapAction);
  useAction(releaseCompoundAction);
  useAction(preferencesAction);
  return <>{children}</>;
}

const noop = () => {};

const baseArgs: CommandBarProps = {
  onSaveSvg: noop,
  onOpenSvg: noop,
  onNew: noop,
};

const withActions = (selected: number, compound = false) => (Story: ComponentType) => (
  <ActionsProvider>
    <DepRegistryProvider>
      <Actions selected={selected} compound={compound}>
        <Story />
      </Actions>
    </DepRegistryProvider>
  </ActionsProvider>
);

const meta: Meta<typeof CommandBar> = {
  title: 'draw/CommandBar',
  component: CommandBar,
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof CommandBar>;

// Grid and snap toggle in every story: their state lives in the decorator.
export const EmptyDocument: Story = {
  args: baseArgs,
  decorators: [withActions(0)],
};

export const WithSelection: Story = {
  args: baseArgs,
  decorators: [withActions(3, true)],
};
