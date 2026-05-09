import { WeaselRenderer, registerProgram } from '../src/index';

const status = document.getElementById('status')!;

const VORONOI_FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec2 v_uv;
in vec2 v_screen;
in vec2 v_world;

uniform vec4 u_bounds;
uniform mat3 u_view;

uniform float u_time;

out vec4 outColor;

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

vec2 voronoi(vec2 uv, float time) {
  vec2 i = floor(uv);
  vec2 f = fract(uv);
  float d1 = 8.0;
  float d2 = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbor = vec2(float(x), float(y));
      vec2 point = hash2(i + neighbor);
      point = 0.5 + 0.5 * sin(time + 6.2831 * point);
      vec2 diff = neighbor + point - f;
      float d = length(diff);
      if (d < d1) { d2 = d1; d1 = d; }
      else if (d < d2) { d2 = d; }
    }
  }
  return vec2(d1, d2);
}

void main() {
  vec2 uv = v_uv * 6.0;
  vec2 v = voronoi(uv, u_time * 0.5);

  float border = smoothstep(0.04, 0.07, v.y - v.x);
  vec3 color = mix(vec3(0.05, 0.3, 0.4), vec3(0.0, 0.8, 1.0), border);
  color = mix(color, vec3(1.0), smoothstep(0.02, 0.0, v.x));

  // Premultiplied alpha (conventions §2). Opaque output: a=1, rgb*a == rgb.
  float a = 1.0;
  outColor = vec4(color * a, a);
}
`;

const canvas = document.getElementById('c') as HTMLCanvasElement;
const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, stencil: true });
if (!gl) throw new Error('WebGL2 not available');

const renderer = new WeaselRenderer({ gl, canvas, width: 512, height: 512, dpr: window.devicePixelRatio || 1 });

const handle = registerProgram('voronoi', '', VORONOI_FRAG);
renderer.registerProgram(handle);

function frame(): void {
  const t = performance.now() / 1000;
  renderer.render([{
    kind: 'shader',
    program: handle,
    uniforms: { u_time: t },
    bounds: { x: 106, y: 106, w: 300, h: 300 },
  }]);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

status.textContent = 'Shader smoke ready. Voronoi pattern animates inside the 300×300 rect.';
