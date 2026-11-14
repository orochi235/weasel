import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { Select } from '@weasel-js/ui/components/Select';
import { useFontFamilyOptions, useFontWeightOptions } from '@weasel-js/ui/components/FontOptions';

function FontPickers({ initialFamily }: { initialFamily?: string }) {
  const [family, setFamily] = useState<string | undefined>(initialFamily);
  const [weight, setWeight] = useState(400);
  const familyOptions = useFontFamilyOptions({ value: family, weight });
  const weightOptions = useFontWeightOptions({ family, value: weight });
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <Select<string> aria-label="Font" options={familyOptions} selectedKey={family ?? null} onSelectionChange={setFamily} />
      <Select<string>
        aria-label="Weight"
        options={weightOptions}
        selectedKey={String(weight)}
        onSelectionChange={(key) => setWeight(Number(key))}
      />
    </div>
  );
}

const meta: Meta<typeof FontPickers> = {
  title: 'ui/Select/Font options',
  component: FontPickers,
};
export default meta;

type Story = StoryObj<typeof FontPickers>;

/** `useFontFamilyOptions` offers every family the font registry can paint; `useFontWeightOptions` offers the
 *  chosen family's faces, or the nine CSS weights for a family with none on file. */
export const Default: Story = {};

/** A family nobody registered stays on offer as its own entry, naming what paints in its place. */
export const NotLoaded: Story = {
  args: { initialFamily: 'Comic Neue' },
};
