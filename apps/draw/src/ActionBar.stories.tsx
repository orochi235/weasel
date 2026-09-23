import { useState, type ComponentType, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import {
  ActionsProvider,
  DepRegistryProvider,
  asNodeId,
  useSelection,
  useStandardActions,
} from '@weasel-js/core';
import { ActionBar, type ActionBarProps } from './ActionBar';
import './app.css';

// The editing strips are the kit's registry-driven `<ActionBar>`s, so the
// story registers the kit actions itself, the way `<SceneCanvas>` does in the
// app. Only a selection is published — enough to light up the
// selection-gated buttons; undo, paste and ungroup read deps a story has no
// document for, and stay off.
function KitActions({ selected, children }: { selected: number; children: ReactNode }) {
  const selection = useSelection({
    mode: 'multi',
    initial: Array.from({ length: selected }, (_, i) => asNodeId(`n${i}`)),
  });
  useStandardActions({ selection });
  return <>{children}</>;
}

const noop = () => {};

const baseArgs: ActionBarProps = {
  onSaveSvg: noop,
  onOpenSvg: noop,
  onNew: noop,
  gridVisible: false,
  onToggleGrid: noop,
  snapToGrid: false,
  onToggleSnap: noop,
  canReleaseCompound: false,
  onReleaseCompound: noop,
  onOpenPrefs: noop,
  recording: false,
  onToggleRecord: noop,
  recordingProfile: 'gesture-only',
  onChangeRecordingProfile: noop,
  onPlay: noop,
};

const withKit = (selected: number) => (Story: ComponentType) => (
  <ActionsProvider>
    <DepRegistryProvider>
      <KitActions selected={selected}>
        <Story />
      </KitActions>
    </DepRegistryProvider>
  </ActionsProvider>
);

const meta: Meta<typeof ActionBar> = {
  title: 'draw/ActionBar',
  component: ActionBar,
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof ActionBar>;

export const EmptyDocument: Story = {
  args: baseArgs,
  decorators: [withKit(0)],
};

export const WithSelection: Story = {
  args: { ...baseArgs, canReleaseCompound: true },
  decorators: [withKit(3)],
};

// Interactive variant lets the reader toggle the grid/snap state
// buttons and see the active styling, without wiring real ops.
function InteractiveActionBar(args: ActionBarProps) {
  const [grid, setGrid] = useState(args.gridVisible);
  const [snap, setSnap] = useState(args.snapToGrid);
  const [recording, setRecording] = useState(args.recording);
  return (
    <ActionBar
      {...args}
      gridVisible={grid}
      onToggleGrid={() => setGrid((v) => !v)}
      snapToGrid={snap}
      onToggleSnap={() => setSnap((v) => !v)}
      recording={recording}
      onToggleRecord={() => setRecording((v) => !v)}
    />
  );
}

export const ToggleableViewState: Story = {
  args: baseArgs,
  decorators: [withKit(0)],
  render: (args) => <InteractiveActionBar {...args} />,
};
