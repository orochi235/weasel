import { isByAxis, parseTokenValue, serializeTokenValue, type ThemeDefinition, type TokenValue } from '@weasel-js/theme';
import { Button } from '@weasel-js/ui/components/Button';
import { Input } from '@weasel-js/ui/components/Input';
import styles from './ThemeEditor.module.css';
import { keepNumberness, removePin, setPin } from './theme/model';

export interface PinRepairProps {
  readonly draft: ThemeDefinition;
  /** Why the draft does not derive, in the engine's words. */
  readonly error: string;
  readonly onChange: (next: ThemeDefinition, key: string, label?: string) => void;
}

const isList = (v: unknown): v is readonly (string | number)[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string' || typeof x === 'number');

/** A list's DTCG type when the pin names none: four numbers ease, names make a font stack. */
const listType = (v: readonly (string | number)[], type: unknown): string =>
  typeof type === 'string' ? type : v.length === 4 && v.every((x) => typeof x === 'number') ? 'cubicBezier' : 'fontFamily';

/** A token value as text and back: a number stays one, a list keeps its type's spelling. */
function edit(value: unknown, type: unknown): { text: string; parse: (text: string) => TokenValue } | null {
  if (typeof value === 'string' || typeof value === 'number') return { text: String(value), parse: (text) => keepNumberness(text, value) };
  if (!isList(value)) return null;
  const t = listType(value, type);
  return { text: serializeTokenValue(t, value), parse: (text) => parseTokenValue(t, text) };
}

/** A pin's value, bare or under `value`, as text; null for one that varies by axis or holds no token value. */
function plain(pin: unknown): { text: string; write: (text: string) => unknown } | null {
  const bare = edit(pin, undefined);
  if (bare) return { text: bare.text, write: bare.parse };
  const obj = pin as { value?: unknown; type?: unknown } | null;
  const inner = isByAxis(pin) ? null : edit(obj?.value, obj?.type);
  return inner && { text: inner.text, write: (text) => ({ ...(pin as object), value: inner.parse(text) }) };
}

/** Whether the error names something this pin refers to: `{nope}` in the value, `nope` in the message. A reference
 *  to another of the draft's pins is not it: the error names the pin at fault too, and others refer to that one. */
const named = (text: string, error: string, pins: ReadonlySet<string>): boolean =>
  [...text.matchAll(/\{([^{}]+)\}/g)].some(([, ref]) => !pins.has(ref!) && error.includes(ref!));

/**
 * The pins of a draft that does not derive, each editable in place, so one bad
 * reference can be fixed or dropped without discarding every other edit. The
 * pins the error names come first. No derived theme is needed to draw this,
 * which is the point: the layers proper cannot open without one.
 */
export function PinRepair({ draft, error, onChange }: PinRepairProps) {
  const pins = new Set(Object.keys(draft.pins ?? {}));
  const rows = Object.entries(draft.pins ?? {})
    .map(([token, pin]) => {
      const value = plain(pin);
      return { token, value, byAxis: isByAxis(pin), suspect: value !== null && named(value.text, error, pins) };
    })
    .sort((a, b) => Number(b.suspect) - Number(a.suspect));
  if (rows.length === 0) return null;
  return (
    <section aria-label="Pins" className={styles.repair}>
      <p>Fix or remove the pin at fault to keep the rest of this draft.</p>
      <ul className={styles.repairRows}>
        {rows.map(({ token, value, byAxis, suspect }) => (
          <li key={token} className={styles.repairRow} data-suspect={suspect ? '' : undefined}>
            <span className={styles.repairToken}>{token}</span>
            {value === null ? (
              <span className={styles.repairNote}>{byAxis ? 'varies by axis' : 'not editable here'}</span>
            ) : (
              <Input
                aria-label={token}
                value={value.text}
                onChange={(next) => onChange(setPin(draft, token, value.write(next) as never), `pin:${token}`, `Edit ${token}`)}
              />
            )}
            {suspect && <span className={styles.repairNote}>named in the error</span>}
            <Button size="sm" aria-label={`Remove pin ${token}`} onClick={() => onChange(removePin(draft, token), `pin:${token}`, `Reset ${token}`)}>
              Remove
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
