import { useRef, type ReactElement, type ReactNode } from 'react';
import { selection, soloFrom, type MultipleSelection } from '@weasel-js/ui-input';
import { SegmentSweeper, SWEEP_INDEX_ATTR, useSweepGuard } from '../Segmented/segmentSweep';
import type { SegmentedSweepProps } from '../Segmented/SegmentedBar';
import { Checkbox } from '../Checkbox/Checkbox';
import { Switch } from '../Switch/Switch';
import type { ToggleHeld } from '../toggleHeld';
import { useButtonAccess } from '../Tooltip/buttonTooltip';
import { holdScope, type DisableableProps, type ReadOnlyProps } from '../Disabled';
import { useFieldControl } from '../Field/fieldSemantics';
import type { Orientation } from '../Run';
import s from './CheckboxGroup.module.css';

/** One box of a {@link CheckboxGroup}, identified by its `value`. */
export type CheckboxGroupItem<V extends string | number = string> = {
  value: V;
  label: ReactNode;
  ariaLabel?: string;
} & DisableableProps;

/** Props for {@link CheckboxGroup}: a `'multiple'` selection over its items, which may sweep. */
export type CheckboxGroupProps<V extends string | number = string> = Omit<MultipleSelection<V>, 'mode'> & SegmentedSweepProps<V>
  & DisableableProps & ReadOnlyProps & {
    items: readonly CheckboxGroupItem<V>[];
    /** What each item is drawn as. Default `'checkbox'`. */
    control?: 'checkbox' | 'switch';
    /** `'vertical'` (the default) stacks the items; `'horizontal'` runs them in a row that wraps. */
    orientation?: Orientation;
    /** Names the group. Without it or `aria-labelledby`, the group takes the name, description and error of a
     *  `Field` around it. */
    'aria-label'?: string;
    'aria-labelledby'?: string;
    'aria-describedby'?: string;
    className?: string;
  };

/**
 * A list of `Checkbox`es or `Switch`es, each one on or off, the selection held as the list of values that are on:
 * `SegmentedBar`'s `'multiple'` mode drawn as labeled boxes. Each box keeps its own tab stop and keys. Alt-clicking
 * one, or Alt+Space, solos it: it on and every other one off, or, when that already holds, every one on. With
 * `sweep`, a drag from one box across the others sets each to what the press set the first, and an Alt-drag solos
 * the boxes it reaches.
 */
export function CheckboxGroup<V extends string | number = string>(props: CheckboxGroupProps<V>): ReactElement {
  const { items, className, control = 'checkbox', orientation = 'vertical' } = props;
  const naming = useFieldControl({ 'aria-label': props['aria-label'], 'aria-labelledby': props['aria-labelledby'], 'aria-describedby': props['aria-describedby'] });
  const held = useButtonAccess({ ...props, holdsValue: true }).state !== 'enabled';
  const usable = (i: number): boolean => !held && items[i] !== undefined && !items[i].disabled;
  const values = items.map((it) => it.value);
  const model = selection<V>({ ...props, mode: 'multiple' }, values);
  const guard = useSweepGuard();
  const root = useRef<HTMLDivElement>(null);
  const Box = control === 'switch' ? Switch : Checkbox;
  const change = (i: number, keys: ToggleHeld): void => {
    if (!usable(i) || guard.sweeping()) return;
    if (keys.alt) soloFrom(model, i, items.length, usable);
    else model.press(i);
  };

  const set = (
    <div ref={root} role="group" {...naming} className={[s.root, className].filter(Boolean).join(' ')} data-orientation={orientation}>
      {items.map((item, i) => {
        const state = model.stateOf(i);
        return (
          <div key={String(item.value)} className={s.item} {...(props.sweep ? { [SWEEP_INDEX_ATTR]: i } : {})}>
            <Box
              isSelected={state === 'on'}
              {...(control === 'checkbox' ? { indeterminate: state === 'mixed' } : {})}
              disabled={item.disabled}
              disabledReason={item.disabledReason}
              aria-label={item.ariaLabel}
              onChange={(_on: boolean, keys: ToggleHeld) => change(i, keys)}
            >
              {item.label}
            </Box>
          </div>
        );
      })}
    </div>
  );
  if (!props.sweep) return holdScope(props, set);
  return (
    <>
      {holdScope(props, set)}
      <SegmentSweeper rootRef={root} values={values} sweepable={usable} model={model} sweep={props.sweep} swept={guard.swept} />
    </>
  );
}
