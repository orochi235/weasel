import type { Meta, StoryObj } from '@weasel-js/forge';
import { IMPERIAL_INCHES, METRIC_MM, type UnitScope } from '@weasel-js/quantity';
import { ScaleBar } from '@weasel-js/ui/components/ScaleBar';

const BOARD: UnitScope = { system: IMPERIAL_INCHES };

const meta: Meta<typeof ScaleBar> = {
  title: 'ui/ScaleBar',
  component: ScaleBar,
  args: { zoom: 10, scopes: [BOARD] },
};
export default meta;
type Story = StoryObj<typeof ScaleBar>;

/** The board itself, in inches, at 10 px an inch. */
export const Board: Story = {};

/** A drawer's plan inset drawn at 0.4×: its true lengths, and what size it is drawn at. */
export const MagnifiedFrame: Story = {
  args: { scopes: [BOARD, { ...BOARD, drawnAt: 0.4 }] },
};

/** A metric sub-assembly inside the inch board. */
export const Metric: Story = {
  args: { zoom: 4, scopes: [BOARD, { system: METRIC_MM, scale: 1 / 25.4 }] },
};

/** Binary fractions of an inch, chosen from a list the app gives. */
export const OwnLengths: Story = {
  args: {
    zoom: 200,
    lengths: [{ value: 1 / 16, unit: 'in' }, { value: 1 / 8, unit: 'in' }, { value: 1 / 4, unit: 'in' }, { value: 1 / 2, unit: 'in' }],
  },
};
