import { useState, type ComponentType, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import {
  ActionsProvider,
  DepRegistryProvider,
  asNodeId,
  createScene,
  useAction,
  useDepSource,
  useSelection,
  useStandardActions,
} from '@weasel-js/core';
import { CommandBar, type CommandBarProps } from './CommandBar';
import { StripDock } from './surfaces/StripSurfaces';
import {
  preferencesAction,
  releaseCompoundAction,
  toggleGridAction,
  toggleSnapAction,
  toggleSymmetryAction,
  type AppCommands,
} from './appCommands/actions';
import type { WeaselDrawData, WeaselDrawLayer, WeaselDrawPose } from './drawDocument';
import { useDebugCommands } from './dev/devRoutes';
import { useFileCommands } from './fileCommands';
import './app.css';

// Every strip is drawn from the action registry,
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
  const [symmetryOn, setSymmetry] = useState(false);
  const commands: AppCommands = {
    gridVisible,
    toggleGrid: () => setGrid((v) => !v),
    snapToGrid,
    toggleSnap: () => setSnap((v) => !v),
    symmetryOn,
    toggleSymmetry: () => setSymmetry((v) => !v),
    canReleaseCompound: compound,
    releaseCompound: noop,
    openPrefs: noop,
    openPalette: noop,
    chromeHidden: () => false,
    toggleChrome: noop,
  };
  useDepSource('appCommands', () => commands);
  useAction(toggleGridAction);
  useAction(toggleSnapAction);
  useAction(toggleSymmetryAction);
  useAction(releaseCompoundAction);
  useAction(preferencesAction);
  useDebugCommands();
  useFileCommands({
    scene: storyScene, filename: 'story', paperSize: 'letter', backgroundColor: '#ffffff',
    setFilename: noop, showFirstPage: noop, page: null, setBackgroundColor: noop,
  });
  return <>{children}</>;
}

const noop = () => {};

const storyScene = createScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>({ systemLayers: [{ id: 'default' }] });

const baseArgs: CommandBarProps = {};

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
  // The strip's toolbars sit in their own dock row under the command bar, as in the app.
  render: (args) => (
    <>
      <CommandBar {...args} />
      <StripDock />
    </>
  ),
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
