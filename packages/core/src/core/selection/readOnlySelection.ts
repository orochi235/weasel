import { createPart } from '@weasel-js/registry';
import type { SelectionApi } from '@weasel-js/routing';

type AdapterMethods = SelectionApi['adapterMethods'];

const ignore = (): void => {};

const readOnlyAdapterMethods = createPart((methods: AdapterMethods): AdapterMethods =>
  ({ getSelection: () => methods.getSelection(), setSelection: ignore }));
const apiViews = new WeakMap<SelectionApi, SelectionApi>();

/**
 * A view of `api` that reads the live selection and ignores every write.
 * `api` itself is untouched and still writes.
 *
 * One view per `api`, and one set of `adapterMethods` per `api.adapterMethods`,
 * so either is as stable a memo or effect dependency as the object it wraps.
 */
export function readOnlySelection(api: SelectionApi): SelectionApi {
  const adapterMethods = readOnlyAdapterMethods(api.adapterMethods);
  const cached = apiViews.get(api);
  if (cached && cached.adapterMethods === adapterMethods) return cached;
  const view: SelectionApi = {
    get current() { return api.current; },
    get: api.get,
    contains: api.contains,
    set: ignore,
    add: ignore,
    remove: ignore,
    toggle: ignore,
    clear: ignore,
    applyClick: ignore,
    intentOf: api.intentOf,
    adapterMethods,
  };
  apiViews.set(api, view);
  return view;
}
