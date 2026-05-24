import type { Meta, StoryObj } from '@storybook/react-vite';
import type { BooleanOp } from '@orochi235/weasel';
import { ToolIcon } from './kindIcons';
import type { ToolKind } from './poseUpdate';

const TOOLS: ToolKind[] = [
  'rect', 'ellipse', 'polygon', 'star', 'line',
  'pen', 'pencil', 'text', 'imported',
];

const BOOLEAN_OPS: BooleanOp[] = [
  'union', 'intersect', 'subtract', 'exclude', 'divide',
];

function Gallery({ tools, ops }: { tools: ToolKind[]; ops?: BooleanOp[] }) {
  return (
    <div style={{ color: '#ddd', background: '#1a1a1a', padding: 16 }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600 }}>By tool</h3>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {tools.map((tool) => (
          <figure key={tool} style={{ margin: 0, textAlign: 'center', width: 56 }}>
            <ToolIcon tool={tool} />
            <figcaption style={{ fontSize: 11, marginTop: 4 }}>{tool}</figcaption>
          </figure>
        ))}
      </div>
      {ops && (
        <>
          <h3 style={{ margin: '20px 0 8px', fontSize: 13, fontWeight: 600 }}>
            By <code>producedBy</code> (tool = imported)
          </h3>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {ops.map((op) => (
              <figure key={op} style={{ margin: 0, textAlign: 'center', width: 56 }}>
                <ToolIcon tool="imported" producedBy={op} />
                <figcaption style={{ fontSize: 11, marginTop: 4 }}>{op}</figcaption>
              </figure>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const meta: Meta<typeof Gallery> = {
  title: 'draw/kindIcons',
  component: Gallery,
};
export default meta;

type Story = StoryObj<typeof Gallery>;

export const AllTools: Story = {
  args: { tools: TOOLS },
};

export const WithBooleanOpProvenance: Story = {
  args: { tools: TOOLS, ops: BOOLEAN_OPS },
};
