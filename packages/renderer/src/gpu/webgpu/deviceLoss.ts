/**
 * Whether a `GPUDevice` has been lost, heard through one reaction per device. A reaction on
 * `device.lost` holds what it closes over until the device goes, and the page's one device
 * outlives every renderer built on it, so a renderer must not register its own.
 */

const WATCHED = new WeakSet<GPUDevice>();
const LOST = new WeakSet<GPUDevice>();

/** Start hearing `device` go, once per device, and log the loss unless it was destroyed on purpose. */
export function watchDeviceLoss(device: GPUDevice): void {
  if (WATCHED.has(device)) return;
  WATCHED.add(device);
  void device.lost.then((info) => {
    LOST.add(device);
    if (info.reason !== 'destroyed') console.error(`weasel: the WebGPU device was lost: ${info.message}`);
  });
}

/** Whether `device`, watched with {@link watchDeviceLoss}, has been lost. */
export function deviceIsLost(device: GPUDevice): boolean {
  return LOST.has(device);
}
