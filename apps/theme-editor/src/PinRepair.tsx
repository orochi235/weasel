import type { ThemeDefinition } from '@weasel-js/theme';
import { Button } from '@weasel-js/ui/components/Button';
import { Input } from '@weasel-js/ui/components/Input';
import styles from './ThemeEditor.module.css';
import { removePin, setPin } from './theme/model';

export interface PinRepairProps {
  readonly draft: ThemeDefinition;
  /** Why the draft does not derive, in the engine's words. */
  readonly error: string;
  readonly onChange: (next: ThemeDefinition, key: string, label?: string) => void;
}

/** A pin's value where it is one string or number, bare or under `value`; null for a pin that varies by axis. */
function plain(pin: unknown): { text: string; write: (text: string) => unknown } | null {
  if (typeof pin === 'string' || typeof pin === 'number') return { text: String(pin), write: (text) => text };
  const value = (pin as { value?: unknown } | null)?.value;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  return { text: String(value), write: (text) => ({ ...(pin as object), value: text }) };
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
      return { token, value, suspect: value !== null && named(value.text, error, pins) };
    })
    .sort((a, b) => Number(b.suspect) - Number(a.suspect));
  if (rows.length === 0) return null;
  return (
    <section aria-label="Pins" className={styles.repair}>
      <p>Fix or remove the pin at fault to keep the rest of this draft.</p>
      <ul className={styles.repairRows}>
        {rows.map(({ token, value, suspect }) => (
          <li key={token} className={styles.repairRow} data-suspect={suspect ? '' : undefined}>
            <span className={styles.repairToken}>{token}</span>
            {value === null ? (
              <span className={styles.repairNote}>varies by axis</span>
            ) : (
              <Input
                aria-label={token}
                value={value.text}
                onChange={(next) => onChange(setPin(draft, token, value.write(next) as never), `pin:${token}`, `Edit ${token}`)}
              />
            )}
            {suspect && <span className={styles.repairNote}>named in the error</span>}
            <Button size="sm" ariaLabel={`Remove pin ${token}`} onClick={() => onChange(removePin(draft, token), `pin:${token}`, `Reset ${token}`)}>
              Remove
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
