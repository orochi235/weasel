// Temporary CI probe: which Chromium launch makes a WebGPU canvas present on a GPU-less Linux runner.
import { chromium } from '@playwright/test';

const BASE = ['--disable-accelerated-2d-canvas', '--enable-unsafe-webgpu', '--enable-features=Vulkan'];
const SS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const COMBOS = [
  ['current', {}, BASE],
  ['gpu', {}, [...BASE, '--enable-gpu']],
  ['gpu+adapter-ss', {}, [...BASE, '--enable-gpu', '--use-webgpu-adapter=swiftshader']],
  ['gpu+angle-ss', {}, [...BASE, '--enable-gpu', ...SS]],
  ['gpu+angle-ss+adapter-ss', {}, [...BASE, '--enable-gpu', ...SS, '--use-webgpu-adapter=swiftshader']],
  ['gpu+angle-ss+vulkan-ss', {}, [...BASE, '--enable-gpu', ...SS, '--use-vulkan=swiftshader', '--use-webgpu-adapter=swiftshader']],
  ['gpu+angle-vulkan', {}, [...BASE, '--enable-gpu', '--use-angle=vulkan', '--use-vulkan=swiftshader', '--disable-vulkan-surface']],
  ['chromium', { channel: 'chromium' }, BASE],
  ['chromium+ss', { channel: 'chromium' }, [...BASE, ...SS, '--use-webgpu-adapter=swiftshader']],
  ['chromium+gpu+ss', { channel: 'chromium' }, [...BASE, '--enable-gpu', ...SS, '--use-webgpu-adapter=swiftshader']],
];

async function probe(page) {
  return page.evaluate(async () => {
    const out = {};
    const rafs = (n) => new Promise((r) => { const f = () => (--n <= 0 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
    const pixel2d = (src, w, h) => {
      const o = document.createElement('canvas'); o.width = w; o.height = h;
      const x = o.getContext('2d', { willReadFrequently: true });
      x.drawImage(src, 0, 0);
      return Array.from(x.getImageData(w >> 1, h >> 1, 1, 1).data);
    };
    const glc = document.createElement('canvas');
    const gl = glc.getContext('webgl2');
    const dbg = gl?.getExtension('WEBGL_debug_renderer_info');
    out.webgl = gl ? String(gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : gl.RENDERER)) : null;
    const adapter = await navigator.gpu?.requestAdapter();
    if (!adapter) return { ...out, adapter: null };
    out.adapter = `${adapter.info?.vendor}/${adapter.info?.architecture}/${adapter.info?.description}`;
    const device = await adapter.requestDevice();
    out.lost = null;
    device.lost.then((i) => { out.lost = `${i.reason}: ${i.message}`; });
    const errors = [];
    device.onuncapturederror = (e) => errors.push(e.error.message);
    const clear = (ctx, color) => {
      const enc = device.createCommandEncoder();
      const pass = enc.beginRenderPass({ colorAttachments: [{ view: ctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: color }] });
      pass.end();
      device.queue.submit([enc.finish()]);
    };
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    document.body.append(c);
    const ctx = c.getContext('webgpu');
    ctx.configure({ device, format: 'rgba8unorm', alphaMode: 'premultiplied', usage: 0x10 | 0x01 | 0x02 });
    for (let i = 0; i < 10; i++) { clear(ctx, { r: i / 9, g: 0, b: 1 - i / 9, a: 1 }); await rafs(1); }
    await rafs(2);
    out.presentedDrawImage = pixel2d(c, 64, 64);
    const url = c.toDataURL('image/png');
    const img = new Image(); img.src = url; await img.decode();
    out.presentedDataUrl = pixel2d(img, 64, 64);
    clear(ctx, { r: 0, g: 1, b: 0, a: 1 });
    out.sameTaskDrawImage = pixel2d(c, 64, 64);
    await rafs(2);
    out.afterGreenPresent = pixel2d(c, 64, 64);
    const d = document.createElement('canvas'); d.width = 32; d.height = 32;
    const dctx = d.getContext('webgpu');
    dctx.configure({ device, format: 'rgba8unorm', alphaMode: 'premultiplied', usage: 0x10 | 0x01 | 0x02 });
    clear(dctx, { r: 1, g: 1, b: 0, a: 1 });
    out.detachedSameTask = pixel2d(d, 32, 32);
    await rafs(2);
    clear(dctx, { r: 0, g: 1, b: 1, a: 1 });
    out.detachedSecondFrame = pixel2d(d, 32, 32);
    await rafs(2);
    out.webglAfter = !!document.createElement('canvas').getContext('webgl2');
    await new Promise((r) => setTimeout(r, 300));
    out.errors = errors.slice(0, 3);
    return out;
  });
}

for (const [name, opts, args] of COMBOS) {
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...opts, args });
    const page = await browser.newPage();
    const consoleErrors = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160)); });
    await page.setContent('<!doctype html><body style="margin:0"></body>');
    const r = await Promise.race([probe(page), new Promise((_, j) => setTimeout(() => j(new Error('timeout')), 30_000))]);
    console.log(`PROBE ${name}: ${JSON.stringify({ ...r, console: consoleErrors.slice(0, 3) })}`);
  } catch (e) {
    console.log(`PROBE ${name}: FAILED ${String(e).slice(0, 300)}`);
  } finally {
    await browser?.close().catch(() => {});
  }
}
