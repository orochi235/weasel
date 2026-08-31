// LayerStack lives in `@weasel-js/ui` now; labkit re-exports it so existing
// `@weasel-js/labkit/ui/layers` imports keep resolving. Named, not `export *`
// — a star re-export of an external package emits no binding in the bundle.
export type { LayerStackItem, LayerStackProps } from '@weasel-js/ui';
export { LayerStack } from '@weasel-js/ui';
