let shared: Promise<GPUDevice | null> | null = null;

/**
 * The page's one `GPUDevice` for renderers, requested on the first call and
 * shared by every later one; `null` where WebGPU is unavailable. A device
 * that is lost is forgotten, so the next call requests another.
 */
export function requestRendererDevice(): Promise<GPUDevice | null> {
  shared ??= open().catch(() => null);
  return shared;
}

async function open(): Promise<GPUDevice | null> {
  const gpu = typeof navigator !== 'undefined' ? navigator.gpu : undefined;
  if (!gpu) return null;
  const adapter = await gpu.requestAdapter();
  if (!adapter) return null;
  // WebGPU's default is 8192 whatever the GPU takes, where a WebGL context offers the GPU's own.
  const device = await adapter.requestDevice({ requiredLimits: { maxTextureDimension2D: adapter.limits.maxTextureDimension2D } });
  void device.lost.then(() => {
    shared = null;
  });
  return device;
}
