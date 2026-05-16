import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ActionBar, type ActionBarProps } from './ActionBar';
import './swillustrator.css';

// The ActionBar pulls icons and button styling from `swillustrator.css`;
// importing it at story load mirrors the live app's chrome so the
// component looks right in isolation. Booleans adapter/actions are stubs
// — the story is about chrome, not behavior.

const noop = () => {};

const booleansAdapter: ActionBarProps['booleansAdapter'] = {
  getSelection: () => [],
  getWorldPath: () => undefined,
};

const booleansActions: ActionBarProps['booleansActions'] = {
  union: noop, intersect: noop, subtract: noop, exclude: noop, divide: noop, crop: noop,
};

const baseArgs: ActionBarProps = {
  canUndo: false,
  canRedo: false,
  onUndo: noop,
  onRedo: noop,
  hasSelection: false,
  hasMultiSelection: false,
  selectionSize: 0,
  onDelete: noop,
  onDuplicate: noop,
  onCopy: noop,
  onCut: noop,
  onPaste: noop,
  clipboardEmpty: true,
  onBringForward: noop,
  onSendBackward: noop,
  onBringToFront: noop,
  onSendToBack: noop,
  canMoveForward: false,
  canMoveBackward: false,
  onGroup: noop,
  onUngroup: noop,
  canUngroup: false,
  onAlign: noop,
  onDistribute: noop,
  onFlip: noop,
  booleansAdapter,
  booleansActions,
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
  onPlay: noop,
};

const meta: Meta<typeof ActionBar> = {
  title: 'swillustrator/ActionBar',
  component: ActionBar,
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof ActionBar>;

export const EmptyDocument: Story = {
  args: baseArgs,
};

export const WithSelection: Story = {
  args: {
    ...baseArgs,
    canUndo: true,
    hasSelection: true,
    hasMultiSelection: true,
    selectionSize: 3,
    clipboardEmpty: false,
    canMoveForward: true,
    canMoveBackward: true,
    canUngroup: true,
    canReleaseCompound: true,
  },
};

// Interactive variant lets the storybook user toggle the grid/snap state
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
  render: (args) => <InteractiveActionBar {...args} />,
};
