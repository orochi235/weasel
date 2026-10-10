import type { Meta, StoryObj } from '@weasel-js/forge';
import { CodeBlock } from './CodeBlock';

const SAMPLE = `// A pref group, as the schema editor exports it.
const prefs: PrefGroup = {
  name: 'View',
  children: {
    grid: { kind: 'boolean', name: 'Show grid', default: true },
    spacing: { kind: 'number', name: 'Spacing', default: 8, encoding: readSpacing },
    snap: null,
  },
};`;

const meta: Meta<typeof CodeBlock> = {
  title: 'ui/Foundations/CodeBlock',
  component: CodeBlock,
  args: { code: SAMPLE, language: 'tsx', lineNumbers: false },
  argTypes: {
    language: { control: 'select', options: ['tsx', 'ts', 'json', 'css', 'md'] },
  },
};
export default meta;
type Story = StoryObj<typeof CodeBlock>;

export const Default: Story = {};

export const LineNumbers: Story = { args: { lineNumbers: true } };
