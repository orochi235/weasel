import { packageOptions } from '../../typedoc/packageOptions.mjs';

export default packageOptions(import.meta.dirname, {
  // `PrefPath`'s string-joining step, not a type a consumer names.
  intentionallyNotExported: ['Join'],
});
