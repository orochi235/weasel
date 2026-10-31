import type { Meta, StoryObj } from '@weasel-js/forge';
import { Fragment } from 'react';
import { PropertyField, PropertyList } from '@weasel-js/ui/components/Properties';
import { BarField, type BarFieldProps } from '@weasel-js/ui/components/Bar';
import { OrientationContext } from '../orientation';
import { useStoryFields } from './barStoryFields';
import s from './Bar.stories.module.css';

const meta: Meta<typeof BarField> = {
  title: 'ui/Bar/BarField',
  component: BarField,
};
export default meta;
type Story = StoryObj<typeof BarField>;

// What every kind of field takes: each field the story draws sets its own kind and value.
type Shared = Partial<Omit<BarFieldProps, 'kind' | 'value' | 'onChange' | 'onInput' | 'control'>>;

function Strip({ args, only, vertical = false }: { args: Story['args']; only: (id: string) => boolean; vertical?: boolean }) {
  const fields = useStoryFields().filter(({ id }) => only(id));
  return (
    <OrientationContext.Provider value={vertical ? 'vertical' : 'horizontal'}>
      <div className={vertical ? s.column : s.strip}>
        {fields.map(({ id, field }) => (
          <BarField key={id} {...(args as Shared)} {...field} />
        ))}
      </div>
    </OrientationContext.Provider>
  );
}

const kind = (name: string) => (id: string) => id.split(' ')[0] === name;

/** Every kind in the form it takes with no `control` named. */
export const Kinds: Story = { render: (args) => <Strip args={args} only={(id) => !id.includes(' ')} /> };

/** Every kind and control as a vertical bar holds it: its parts stacked and turned, each upright. */
export const Vertical: Story = { render: (args) => <Strip args={args} only={() => true} vertical /> };

/** A box of digits behind its name, or a short track with its readout. */
export const Number: Story = { render: (args) => <Strip args={args} only={kind('number')} /> };

/** A box behind its name. A text area has no line to sit on, so it opens from a button. */
export const Text: Story = { render: (args) => <Strip args={args} only={kind('string')} /> };

/** A button held down while on. A switch and a checkbox come before their names. */
export const Flag: Story = { render: (args) => <Strip args={args} only={kind('boolean')} /> };

/** A select, segments, or a button reading the value. A radio group draws as segments. */
export const Choice: Story = { render: (args) => <Strip args={args} only={kind('enum')} /> };

/** A color's chip and a paint's swatch, each opening its editor. */
export const ColorAndPaint: Story = { render: (args) => <Strip args={args} only={(id) => id === 'color' || id === 'paint'} /> };

export const Fonts: Story = { render: (args) => <Strip args={args} only={(id) => id.startsWith('font')} /> };

/** Each kind and control as a row of a panel and as a cell of a bar. */
export const RowBesideBar: Story = {
  render: (args) => {
    function Matrix() {
      const fields = useStoryFields();
      return (
        <div className={s.matrix}>
          <span className={s.head}>Kind</span>
          <span className={s.head}>Row</span>
          <span className={s.head}>Bar</span>
          {fields.map(({ id, field }) => (
            <Fragment key={id}>
              <span className={s.kind}>{id}</span>
              <div className={s.row}>
                <PropertyList>
                  <PropertyField {...field} label={field.name} />
                </PropertyList>
              </div>
              <div className={s.strip}>
                <BarField {...(args as Shared)} {...field} />
              </div>
            </Fragment>
          ))}
        </div>
      );
    }
    return <Matrix />;
  },
};
