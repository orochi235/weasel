import type { Meta, StoryObj } from '@weasel-js/forge';
import { FallthroughDiagram } from './FallthroughDiagram';
import { bareDragSelect, claimDropped, escapeInPathEdit, nothingMatched, predictedHover } from './fixtures';

const meta: Meta<typeof FallthroughDiagram> = {
  title: 'ui/Foundations/FallthroughDiagram',
  component: FallthroughDiagram,
  args: { record: escapeInPathEdit },
};
export default meta;

type Story = StoryObj<typeof FallthroughDiagram>;

export const EscapeInPathEdit: Story = {};
export const BareDragSelect: Story = { args: { record: bareDragSelect } };
export const ClaimDropped: Story = { args: { record: claimDropped } };
export const PredictedHover: Story = { args: { record: predictedHover } };
export const NothingMatched: Story = { args: { record: nothingMatched } };
