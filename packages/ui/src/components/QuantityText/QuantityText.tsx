import { amount, present, presentRange, presentVector, type Display, type Presentation, type Quantity } from '@weasel-js/quantity';
import s from './QuantityText.module.css';

/** Props for {@link QuantityText}: one of `value`, `range`, `vector`, and `unit`. */
export type QuantityTextProps = {
  /** The display for a value that carries none of its own. */
  display?: Display;
  /** BCP 47 locale. Default `en-US`. */
  locale?: string;
  /** Draw no copy for a screen reader: set where the control around this speaks the value itself. */
  mute?: boolean;
  className?: string;
} & (
    | { value: Quantity; range?: undefined; vector?: undefined; unit?: undefined }
    | {
        /** A unit with no number: what a field holding the number shows after it. */
        unit: string;
        value?: undefined;
        range?: undefined;
        vector?: undefined;
      }
    | {
        /** Both ends. A unit or percent sign they share is written once, after the second. */
        range: readonly [from: Quantity, to: Quantity];
        value?: undefined;
        vector?: undefined;
        unit?: undefined;
        /** What goes between the ends. Default an en dash. */
        separator?: string;
        /** The separator read aloud. Default ` to `. */
        spokenSeparator?: string;
      }
    | {
        vector: readonly Quantity[];
        value?: undefined;
        range?: undefined;
        unit?: undefined;
        /** A name before each member, by position: `['x', 'y']`. */
        labels?: readonly string[];
        /** What goes between members. Default `, `. */
        separator?: string;
      }
  );

function presented(props: Exclude<QuantityTextProps, { unit: string }>): Presentation {
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
 * around a range or a vector. A unit alone is the `unit` part with no
 * `<data>` around it. A stylesheet reaches a unit, a label, or a
 * separator by those attributes. A value whose display is `stacked`, a
 * fraction's, is drawn as its MathML form inside its `<data value>`, with its
 * text form hidden beside it so a copy reads `1/2`. Where the spoken form
 * differs from the text, a screen reader gets the spoken form.
 */
export function QuantityText(props: QuantityTextProps) {
  const className = [s.quantity, props.className].filter(Boolean).join(' ');
  if (props.unit !== undefined) {
    return <span className={className}><span data-part="unit">{props.unit}</span></span>;
  }
  const { text, spoken, html, mathml, stacked } = presented(props);
  const reads = !props.mute && spoken !== text;
  return (
    <span className={className}>
      {/* The package escapes every run it writes, a consumer's labels and separators included. */}
      {stacked && mathml !== undefined && props.value !== undefined ? (
        <span aria-hidden={reads || undefined}>
          <data value={String(amount(props.value))}>
            <span className={s.math} dangerouslySetInnerHTML={{ __html: mathml }} />
            <span className={s.hidden}>{text}</span>
          </data>
        </span>
      ) : (
        <span aria-hidden={reads || undefined} dangerouslySetInnerHTML={{ __html: html }} />
      )}
      {reads && <span className={s.hidden}>{spoken}</span>}
    </span>
  );
}
