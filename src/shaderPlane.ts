export const VERTEX_SHADER = `
  varying vec2 vUv; // Pass UV coordinates to the fragment shader

  void main() {
    vUv = uv; // Pass UV coordinates to the fragment shader

    // Use the baked position for rendering
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const FRAGMENT_SHADER = `
  varying vec2 vUv; // Receive UV coordinates from the vertex shader
  uniform sampler2D u_texture; // Texture for color

  void main() {
    // Sample the texture using UV coordinates
    vec4 texColor = texture2D(u_texture, vUv);

    // Set the fragment color to the sampled texture color
    gl_FragColor = texColor;
  }
`;