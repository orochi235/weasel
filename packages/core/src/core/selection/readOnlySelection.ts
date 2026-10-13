import type { SelectionApi } from './useSelection';

type AdapterMethods = SelectionApi['adapterMethods'];

const methodViews = new WeakMap<AdapterMethods, AdapterMethods>();
const apiViews = new WeakMap<SelectionApi, SelectionApi>();

const ignore = (): void => {};

function readOnlyAdapterMethods(methods: AdapterMethods): AdapterMethods {
  let view = methodViews.get(methods);
  if (!view) {
    view = { getSelection: () => methods.getSelection(), setSelection: ignore };
    methodViews.set(methods, view);
  }
  return view;
}

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
    adapterMethods,
  };
  apiViews.set(api, view);
  return view;
}
