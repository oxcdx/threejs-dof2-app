export const DOFShader = {
  uniforms: {
    tDiffuse: { value: null },
    focus: { value: 1.0 },
    maxblur: { value: 1.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float focus;
    uniform float maxblur;
    varying vec2 vUv;

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      gl_FragColor = color;
    }
  `,
};