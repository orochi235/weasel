import { present, presentRange, presentVector, type Display, type Presentation, type Quantity } from '@weasel-js/quantity';
import s from './QuantityText.module.css';

/** Props for {@link QuantityText}: one of `value`, `range`, and `vector`. */
export type QuantityTextProps = {
  /** The display for a value that carries none of its own. */
  display?: Display;
  /** BCP 47 locale. Default `en-US`. */
  locale?: string;
  /** Draw no copy for a screen reader: set where the control around this speaks the value itself. */
  mute?: boolean;
  className?: string;
} & (
    | { value: Quantity; range?: undefined; vector?: undefined }
    | {
        /** Both ends. A unit or percent sign they share is written once, after the second. */
        range: readonly [from: Quantity, to: Quantity];
        value?: undefined;
        vector?: undefined;
        /** What goes between the ends. Default an en dash. */
        separator?: string;
        /** The separator read aloud. Default ` to `. */
        spokenSeparator?: string;
      }
    | {
        vector: readonly Quantity[];
        value?: undefined;
        range?: undefined;
        /** A name before each member, by position: `['x', 'y']`. */
        labels?: readonly string[];
        /** What goes between members. Default `, `. */
        separator?: string;
      }
  );

function presented(props: QuantityTextProps): Presentation {
  const { display, locale } = props;
  if (props.range !== undefined) {
    return presentRange(props.range[0], props.range[1], display, { locale, separator: props.separator, spokenSeparator: props.spokenSeparator });
  }
  if (props.vector !== undefined) return presentVector(props.vector, display, { locale, separator: props.separator, labels: props.labels });
  return present(props.value, display, { locale });
}

/**
 * A quantity, a range of two, or a vector of several, drawn as the HTML form
 * `@weasel-js/quantity` writes: a `<data value>` for each value, a
 * `data-part` span for each named run in it, and a `data-composite` span
 * around a range or a vector. A stylesheet reaches a unit, a label, or a
 * separator by those attributes. Where the spoken form differs from the text,
 * a screen reader gets the spoken form.
 */
export function QuantityText(props: QuantityTextProps) {
  const { text, spoken, html } = presented(props);
  const reads = !props.mute && spoken !== text;
  return (
    <span className={[s.quantity, props.className].filter(Boolean).join(' ')}>
      {/* The package escapes every run it writes, a consumer's labels and separators included. */}
      <span aria-hidden={reads || undefined} dangerouslySetInnerHTML={{ __html: html }} />
      {reads && <span className={s.spoken}>{spoken}</span>}
    </span>
  );
}
