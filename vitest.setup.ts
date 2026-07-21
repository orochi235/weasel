import '@testing-library/jest-dom';

/**
 * jsdom does not ship PointerEvent. When @testing-library/dom tries to use
 * window.PointerEvent to create pointer events it falls back to window.Event,
 * which doesn't expose modifier-key properties (shiftKey, altKey, etc.).
 *
 * This polyfill extends MouseEvent so that:
 *   - clientX / clientY propagate correctly (via MouseEventInit)
 *   - modifier keys (shiftKey, altKey, metaKey, ctrlKey) work
 *   - basic PointerEvent fields (pointerId, isPrimary, pointerType) work
 */
// jsdom does not implement HTMLCanvasElement.prototype.getContext — it throws
// "Not implemented" unless the (native, heavy) `canvas` package is installed.
// Every component that mounts a <Canvas>/<SceneCanvas> tripped this, flooding
// CI logs with identical stack dumps. Provide a non-throwing default:
//   - '2d'    → a no-op context stub (enough surface for text/pattern paths)
//   - 'webgl2'/'webgl' → null, which Canvas.tsx's renderer guard already
//     treats as "no GL here, bail silently" (the jsdom code path).
// Tests that need to assert on getContext (e.g. Canvas.test.tsx) still spy on
// or re-stub it locally; this is only the quiet baseline.
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

if (typeof window !== 'undefined' && !window.PointerEvent) {
  class PointerEvent extends MouseEvent {
    // PointerEvent-specific fields
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
// when reaching into selection collections by id. Without it any test
// that opens a Select / Menu / ComboBox listbox throws TypeError on
// `escape`. Use the spec's algorithm via a minimal polyfill.
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
