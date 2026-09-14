import type { Meta, StoryObj } from '@storybook/react-vite';
import { useCallback, useState } from 'react';
import { TokenPanel } from './TokenPanel';
import type { TokenEntry } from './tokenTypes';

const meta: Meta<typeof TokenPanel> = {
  title: 'weasel-ui/TokenPanel',
  component: TokenPanel,
};
export default meta;
type Story = StoryObj<typeof TokenPanel>;

const TOKENS: readonly TokenEntry[] = [
  ...['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'].map((step, i) => ({
    name: `--gray-${step}`,
    type: 'color',
    group: 'gray',
    value: `hsl(220 8% ${96 - i * 9.5}%)`,
  })),
  { name: '--accent', type: 'color', group: 'accent', value: '#5841b8' },
  { name: '--line-subtle', type: 'color', group: 'line', value: 'rgba(230, 231, 233, 0.1)' },
  { name: '--font-ui', type: 'fontFamily', group: 'font', value: 'Oswald, system-ui, sans-serif' },
  { name: '--font-weight-bold', type: 'fontWeight', group: 'font', value: '600' },
  { name: '--font-size', type: 'dimension', group: 'font', value: '13px' },
  { name: '--leading', type: 'number', group: 'leading', value: '1.4' },
  { name: '--space-sm', type: 'dimension', group: 'space', value: '8px' },
  { name: '--radius-md', type: 'dimension', group: 'radius', value: '5px' },
  { name: '--motion-fast', type: 'duration', group: 'motion', value: '120ms' },
  { name: '--ease-out-back', type: 'cubicBezier', group: 'ease', value: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
  { name: '--z-modal', type: 'number', group: 'z', value: '300' },
  { name: '--shadow', type: 'shadow', group: 'shadow', value: '0 1px 3px rgba(0, 0, 0, 0.3)' },
];

function Editable() {
  const [values, setValues] = useState<Record<string, string>>({});
  const onChange = useCallback((name: string, value: string | null) => {
    setValues(({ [name]: _dropped, ...rest }) => (value === null ? rest : { ...rest, [name]: value }));
  }, []);
  const tokens = TOKENS.map((t) =>
    t.name in values ? { ...t, value: values[t.name] as string, overridden: true } : t,
  );
  return (
    <div style={{ width: 300 }}>
      <TokenPanel tokens={tokens} onChange={onChange} />
    </div>
  );
}

export const Default: Story = {
  render: () => <Editable />,
};
