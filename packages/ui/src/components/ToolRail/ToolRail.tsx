import { Fragment } from 'react';
import { formatShortcut } from '@weasel-js/gestures';
import { ToolButton } from '../ToolButton';
import { ToolGroup } from '../ToolGroup';
import { RunScope, type Orientation } from '../Run';
import { useRovingTabIndex } from '../../useRovingTabIndex';
import { Icon } from '../../icons/Icon';
import { isActive, isSlot, isStack, railRuns, type ToolRailButton, type ToolRailItem } from './items';
import { RailStack, type StackCycleModifier } from './RailStack';
import type { DensityProps } from '../Density';
import s from './ToolRail.module.css';
import { holdScope, type DisableableProps } from '../Disabled';

/** Props for {@link ToolRail}. */
export interface ToolRailProps extends DensityProps, DisableableProps {
  items: readonly ToolRailItem[];
  orientation?: Orientation;
  /** Lays each run out as a grid this many buttons across, the runs stacked; `orientation` then says nothing. */
  columns?: number;
  /** The glyphs' size in pixels. Defaults to `Icon`'s. */
  iconSize?: number;
  /** The modifier that makes a click on a stack press its next member. Default `'alt'`. */
  stackCycle?: StackCycleModifier;
  /** The toolbar's accessible name. Default `"Tools"`. */
  'aria-label'?: string;
  /** Replaces the rail's frame: its surface, border, padding and gaps sit at zero specificity. */
  className?: string;
}

/**
 * A toolbar of icon buttons in rule-divided runs, walked by the arrow keys along its orientation, with the tab
 * stop on the active button. It draws what its items say and holds no selection of its own: `ToolPalette` is
 * this rail over a canvas's `ToolsApi`.
 */
export function ToolRail(props: ToolRailProps) {
  const {
    items, orientation = 'vertical', columns, iconSize, stackCycle = 'alt', 'aria-label': ariaLabel = 'Tools',
    size, className,
  } = props;
  const runs = railRuns(items);
  const buttons = runs.flatMap((run) => run.items.filter((item) => !isSlot(item)));
  const activeIndex = buttons.findIndex(isActive);
  const roving = useRovingTabIndex({
    itemSelector: `.${s.item}`,
    orientation: columns ? undefined : orientation,
    tabStopIndex: activeIndex >= 0 ? activeIndex : undefined,
    columns,
    groupSelector: '[role="group"]',
  });
  const horizontal = !columns && orientation === 'horizontal';
  const cls = [s.rail, horizontal && s.horizontal, className].filter(Boolean).join(' ');

  const button = (item: ToolRailButton) => (
    <ToolButton
      key={item.id}
      icon={<Icon name={item.icon} size={iconSize} />}
      label={item.label}
      description={item.description}
      shortcut={formatShortcut(item.shortcut)}
      active={item.active}
      disabled={item.disabled}
      disabledReason={item.disabledReason}
      className={[s.item, item.disabled && s.disabledBtn, item.className].filter(Boolean).join(' ')}
      onClick={() => item.onPress()}
      onPointerDown={item.onPointerDown}
      onDragStart={item.onDragStart}
    />
  );

  return (
    <div
      ref={roving.rootRef}
      onKeyDown={roving.onKeyDown}
      className={cls}
      role="toolbar"
      aria-label={ariaLabel}
      aria-orientation={columns ? undefined : orientation}
    >
      <RunScope orientation={orientation}>
      {holdScope(props, runs.map((run, i) => (
        <Fragment key={run.key}>
          {i > 0 && <hr className={s.rule} aria-orientation={horizontal ? 'vertical' : 'horizontal'} />}
          <ToolGroup columns={columns} groupKey={run.group} aria-label={run.group} size={size}>
            {run.items.map((item) =>
              isStack(item) ? <RailStack key={item.id} stack={item} cycle={stackCycle} iconSize={iconSize} />
                : isSlot(item) ? <Fragment key={item.id}>{item.render()}</Fragment>
                  : button(item))}
          </ToolGroup>
        </Fragment>
      )))}
      </RunScope>
    </div>
  );
}
