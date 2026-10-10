import { packageOptions } from '../../typedoc/packageOptions.mjs';

export default packageOptions(import.meta.dirname, {
  // Built from a shim; see `tsup.config.ts`.
  sourceOf: (key) => (key === './preview-api' ? 'src/csf/shims/preview-api.ts' : undefined),
});
