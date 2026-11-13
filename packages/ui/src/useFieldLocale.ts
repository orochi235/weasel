import { useLocale } from 'react-aria-components';
import { fieldLocale } from '@weasel-js/quantity';

/**
 * React Aria's `I18nProvider`, from the copy of React Aria these components read: `<I18nProvider locale="de-DE">`
 * sets the locale of every number field under it. Import it from here, not from a `react-aria-components` of your
 * own: a second copy of React Aria keeps a locale of its own, which these fields never see.
 */
export { I18nProvider } from 'react-aria-components';

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
