import * as THREE from 'three';
import * as SHADERS from './shader.ts';
import { VERTEX_SHADER, FRAGMENT_SHADER } from './shaderPlane.ts';
import { VERTEX_SHADER2, FRAGMENT_SHADER2 } from './shaderFakePoints.ts';
import { Api, ASSET_TYPE } from './api.ts';
import * as geometryUtils from './geometryUtil.ts';

export async function createAIImagesPlane(): Promise<THREE.Mesh> {
  const api = new Api();

  // Fetch textures: one for color
  const textures = await api.fetchImages(0, ASSET_TYPE.AI, true);
  const texture = textures[0]; // Use the first texture for color

  // Generate geometry using the modified function
  const geometry = geometryUtils.getAIImagesBufferGeometryForPlane(
    new geometryUtils.ScenarioDataWrapper(await textureToImageData(textures)),
    {}, // imgCenterPoints (not used for the plane)
    'ai_images'
  );

  // Create shader material
  const shaderMaterial = new THREE.ShaderMaterial({
    uniforms: {
      u_texture: { value: texture }, // Pass the texture to the shader
    },
    vertexShader: VERTEX_SHADER, // Use the updated vertex shader
    fragmentShader: FRAGMENT_SHADER, // Use the updated fragment shader
    side: THREE.DoubleSide, // Ensure the plane is visible from both sides
  });

  // Return the THREE.Mesh object with the generated geometry
  return new THREE.Mesh(geometry, shaderMaterial);
}

export async function createAIImagesPlaneFakePoints(): Promise<THREE.Mesh> {
  const api = new Api();

  // Fetch textures: one for color
  const textures = await api.fetchImages(0, ASSET_TYPE.AI, true);
  const texture = textures[0]; // Use the first texture for color

  // Generate geometry using the modified function
  const geometry = geometryUtils.getAIImagesBufferGeometryForPlane(
    new geometryUtils.ScenarioDataWrapper(await textureToImageData(textures)),
    {}, // imgCenterPoints (not used for the plane)
    'ai_images'
  );

  // Create shader material
  const shaderMaterial = new THREE.ShaderMaterial({
    uniforms: {
      u_texture: { value: texture },
      u_resolution: { value: 4096.0 },
      u_cellSize: { value: 5.0 },
      u_pointSize: { value: 1.0 }
    },
    vertexShader: VERTEX_SHADER2,
    fragmentShader: FRAGMENT_SHADER2,
    side: THREE.DoubleSide
  });

  // Return the THREE.Mesh object with the generated geometry
  return new THREE.Mesh(geometry, shaderMaterial);
}

export async function createAIImagesPlaneWithTextures(textures: THREE.Texture[]): Promise<THREE.Mesh> {
  // Generate geometry using the modified function
  const geometry = geometryUtils.getAIImagesBufferGeometryForPlane(
    new geometryUtils.ScenarioDataWrapper(await textureToImageData(textures)),
    {}, // imgCenterPoints (not used for the plane)
    'ai_images'
  );

  // Create shader material
  const shaderMaterial = new THREE.ShaderMaterial({
    uniforms: {
      u_texture: { value: textures[0] }, // Use the first texture for color
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    side: THREE.DoubleSide,
  });

  // Return the THREE.Mesh object with the generated geometry
  return new THREE.Mesh(geometry, shaderMaterial);
}

export async function createAIImagesPlaneFakePointsWithTextures(textures: THREE.Texture[]): Promise<THREE.Mesh> {
  // Generate geometry using the modified function
  const geometry = geometryUtils.getAIImagesBufferGeometryForPlane(
    new geometryUtils.ScenarioDataWrapper(await textureToImageData(textures)),
    {}, // imgCenterPoints (not used for the plane)
    'ai_images'
  );

  // Create shader material
  const shaderMaterial = new THREE.ShaderMaterial({
    uniforms: {
      u_texture: { value: textures[0] }, // Use the first texture for color
      u_resolution: { value: 4096.0 },
      u_cellSize: { value: 5.0 },
      u_pointSize: { value: 1.0 },
    },
    vertexShader: VERTEX_SHADER2,
    fragmentShader: FRAGMENT_SHADER2,
    side: THREE.DoubleSide,
  });

  // Return the THREE.Mesh object with the generated geometry
  return new THREE.Mesh(geometry, shaderMaterial);
}


export async function createAIImagesPoints(): Promise<THREE.Points> {
  const api = new Api();

  // Fetch textures and convert to image data
  const textures = await api.fetchImages(0, ASSET_TYPE.AI, true);
  const imageData = await textureToImageData(textures);

  // Reduce the number of points by sampling
  const sparseImageData = imageData.map((data) => {
    const sparseData = new ImageData(data.width, data.height);
    const factor = 10; // Sampling factor (reduce points by 10x)

    for (let y = 0; y < data.height; y++) {
      for (let x = 0; x < data.width; x++) {
        const index = (y * data.width + x) * 4;

        // Only include points at intervals defined by the factor
        if (y % factor === 0 && x % factor === 0) {
          const sparseIndex = index; // Keep the same index for sparse data
          sparseData.data[sparseIndex] = data.data[index];       // Red
          sparseData.data[sparseIndex + 1] = data.data[index + 1]; // Green
          sparseData.data[sparseIndex + 2] = data.data[index + 2]; // Blue
          sparseData.data[sparseIndex + 3] = data.data[index + 3]; // Alpha
        }
      }
    }

    return sparseData;
  });

  // Generate geometry for "ai_images" using the sparse data
  const geometry = geometryUtils.getAIImagesBufferGeometry(
    new geometryUtils.ScenarioDataWrapper(sparseImageData),
    {}, // imgCenterPoints (not used in this case)
    'ai_images'
  );

  // Create shader material
  const parallaxUniforms = {
    u_time: { type: 'f', value: 1.0 },
    u_texture: { type: 't', value: null },
    u_use_texture: { type: 'b', value: false },
    u_minZ: { type: 'f', value: -10 },
    u_maxZ: { type: 'f', value: 10 },
    u_pointSize: { type: 'f', value: 5.0 }, // Adjust point size if needed
  };

  const shaderMaterial = new THREE.ShaderMaterial({
    uniforms: parallaxUniforms,
    vertexShader: SHADERS.VERTEX_SHADER,
    fragmentShader: SHADERS.FRAGMENT_SHADER,
  });

  // Return the THREE.Points object
  return new THREE.Points(geometry, shaderMaterial);
}

// Helper function to convert textures to image data
async function textureToImageData(textures: THREE.Texture[]): Promise<ImageData[]> {
  const imageData: ImageData[] = [];
  const canvas = document.createElement('canvas');

  for (const tex of textures) {
    canvas.width = tex.image.width;
    canvas.height = tex.image.height;

    const context = canvas.getContext('2d');
    context?.drawImage(tex.image, 0, 0);

    const data = context?.getImageData(0, 0, canvas.width, canvas.height);
    if (data) {
      imageData.push(data);
    }

    tex.dispose();
  }

  canvas.width = 0;
  canvas.height = 0;
  canvas.remove();

  return imageData;
}