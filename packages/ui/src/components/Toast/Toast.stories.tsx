import type { Meta, StoryObj } from '@weasel-js/forge';
import { ToastRegion, createToastQueue } from '@weasel-js/ui/components/Toast';
import { Button } from '@weasel-js/ui/components/Button';

const meta: Meta<typeof ToastRegion> = {
  title: 'ui/Foundations/Toast',
  component: ToastRegion,
};
export default meta;

type Story = StoryObj<typeof ToastRegion>;

const queue = createToastQueue();

export const Interactive: Story = {
  render: (args) => (
    <>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button onClick={() => queue.add('info', 'Heads up', { description: 'Neutral information.' })}>info</Button>
        <Button onClick={() => queue.add('success', 'Saved', { description: 'All changes stored.' })}>success</Button>
        <Button onClick={() => queue.add('warn', 'SVG import', { description: '3 unsupported elements skipped.' })}>warn</Button>
        <Button onClick={() => queue.add('danger', 'Export failed', { ttlMs: null, description: 'Sticky until dismissed.' })}>danger (sticky)</Button>
        <Button variant="ghost" onClick={() => queue.add('info', 'Deduped', { id: 'dedupe-demo', description: 'Re-click: replaces, never stacks.' })}>deduped id</Button>
      </div>
      <ToastRegion {...args} queue={queue} />
    </>
  ),
};
