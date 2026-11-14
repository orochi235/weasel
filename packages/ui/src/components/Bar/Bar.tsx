import type { ReactNode } from 'react';
import type { IconSpec } from '@weasel-js/icons';
import type { PrefBarLead, PrefBarOverflow, PrefOrder } from '@weasel-js/prefs';
import { BarAlong } from './BarAlong';
import { dividedItems, lineItems } from './barItems';
import { BarMarkContext } from './barOrder';
import { BarLine } from './BarLine';
import { FormScope } from '../ActionButton/controlForm';
import { BarDivider, BarGroup, BarItem, BarReadout, BarSpacer } from './barParts';
import { useRun, type Orientation } from '../Run';
import { useDensity, withDensity, type DensityProps } from '../Density';
import { holdScope, useDisabled, type HoldProps } from '../Disabled';

/** Which way a bar runs. */
export type BarOrientation = Orientation;

/** What a bar does with cells its line has no room for. */
export type BarOverflowMode = PrefBarOverflow;

/** Props for {@link Bar}. `disabled` and `readOnly` hold every cell. */
export interface BarProps extends DensityProps, HoldProps {
  /** What the bar holds, in order: any controls, and `Bar.Group`s, `Bar.Spacer`s, `Bar.Divider`s, `Bar.Item`s, and
   *  `Bar.Readout`s. Each child is one cell on the line. */
  children?: ReactNode;
  /** Which way the bar runs. Default: the way the run it sits in goes, else `'horizontal'`. */
  orientation?: BarOrientation;
  /** Names the bar, and makes it a `toolbar`. Leave unset inside one. */
  label?: string;
  /** What the line starts with: `'label'` shows `label` ahead of the cells, and `'icon'` shows `icon`. Unset: the
   *  first cell. Inside a movable `ToolbarDock` the lead is the bar's handle. */
  lead?: PrefBarLead;
  /** The glyph naming the bar, which `lead: 'icon'` starts its line with. */
  icon?: IconSpec;
  /** The bar's group is turned off, as an `enableIf` turns it off: its lead dims as a heading's name does, and the
   *  cells say so for themselves, so a switch among them that turns it back on stays live. `disabled` holds every
   *  cell. */
  off?: boolean;
  /**
   * Draw the strip the bar sits on, for a bar with no strip of the host's under it. `true` is a bordered strip set
   * among other things; `'segmented'` a compact one with the cells almost touching; `'band'` a strip the width of
   * its host, ruled off below, as a toolbar along a window's top; and `'status'` the readout strip along an editor's
   * foot, in a numeric face and ruled off above. A status strip is a `<footer>`, not a toolbar: its readouts change on
   * every pointer move, so it is no live region either.
   */
  framed?: boolean | 'segmented' | 'band' | 'status';
  /** A divider between every two neighboring cells, none beside a spacer. */
  divided?: boolean;
  /** Arrow keys move focus between the buttons on the bar, leaving one in the tab order. Off by default: a bar of
   *  number boxes and selects has to leave the arrow keys to them. */
  roving?: boolean;
  /** Lets the cells run onto a second line rather than overflow. */
  wrap?: boolean;
  /** Every `FitLabel` on the line shortens together, a step at a time, before the strip scrolls. */
  fit?: boolean;
  /**
   * What happens to cells the line has no room for. `'scroll'` keeps every cell on the line, which a framed bar
   * scrolls. `'menu'` keeps the cells that fit, in order from the first, and opens the rest from a button at the end
   * of the line, one under another in the forms they have on it. A bar set to `'menu'` asks for its natural length,
   * its lead and every cell, and sits at that length in a row sized to its content; it folds cells into the menu only
   * once squeezed shorter, and takes them back as room returns. It does not stretch to fill its host. Default
   * `'scroll'`.
   */
  overflow?: BarOverflowMode;
  /** What the button that opens the rest is called. Default `'More'`. */
  overflowLabel?: string;
  /** The order the cells are drawn in, by container (`''` is the top level), which a reorder starts from. */
  order?: PrefOrder;
  /** Given, each keyed child and each `Bar.Item` with an `in` is marked with `data-bar-unit` and `data-bar-in`, and a
   *  Cmd-drag (Ctrl-drag off Apple platforms) moves one among its container's, calling this with the order it
   *  settles on. */
  onReorder?: (order: PrefOrder) => void;
  /** Every child key of a container, cells the bar does not draw included, so a reorder keeps their places. Unset,
   *  or undefined for a path, the drawn units are the whole list. */
  keysOf?: (container: string) => readonly string[] | undefined;
  /** Attributes for the bar's own element. */
  rootAttrs?: Record<string, string | undefined>;
  className?: string;
}

/**
 * A run of controls on one line, across or down. Each child is a cell; a `Bar.Group` holds related ones tight and
 * divided from their neighbors, and a `Bar.Spacer` pushes what follows to the far end. Named by `label`, it is a
 * `toolbar`; its focus keeps plain tab order unless it `roving`. It draws no strip of its own unless `framed`.
 *
 * Inside a curved `Along` each cell is centered on its spot and tipped to it, and `'menu'` puts the More button at
 * the run's far end; `'scroll'` keeps an offset along the run, moved by wheel, drag, or focus, and clips the run at
 * the shape's ends. Inside a movable `ToolbarDock` its lead is the handle that moves it.
 *
 * `size="sm"` is the compact strip, for chrome around a working surface rather than a page's own strip: the buttons
 * inside draw at `sm`, and the control height drops with them, so a slider or a number box keeps step.
 */
export function Bar(own: BarProps) {
  const run = useRun();
  // Off or disabled, the bar's lead dims as a heading's name does; disabled, every cell is disabled too.
  const props = { ...own, off: useDisabled(own).disabled || own.off === true };
  const sm = useDensity(props.size) === 'sm';
  const read = lineItems(props.children, props.onReorder !== undefined);
  const items = props.divided ? dividedItems(read) : read;
  const bar = run.shape !== undefined && run.shape.kind !== 'line'
    ? <BarAlong {...props} items={items} sm={sm} shape={run.shape} align={run.align ?? 'center'} />
    : <BarLine {...props} items={items} sm={sm} orientation={props.orientation ?? run.orientation} />;
  return holdScope(own, (
    <BarMarkContext.Provider value={props.onReorder !== undefined}>
      <FormScope form="bar">{withDensity(own.size, bar)}</FormScope>
    </BarMarkContext.Provider>
  ));
}

/** Related controls, kept tight and divided from their neighbors. */
Bar.Group = BarGroup;
/** Flexible space that pushes what follows to the far end. */
Bar.Spacer = BarSpacer;
/** A rule between what is either side of it. */
Bar.Divider = BarDivider;
/** A cell under a key of its own. */
Bar.Item = BarItem;
/** A status strip's words. */
Bar.Readout = BarReadout;

