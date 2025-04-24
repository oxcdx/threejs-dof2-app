export const VERTEX_SHADER2 = `
  varying vec2 vUv; // Pass UV coordinates to the fragment shader

  void main() {
    vUv = uv; // Pass UV coordinates to the fragment shader
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const FRAGMENT_SHADER2 = `
  varying vec2 vUv; // Receive UV coordinates from the vertex shader
  uniform sampler2D u_texture; // Texture for color
  uniform float u_resolution; // Total resolution (defaults to 2048)
  uniform float u_cellSize; // Size of each cell in pixels (defaults to 10)
  uniform float u_pointSize; // Size of each point in pixels (defaults to 2)

  void main() {
    // Calculate grid coordinates
    vec2 pixelCoord = vUv * 2048.0; // Higher resolution for more detailed points
    
    // Each cell is u_cellSize x u_cellSize pixels (default 10x10)
    // with u_pointSize x u_pointSize texture (default 2x2) + spacing
    float cellSize = u_cellSize;
    float pointSize = u_pointSize;
    
    // Calculate position within each cell
    vec2 cellPosition = mod(pixelCoord, cellSize);
    
    // Only show texture in the first pointSize x pointSize pixels of each cell
    if (cellPosition.x < pointSize && cellPosition.y < pointSize) {
      // Sample texture for the small pixel "points"
      vec4 texColor = texture2D(u_texture, vUv);
      gl_FragColor = texColor;
    } else {
      discard;
    }
  }
`;