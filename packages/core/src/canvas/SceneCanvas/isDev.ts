
// Read through a cast: core must compile without a bundler's ambient
// `ImportMeta` augmentation (`vite/client`).
export const IS_DEV: boolean = (() => {
  try {
    return Boolean((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV);
  } catch {
    return false;
  }
})();
