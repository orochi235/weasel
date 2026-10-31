import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { ActionsProvider, type Action } from '@weasel-js/core';
import { pref, type PrefGroup } from '@weasel-js/prefs';
import { BarMenu } from '@weasel-js/ui/components/Bar';
import { Icon } from '@weasel-js/ui/components/Icon';
import { RegisterActions } from '@weasel-js/routing/testing/registerAction';
import { icon } from '../../icons.gen';
import s from './Bar.stories.module.css';

const ACTIONS: Action[] = [
  { id: 'view.fit', label: 'Zoom to fit', group: 'view', invoker: { timing: 'immediate', run: () => {} } },
  { id: 'view.actual', label: 'Actual size', group: 'view', invoker: { timing: 'immediate', run: () => {} } },
];

const VIEW: PrefGroup = pref.group('View', {
  grid: pref.boolean('Grid', true),
  rulers: pref.boolean('Rulers', false),
  units: pref.enum('Units', 'px', ['px', 'mm', 'in']),
  zoom: pref.actions('view'),
}, { as: 'menu' });

const meta: Meta<typeof BarMenu> = {
  title: 'ui/Bar/BarMenu',
  component: BarMenu,
  args: { label: 'View', description: 'What the workspace shows' },
};
export default meta;
type Story = StoryObj<typeof BarMenu>;

function Host(args: Story['args']) {
  const [values, setValues] = useState<Record<string, unknown>>({ grid: true, rulers: false, units: 'px' });
  return (
    <ActionsProvider>
      <RegisterActions actions={ACTIONS} />
      <div className={s.strip}>
        <BarMenu
          label="View"
          {...args}
          schema={VIEW}
          values={(path) => values[path]}
          onChange={(path, value) => setValues((v) => ({ ...v, [path]: value }))}
        />
      </div>
    </ActionsProvider>
  );
}

/** A group drawn `as: 'menu'`: flags open as checked items, a choice as radio rows, and an `actions` leaf as items. */
export const Default: Story = { render: (args) => <Host {...args} /> };

/** A glyph before the label. */
export const WithIcon: Story = { render: (args) => <Host {...args} icon={<Icon name={icon('zoomIn')} size={16} />} /> };
