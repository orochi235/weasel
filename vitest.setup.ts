import '@testing-library/jest-dom';

import { weaselDefines } from './scripts/vite-build-info';

// Build-identity globals (`__WEASEL_CORE_VERSION__`, `__WEASEL_BUILD_DATE__`).
// Real builds get these from vite `define`, but vitest transforms modules
// through its own SSR pipeline, where define substitution doesn't run — so
// under test the identifiers stay live and resolve against globalThis.
for (const [name, json] of Object.entries(weaselDefines(process.cwd()))) {
  (globalThis as Record<string, unknown>)[name] = JSON.parse(json);
}

// jsdom does not implement HTMLCanvasElement.prototype.getContext — it throws
// "Not implemented" unless the native `canvas` package is installed. Provide a
// non-throwing default: a no-op stub for '2d', and null for GL, which the
// renderer treats as "no GL here". A test that asserts on getContext re-stubs
// it locally.
if (typeof HTMLCanvasElement !== 'undefined') {
  const make2dStub = (canvas: HTMLCanvasElement) => ({
    canvas,
    clearRect() {}, fillRect() {}, strokeRect() {},
    save() {}, restore() {},
    translate() {}, rotate() {}, scale() {}, transform() {}, setTransform() {}, resetTransform() {},
    setLineDash() {}, getLineDash: () => [] as number[],
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {},
    bezierCurveTo() {}, quadraticCurveTo() {}, arc() {}, arcTo() {}, rect() {}, ellipse() {},
    clip() {}, stroke() {}, fill() {},
    fillText() {}, strokeText() {},
    measureText: (text = '') => ({ width: String(text).length * 6 }),
    drawImage() {}, putImageData() {},
    getImageData: (_x = 0, _y = 0, w = 1, h = 1) => ({
      data: new Uint8ClampedArray(Math.max(1, w * h) * 4), width: w, height: h,
    }),
    createImageData: (w = 1, h = 1) => ({
      data: new Uint8ClampedArray(Math.max(1, w * h) * 4), width: w, height: h,
    }),
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    createPattern: () => null,
  });
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (this: HTMLCanvasElement, type: string) => unknown;
  };
  proto.getContext = function getContext(this: HTMLCanvasElement, type: string) {
    return type === '2d' ? make2dStub(this) : null;
  };
}

// jsdom has no layout, so it leaves `scrollIntoView` out entirely.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}

// Same gap as getContext above: jsdom only defines `ImageData` when the native
// `canvas` package is installed.
if (typeof globalThis.ImageData === 'undefined') {
  class ImageDataStub {
    readonly data: Uint8ClampedArray;
    readonly width: number;
    readonly height: number;
    readonly colorSpace = 'srgb' as const;
    constructor(data: Uint8ClampedArray | number, width: number, height?: number) {
      if (typeof data === 'number') {
        this.width = data;
        this.height = width;
        this.data = new Uint8ClampedArray(this.width * this.height * 4);
      } else {
        this.data = data;
        this.width = width;
        this.height = height ?? data.length / 4 / width;
      }
    }
  }
  (globalThis as { ImageData: unknown }).ImageData = ImageDataStub;
}

// Every browser has these; jsdom has none, and a VM context does not get Node's.
if (typeof globalThis.CompressionStream === 'undefined') {
  const web = await import('node:stream/web');
  Object.assign(globalThis, {
    CompressionStream: web.CompressionStream,
    DecompressionStream: web.DecompressionStream,
  });
}

// jsdom does not ship PointerEvent, and @testing-library/dom then falls back to
// window.Event, which carries no modifier keys or client coordinates.
if (typeof window !== 'undefined' && !window.PointerEvent) {
  class PointerEvent extends MouseEvent {
    pointerId: number;
    width: number;
    height: number;
    pressure: number;
    tangentialPressure: number;
    tiltX: number;
    tiltY: number;
    twist: number;
    pointerType: string;
    isPrimary: boolean;

    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 0;
      this.width = params.width ?? 1;
      this.height = params.height ?? 1;
      this.pressure = params.pressure ?? 0;
      this.tangentialPressure = params.tangentialPressure ?? 0;
      this.tiltX = params.tiltX ?? 0;
      this.tiltY = params.tiltY ?? 0;
      this.twist = params.twist ?? 0;
      this.pointerType = params.pointerType ?? '';
      this.isPrimary = params.isPrimary ?? false;
    }
  }

  (window as any).PointerEvent = PointerEvent;
}

// jsdom doesn't implement CSS.escape, which react-aria-components uses
// when reaching into selection collections by id.
if (typeof window !== 'undefined' && (typeof (window as any).CSS === 'undefined' || !((window as any).CSS as { escape?: unknown }).escape)) {
  const CSSObj = ((window as any).CSS ?? {}) as { escape?: (s: string) => string };
  CSSObj.escape = (value: string): string => {
    const str = String(value);
    const length = str.length;
    let index = -1;
    let codeUnit: number;
    let result = '';
    const firstCodeUnit = str.charCodeAt(0);
    while (++index < length) {
      codeUnit = str.charCodeAt(index);
      if (codeUnit === 0) { result += '�'; continue; }
      if (
        (codeUnit >= 1 && codeUnit <= 0x1f) || codeUnit === 0x7f ||
        (index === 0 && codeUnit >= 0x30 && codeUnit <= 0x39) ||
        (index === 1 && codeUnit >= 0x30 && codeUnit <= 0x39 && firstCodeUnit === 0x2d)
      ) {
        result += '\\' + codeUnit.toString(16) + ' ';
        continue;
      }
      if (index === 0 && length === 1 && codeUnit === 0x2d) { result += '\\' + str.charAt(index); continue; }
      if (
        codeUnit >= 0x80 || codeUnit === 0x2d || codeUnit === 0x5f ||
        (codeUnit >= 0x30 && codeUnit <= 0x39) ||
        (codeUnit >= 0x41 && codeUnit <= 0x5a) ||
        (codeUnit >= 0x61 && codeUnit <= 0x7a)
      ) { result += str.charAt(index); continue; }
      result += '\\' + str.charAt(index);
    }
    return result;
  };
  (window as any).CSS = CSSObj;
}
