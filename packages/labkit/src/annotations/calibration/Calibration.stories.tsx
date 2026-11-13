import type { Meta, StoryObj } from '@weasel-js/forge';
import { Lab } from '@weasel-js/labkit';
import { calibrationInstrument } from './calibrationInstrument';

// A maintainer's check that marks land where the pointer went: trace each guide, read the scores, and Copy report
// for review. The instrument's settings switch the condition — scale, a scrolled pane, a zoom.
const meta: Meta<typeof Lab> = {
  title: 'labkit/Annotations/Calibration',
  component: Lab,
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof Lab>;

const lab = (name: string, start: Parameters<typeof calibrationInstrument>[0] = {}) => ({
  args: {
    instruments: [calibrationInstrument(start)],
    opening: ['Calibration'],
    title: name,
  },
});

export const AtIntrinsicSize: Story = lab('Calibration');

export const AtHalfSize: Story = lab('Calibration at 0.5×', { scale: '0.5' });

export const AtDoubleSize: Story = lab('Calibration at 2×', { scale: '2' });

export const InAScrolledPane: Story = lab('Calibration in a scrolled pane', { scrolled: true });

export const Zoomed: Story = lab('Calibration zoomed', { zoom: '3', focus: 'freehand-circle' });
