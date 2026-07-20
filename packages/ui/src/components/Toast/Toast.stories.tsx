import type { Meta, StoryObj } from '@storybook/react';
import { ToastRegion } from './Toast';
import { createToastQueue } from './queue';
import { Button } from '../Button';

const meta: Meta<typeof ToastRegion> = {
  title: 'Primitives/Toast',
  component: ToastRegion,
};
export default meta;

type Story = StoryObj<typeof ToastRegion>;

const queue = createToastQueue();

export const Interactive: Story = {
  render: () => (
    <>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button onClick={() => queue.add('info', 'Heads up', { description: 'Neutral information.' })}>info</Button>
        <Button onClick={() => queue.add('success', 'Saved', { description: 'All changes stored.' })}>success</Button>
        <Button onClick={() => queue.add('warning', 'SVG import', { description: '3 unsupported elements skipped.' })}>warning</Button>
        <Button onClick={() => queue.add('error', 'Export failed', { ttlMs: null, description: 'Sticky until dismissed.' })}>error (sticky)</Button>
        <Button variant="ghost" onClick={() => queue.add('info', 'Deduped', { id: 'dedupe-demo', description: 'Re-click: replaces, never stacks.' })}>deduped id</Button>
      </div>
      <ToastRegion queue={queue} />
    </>
  ),
};
