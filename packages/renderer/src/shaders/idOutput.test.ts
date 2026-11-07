import { describe, expect, it } from 'vitest';
import { idChannels, idOfTexel, withIdOutput, checkPickId, MAX_PICK_ID } from './idOutput';
import { FRAG_SRC, VERT_SRC } from './pathFill';
import { CUSTOM_VERT_SRC } from './customPrelude';

const FRAG = `#version 300 es
precision highp float;
out vec4 fragColor;
void main() {
  if (gl_FragCoord.x < 1.0) discard;
  fragColor = vec4(1.0);
}
`;

describe('withIdOutput', () => {
  it('pins the color output to location 0 and adds the id at location 1', () => {
    const out = withIdOutput(CUSTOM_VERT_SRC, FRAG)!;
    expect(out.frag).toContain('layout(location = 0) out vec4 fragColor;');
    expect(out.frag).toContain('layout(location = 1) out highp vec4 weasel_idOut;');
    expect(out.frag).toContain('fragColor.a >= u_weaselId.a');
    expect(out.frag).toContain('uniform highp vec4 u_weaselId;');
    expect(out.frag.startsWith('#version 300 es')).toBe(true);
  });

  it('runs the shader\'s own main before writing the id, and leaves the vertex stage alone', () => {
    const out = withIdOutput(CUSTOM_VERT_SRC, FRAG)!;
    expect(out.frag.match(/void main\(\)/g)).toHaveLength(1);
    expect(out.frag).toMatch(/void weasel_main\(\)[\s\S]*void main\(\) \{\n {2}weasel_main\(\);/);
    expect(out.vert).toBe(CUSTOM_VERT_SRC);
  });

  it('keeps every line where it was, so a compile error names the line written', () => {
    const out = withIdOutput(VERT_SRC, FRAG_SRC)!;
    expect(out.frag.split('\n').slice(0, FRAG_SRC.split('\n').length - 1))
      .toEqual(FRAG_SRC.split('\n').slice(0, -1).map((l) => l
        .replace(/^out vec4/, 'layout(location = 0) out vec4')
        .replace('void main()', 'void weasel_main()')));
  });

  it('leaves a shader alone that declares outputs of its own beyond one color', () => {
    const two = FRAG.replace('out vec4 fragColor;', 'layout(location = 0) out vec4 a;\nlayout(location = 1) out vec4 b;');
    expect(withIdOutput(CUSTOM_VERT_SRC, two)).toBeNull();
    expect(withIdOutput(CUSTOM_VERT_SRC, FRAG.replace('out vec4 fragColor;', 'layout(location = 2) out vec4 c;'))).toBeNull();
  });
});

describe('id encoding', () => {
  it('round-trips an id through the channels a texel stores', () => {
    for (const id of [1, 255, 256, 0x123456, MAX_PICK_ID]) {
      const bytes = new Uint8Array([...idChannels(id).map((c) => Math.round(c * 255)), 255]);
      expect(idOfTexel(bytes, 0)).toBe(id);
    }
  });

  it('reads an unclaimed texel as 0', () => {
    expect(idOfTexel(new Uint8Array([9, 9, 9, 0]), 0)).toBe(0);
  });

  it('refuses an id the texel cannot hold', () => {
    expect(() => checkPickId(MAX_PICK_ID + 1)).toThrow(RangeError);
    expect(() => checkPickId(1.5)).toThrow(RangeError);
    expect(() => checkPickId(-1)).toThrow(RangeError);
  });
});
