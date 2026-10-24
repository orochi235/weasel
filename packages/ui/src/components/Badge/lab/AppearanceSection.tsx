import { InlineRange } from '@weasel-js/ui/components/InlineRange';
import { BADGE_LOOKS, type BadgeLook } from '../looks';
import type { BadgeVariant } from '../types';
import { Field, LabToggle, RangeRow } from './ParamControl';
import type { LabSnapshot } from './snapshot';
import controls from './controls.stories.module.css';
import s from './ComposeLab.stories.module.css';

type Appearance = Pick<
  LabSnapshot,
  'variant' | 'look' | 'tint' | 'bloat' | 'size' | 'label' | 'crawlOn' | 'crawlSpeed' | 'labelX' | 'labelY'
>;

const VARIANTS: readonly BadgeVariant[] = ['outline', 'solid', 'subtle'];
const LOOKS: readonly BadgeLook[] = [...BADGE_LOOKS, 'tint'];
const SIZES: readonly LabSnapshot['size'][] = ['sm', 'md'];

export function AppearanceSection({ value, onChange }: { value: Appearance; onChange: (patch: Partial<Appearance>) => void }) {
  return (
    <section className={s.section}>
      <h3 className={s.sectionTitle}>Appearance</h3>
      <Field label="variant" columns={controls.wide2}>
        <LabToggle value={value.variant} options={VARIANTS} onChange={(variant) => onChange({ variant })} />
      </Field>
      <Field label="look" columns={s.look} group>
        <LabToggle value={value.look} options={LOOKS} name="look" onChange={(look) => onChange({ look })} />
        <input
          type="color"
          aria-label="Tint color"
          className={s.tintSwatch}
          value={value.tint}
          onChange={(e) => onChange({ tint: e.target.value, look: 'tint' })}
          title="Pick a tint color"
        />
      </Field>
      <RangeRow label="bloat" min={-10} max={20} step={0.25} value={value.bloat} onChange={(bloat) => onChange({ bloat })} />
      <Field label="size" columns={controls.wide2}>
        <LabToggle value={value.size} options={SIZES} onChange={(size) => onChange({ size })} />
      </Field>
      <Field label="label" columns={controls.wide2}>
        <input type="text" className={s.labelInput} value={value.label} onChange={(e) => onChange({ label: e.target.value })} />
      </Field>
      <Field label="crawl" columns={s.crawl} group>
        <input type="checkbox" aria-label="Crawl" checked={value.crawlOn} onChange={(e) => onChange({ crawlOn: e.target.checked })} />
        <InlineRange
          aria-label="Crawl speed"
          className={controls.fill}
          min={-2}
          max={2}
          step={0.05}
          value={value.crawlSpeed}
          onChange={(e) => onChange({ crawlSpeed: Number(e.target.value) })}
          disabled={!value.crawlOn}
        />
        <span className={controls.label}>{value.crawlSpeed.toFixed(2)}</span>
      </Field>
      <RangeRow label="label X" min={-30} max={30} step={0.5} value={value.labelX} onChange={(labelX) => onChange({ labelX })} />
      <RangeRow label="label Y" min={-30} max={30} step={0.5} value={value.labelY} onChange={(labelY) => onChange({ labelY })} />
    </section>
  );
}
