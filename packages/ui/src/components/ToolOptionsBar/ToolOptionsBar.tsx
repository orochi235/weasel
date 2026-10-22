import { Children, useRef, type ReactNode } from 'react';
import type { PrefGroup, PrefSection } from '@weasel-js/prefs';
import type { PropertyRenderer } from '../SelectionPanel/renderContext';
import { FitScope, useFitScope } from '../FitLabel/FitLabel';
import { Bar } from '../Bar/Bar';
import s from './ToolOptionsBar.module.css';

/** Props for {@link ToolOptionsBar}. */
export interface ToolOptionsBarProps {
  /**
   * Context label for the row — e.g. the active tool's name. Rendered
   * before the children and doubles as the toolbar's `aria-label`. A label
   * alone does not keep the row: it renders only with a `schema` or children.
   *
   * Using `label` for both the visible text and `aria-label` means a
   * screen reader announces it twice when landing on the toolbar.
   * `aria-labelledby` would avoid the echo at the cost of id plumbing and
   * an awkward no-`id`-to-point-at case when `label` is omitted.
   */
  label?: string;
  /**
   * The active tool's options, as the `PrefGroup` the tool declares: a
   * group's key is a segment of its leaves' paths. A `Bar` draws them, each
   * leaf in its bar form.
   */
  schema?: PrefGroup;
  /** Each leaf's value, keyed by dotted path. A path with no entry is unset. */
  values?: Readonly<Record<string, unknown>>;
  /** A leaf edit, as the dotted path it was declared at and its new value. */
  onChange?: (path: string, value: unknown) => void;
  /** Paths whose sources disagree — drawn as the control's mixed state. */
  mixed?: ReadonlySet<string>;
  /** Control overrides, by dotted path or by leaf kind, as the panel takes. */
  renderers?: Record<string, PropertyRenderer>;
  /** The schema `schema`'s `alias` leaves point into, handed to the `Bar`. Default: `schema` itself. */
  over?: PrefGroup | PrefSection;
  children?: ReactNode;
  className?: string;
}

/**
 * Horizontal strip reserved above the workspace for contextual tool options.
 * Given a `schema` it draws the active tool's options itself; the children
 * slot stays open for a tenant that is not a tool's options at all, such as
 * loupe controls.
 *
 * With neither a `schema` nor children it renders nothing, so a host's row
 * collapses while no tool has options to show.
 *
 * `role="toolbar"` without roving tabindex: the ARIA authoring practices
 * expect arrow-key roving focus across a toolbar's items, but a bar of
 * compound controls (`NumberField`, `Select`, `ColorField`) must leave the
 * arrow keys to them — they edit their own value with them. So the bar keeps
 * plain DOM tab order.
 */
export function ToolOptionsBar(props: ToolOptionsBarProps) {
  const { label, schema, values, onChange, mixed, renderers, over, children, className } = props;
  const cls = [s.root, className].filter(Boolean).join(' ');
  // Every label on the line shortens together before the strip scrolls.
  const controls = useRef<HTMLDivElement>(null);
  const fit = useFitScope(controls);
  if (schema === undefined && Children.toArray(children).length === 0) return null;
  return (
    <div className={cls} role="toolbar" aria-label={label}>
      {label !== undefined && <span className={s.label}>{label}</span>}
      <div className={s.controls} ref={controls}>
        <FitScope value={fit}>
          {schema !== undefined && (
            <Bar schema={schema} values={values} mixed={mixed} renderers={renderers} over={over} onChange={onChange} />
          )}
          {children}
        </FitScope>
      </div>
    </div>
  );
}
