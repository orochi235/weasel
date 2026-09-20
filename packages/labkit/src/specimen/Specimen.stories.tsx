import type { Meta, StoryObj } from '@weasel-js/forge';
import { Specimen } from './Specimen';

const meta: Meta<typeof Specimen> = {
  title: 'labkit/Specimen',
  component: Specimen,
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof Specimen>;

export const Everything: Story = {};
