import { type ReactElement, type ReactNode } from 'react';
import { selection, type MultipleSelection } from '@weasel-js/ui-input';
import { SegmentSweeper, SWEEP_INDEX_ATTR, useSweepGuard } from '../Segmented/segmentSweep';
import type { SegmentedSweepProps } from '../Segmented/SegmentedBar';
import { selectionRoving } from '../../selectionRoving';
import { useRovingTabIndex } from '../../useRovingTabIndex';
import { ButtonTooltip, useButtonAccess, type TooltipFields } from '../Tooltip/buttonTooltip';
import { holdScope, type DisableableProps, type ReadOnlyProps } from '../Disabled';
import { useFieldControl } from '../Field/fieldSemantics';
import s from './ToggleChips.module.css';

/** One chip of a {@link ToggleChips}, identified by its `value`. Its `label` is drawn as given: text, a `Badge`, anything. */
export type ToggleChipsItem<V extends string | number = string> = {
  value: V;
  label: ReactNode;
  ariaLabel?: string;
} & TooltipFields & DisableableProps;

/** Props for {@link ToggleChips}: a `'multiple'` selection over its items, which may sweep. */
export type ToggleChipsProps<V extends string | number = string> = Omit<MultipleSelection<V>, 'mode'> & SegmentedSweepProps<V>
  & DisableableProps & ReadOnlyProps & {
    items: readonly ToggleChipsItem<V>[];
    /** Names the set. Without it or `aria-labelledby`, the set takes the name, description and error of a `Field`
     *  around it. */
    'aria-label'?: string;
    'aria-labelledby'?: string;
    'aria-describedby'?: string;
    className?: string;
  };

/**
 * A set of toggle chips that wraps onto as many lines as it needs, each chip on or off, the selection held as the
 * list of values that are on. A chip that is off is drawn dimmed. It is `SegmentedBar`'s `'multiple'` mode in a
 * different layout: the same selection, the same keys (the arrows move focus, Space and Enter flip the focused chip),
 * and with `sweep` the same drag, which sets every chip it reaches to what the press set the first one to.
 */
export function ToggleChips<V extends string | number = string>(props: ToggleChipsProps<V>): ReactElement {
  const { items, className } = props;
  const naming = useFieldControl({ 'aria-label': props['aria-label'], 'aria-labelledby': props['aria-labelledby'], 'aria-describedby': props['aria-describedby'] });
  const held = useButtonAccess({ ...props, holdsValue: true }).state !== 'enabled';
  const usable = (i: number): boolean => !held && items[i] !== undefined && !items[i].disabled;
  const values = items.map((it) => it.value);
  const model = selection<V>({ ...props, mode: 'multiple' }, values);
  const guard = useSweepGuard();
  const roving = useRovingTabIndex({ itemSelector: `.${s.chip}`, ...selectionRoving(model, items.length, usable) });

  const set = (
    <div ref={roving.rootRef} onKeyDown={roving.onKeyDown} role="group" {...naming} className={[s.root, className].filter(Boolean).join(' ')}>
      {items.map((item, i) => {
        const state = model.stateOf(i);
        return (
          <ButtonTooltip key={String(item.value)} tip={item} disabled={item.disabled} disabledReason={item.disabledReason} holdsValue>
            <button
              type="button"
              aria-pressed={state === 'mixed' ? 'mixed' : state === 'on'}
              aria-label={item.ariaLabel}
              disabled={item.disabled}
              className={s.chip}
              data-state={state}
              {...(props.sweep ? { [SWEEP_INDEX_ATTR]: i } : {})}
              onClick={() => {
                if (usable(i) && !guard.sweeping()) model.press(i);
              }}
            >
              {item.label}
            </button>
          </ButtonTooltip>
        );
      })}
    </div>
  );
  if (!props.sweep) return holdScope(props, set);
  return (
    <>
      {holdScope(props, set)}
      <SegmentSweeper rootRef={roving.rootRef} values={values} sweepable={usable} model={model} sweep={props.sweep} swept={guard.swept} />
    </>
  );
}
