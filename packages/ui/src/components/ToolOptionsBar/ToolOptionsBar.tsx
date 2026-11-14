import { Children, type ReactNode } from 'react';
import type { PrefGroup, PrefSection } from '@weasel-js/prefs';
import type { LeafRenderer } from '../SelectionPanel/renderContext';
import { Bar } from '../Bar/Bar';
import { PrefsBar } from '../PrefsBar/PrefsBar';
import type { DensityProps } from '../Density';
import s from './ToolOptionsBar.module.css';
import type { HoldProps } from '../Disabled';

/** Props for {@link ToolOptionsBar}. */
export interface ToolOptionsBarProps extends DensityProps, HoldProps {
  /**
   * Context label for the row — e.g. the active tool's name. Shown as the
   * bar's lead, and names the toolbar, which is `'Tool options'` without
   * one. A label alone does not keep the row: it renders only with a
   * `schema` or children.
   */
  label?: string;
  /**
   * The active tool's options, as the `PrefGroup` the tool declares: a
   * group's key is a segment of its leaves' paths. A `PrefsBar` draws them, each
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
  renderers?: Record<string, LeafRenderer>;
  /** The schema `schema`'s `alias` leaves point into, handed to the `PrefsBar`. Default: `schema` itself. */
  over?: PrefGroup | PrefSection;
  children?: ReactNode;
  className?: string;
}

/**
 * The strip reserved above the workspace for contextual tool options: a `Bar` framed as a `'band'` at a fixed height,
 * led by `label`, whose labels shorten together before it scrolls. Given a `schema` it draws the active tool's
 * options as a `PrefsBar`; the children follow them, for a tenant that is not a tool's options at all, such as loupe
 * controls.
 *
 * With neither a `schema` nor children it renders nothing, so a host's row collapses while no tool has options to
 * show.
 */
export function ToolOptionsBar(props: ToolOptionsBarProps) {
  const { label, schema, values, onChange, mixed, renderers, over, children, size, className, disabled, disabledReason, readOnly, readOnlyReason } = props;
  if (schema === undefined && Children.toArray(children).length === 0) return null;
  const strip = { label: label ?? 'Tool options', lead: label === undefined ? undefined : 'label', framed: 'band', fit: true, size, disabled, disabledReason, readOnly, readOnlyReason, className: [s.root, className].filter(Boolean).join(' ') } as const;
  return schema === undefined ? (
    <Bar {...strip}>{children}</Bar>
  ) : (
    <PrefsBar {...strip} schema={schema} values={values} mixed={mixed} renderers={renderers} over={over} onChange={onChange}>
      {children}
    </PrefsBar>
  );
}
