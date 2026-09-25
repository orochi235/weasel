// LayerList lives in `@weasel-js/ui`. Named, not `export *` — a star re-export
// of an external package emits no binding in the bundle.
export type { LayerListItem, LayerListProps, LayerMove } from '@weasel-js/ui';
export { LayerList, moveLayers } from '@weasel-js/ui';
export type { LayerCapability, LayerDescriptor } from '../instrument/types';
