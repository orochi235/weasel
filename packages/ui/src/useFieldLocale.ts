import { useLocale } from 'react-aria-components';
import { fieldLocale } from '@weasel-js/quantity';

/**
 * The locale a number field shows and reads in: `locale` when given, else React Aria's — the nearest
 * `<I18nProvider locale>`, else the browser's language, else `en-US` (on the server, and wherever `navigator` has
 * none) — narrowed by `fieldLocale` to one whose numbers read back as shown. Every number field reads this, so one
 * `<I18nProvider>` sets them all, React Aria's own `NumberField` with them.
 */
export function useFieldLocale(locale?: string): string {
  const fromContext = useLocale().locale;
  return fieldLocale(locale ?? fromContext);
}
