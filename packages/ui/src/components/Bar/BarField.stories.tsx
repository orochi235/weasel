import type { Meta, StoryObj } from '@weasel-js/forge';
import { Fragment } from 'react';
import { PropertyField, PropertyList } from '@weasel-js/ui/components/Properties';
import { BarField } from '@weasel-js/ui/components/Bar';
import { useStoryFields } from './barStoryFields';
import s from './Bar.stories.module.css';

const meta: Meta<typeof BarField> = {
  title: 'ui/Bar/BarField',
  component: BarField,
};
export default meta;
type Story = StoryObj<typeof BarField>;

function Strip({ only }: { only: (id: string) => boolean }) {
  const fields = useStoryFields().filter(({ id }) => only(id));
  return (
    <div className={s.strip}>
      {fields.map(({ id, field }) => (
        <BarField key={id} {...field} />
      ))}
    </div>
  );
}

const kind = (name: string) => (id: string) => id.split(' ')[0] === name;

/** Every kind in the form it takes with no `control` named. */
export const Kinds: Story = { render: () => <Strip only={(id) => !id.includes(' ')} /> };

/** A box of digits behind its name, or a short track with its readout. */
export const Number: Story = { render: () => <Strip only={kind('number')} /> };

/** A box behind its name. A text area has no line to sit on, so it opens from a button. */
export const Text: Story = { render: () => <Strip only={kind('string')} /> };

/** A button held down while on. A switch and a checkbox come before their names. */
export const Flag: Story = { render: () => <Strip only={kind('boolean')} /> };

/** A select, segments, or a button reading the value. A radio group draws as segments. */
export const Choice: Story = { render: () => <Strip only={kind('enum')} /> };

/** A color's chip and a paint's swatch, each opening its editor. */
export const ColorAndPaint: Story = { render: () => <Strip only={(id) => id === 'color' || id === 'paint'} /> };

export const Fonts: Story = { render: () => <Strip only={(id) => id.startsWith('font')} /> };

/** Each kind and control as a row of a panel and as a cell of a bar. */
export const RowBesideBar: Story = {
  render: () => {
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
                <BarField {...field} />
              </div>
            </Fragment>
          ))}
        </div>
      );
    }
    return <Matrix />;
  },
};
