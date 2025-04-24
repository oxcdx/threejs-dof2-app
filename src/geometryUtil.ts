import * as THREE from 'three'

let grayscaleNormalizationSize = 10000
let colorSpaceNormalizationSize = 16777215 / 5
let aiImagesNormalizationSize = 30000

let POS_NUM = 3
let COL_NUM = 3
let UV_NUM = 2

export type GeneratedMeshWrapper = {
    geometry: THREE.BufferGeometry,
    imgMinZ: number,
    imgMaxZ: number
}

export function getFarmBufferGeometry(scenarioDataWrapper: ScenarioDataWrapper, imgCenterPoints: {[sceneType: string] : Array<THREE.Vector3>}, targetGeometry: string) : GeneratedMeshWrapper {
    
    const geometry = new THREE.BufferGeometry()
    const height = scenarioDataWrapper.getHeightOfFrame(0)
    const width = scenarioDataWrapper.getWidthOfFrame(0)
    const numOfPoints = width*height

    const pointUv = new Float32Array(numOfPoints*2);
    const pointsToRender = new Float32Array(numOfPoints*3);
    const pointsToRenderMapped = new Float32Array(numOfPoints*3);
    const pointsToRenderFlat = new Float32Array(numOfPoints*3);
    const pointsColors = new Float32Array(numOfPoints*3);

    let pointPointer = 0
    let imgMinZ: number = 3
    let imgMaxZ: number = -3
    
    let centerDepth = scenarioDataWrapper.getCenterValueAt(1)

    // Do not forget that we are adding 3 versions of the image
    imgCenterPoints[targetGeometry] = [
        new THREE.Vector3(0,0,centerDepth / grayscaleNormalizationSize),
        new THREE.Vector3(0,0,centerDepth / grayscaleNormalizationSize),
        new THREE.Vector3(0,0,centerDepth / grayscaleNormalizationSize)
    ]

    for(let i = 0; i < height; i++) {
        for(let j = 0; j < width; j++) {
        
            const u = i/width
            const v = j/width

            // Default view - depth map
            pointsToRender[pointPointer*3 + 1] = -u + (height/width)/2
            pointsToRender[pointPointer*3] = v - 0.5
            pointsToRender[pointPointer*3 + 2] = scenarioDataWrapper.getValueAt(1, i, j, pointPointer*4) / 30


            // values passed to vertex shader for parallax
            if (pointsToRender[pointPointer*3 + 2] < imgMinZ) {
                imgMinZ = pointsToRender[pointPointer*3 + 2]
            }
            if (pointsToRender[pointPointer*3 + 2] > imgMaxZ) {
                imgMaxZ = pointsToRender[pointPointer*3 + 2]
            }

            // Custom RGB mapping
            pointsToRenderMapped[pointPointer*3 + 1] = -u + (height/width)/2
            pointsToRenderMapped[pointPointer*3] = v - 0.5
            pointsToRenderMapped[pointPointer*3 + 2] = rgbToInt([scenarioDataWrapper.getValueAt(0, i, j, pointPointer*4, true, 0), scenarioDataWrapper.getValueAt(0, i, j, pointPointer*4 + 1, true, 1), scenarioDataWrapper.getValueAt(0, i, j, pointPointer*4 + 2, true, 2)]) / colorSpaceNormalizationSize

            // Standard image
            pointsToRenderFlat[pointPointer*3 + 1] = -u + (height/width)/2
            pointsToRenderFlat[pointPointer*3] = v - 0.5
            pointsToRenderFlat[pointPointer*3 + 2] = 0

            pointsColors[pointPointer*3] = scenarioDataWrapper.getValueAt(0, i, j, pointPointer*4, true, 0) / 255
            pointsColors[pointPointer*3 + 1] = scenarioDataWrapper.getValueAt(0, i, j, pointPointer*4 + 1, true, 1) / 255
            pointsColors[pointPointer*3 + 2] = scenarioDataWrapper.getValueAt(0, i, j, pointPointer*4 + 2, true, 2) / 255

            pointPointer++
        }
    }

    // if (this.guiWrapper.textureOptions.textureUsage) {
    //     geometry.setAttribute('uv', new THREE.BufferAttribute(pointUv, this.UV_NUM))
    // } else {
    //     geometry.setAttribute('color', new THREE.BufferAttribute(pointsColors, this.COL_NUM))
    // }
    geometry.setAttribute('color', new THREE.BufferAttribute(pointsColors, COL_NUM))
    geometry.setAttribute('position', new THREE.BufferAttribute(pointsToRender, POS_NUM))

    geometry.morphAttributes.position = []
    geometry.morphAttributes.color = []

    // // Add final destination image
    geometry.morphAttributes.position[0] = new THREE.BufferAttribute(pointsToRenderFlat, POS_NUM)
    geometry.morphAttributes.color[0] = new THREE.BufferAttribute(pointsColors, COL_NUM)

    geometry.morphAttributes.position[1] = new THREE.BufferAttribute(pointsToRenderMapped, POS_NUM)
    geometry.morphAttributes.color[1] = new THREE.BufferAttribute(pointsColors, COL_NUM)

    return {geometry, imgMinZ, imgMaxZ}
}


export function getKoalaBufferGeometry(scenarioDataWrapper: ScenarioDataWrapper, steps: number) : THREE.BufferGeometry {

    const arrayMorphOffset = 2

    const geometry = new THREE.BufferGeometry()

    const height = scenarioDataWrapper.getHeightOfFrame(0)
    const width = scenarioDataWrapper.getWidthOfFrame(0)
    const numOfPoints = width*height

    const pointsToRender = new Float32Array(numOfPoints*3);
    const pointsColors = new Float32Array(numOfPoints*3);
    const pointsToRenderMorph = new Float32Array(numOfPoints*3);
    const pointsColorsMorph = new Float32Array(numOfPoints*3);

    const pointsToRenderSteps : Array<Float32Array> = []
    const pointsColorsSteps : Array<Float32Array> = []
    let pointPointer = 0

    for(let i = 0; i < steps; i++) {
        pointsToRenderSteps[i] = new Float32Array(numOfPoints*3)
        pointsColorsSteps[i] = new Float32Array(numOfPoints*3)
    }

    for(let i = 0; i < height; i++) {
        for(let j = 0; j < width; j++) {
        
            const u = i/width
            const v = j/width
            const rOriginal = scenarioDataWrapper.getValueAt(0, i, j, pointPointer*4 + 0, true, 0)
            const gOriginal = scenarioDataWrapper.getValueAt(0, i, j, pointPointer*4 + 1, true, 1)
            const bOriginal = scenarioDataWrapper.getValueAt(0, i, j, pointPointer*4 + 2, true, 2)

            pointsToRender[pointPointer*3 + 1] = -u + (height/width)/2
            pointsToRender[pointPointer*3] = v - 0.5
            pointsToRender[pointPointer*3 + 2] = rgbToInt([rOriginal, gOriginal, bOriginal]) / colorSpaceNormalizationSize

            pointsColors[pointPointer*3] = rOriginal / 255
            pointsColors[pointPointer*3 + 1] = gOriginal / 255
            pointsColors[pointPointer*3 + 2] = bOriginal / 255


            for(let k = 0; k < steps; k++) {
                const rMorph = scenarioDataWrapper.getValueAt(k + arrayMorphOffset, i, j, pointPointer*4 + 0, true, 0)
                const gMorph = scenarioDataWrapper.getValueAt(k + arrayMorphOffset, i, j, pointPointer*4 + 1, true, 1)
                const bMorph = scenarioDataWrapper.getValueAt(k + arrayMorphOffset, i, j, pointPointer*4 + 2, true, 2)

                pointsToRenderSteps[k][pointPointer*3 + 1] = -u + (height/width)/2
                pointsToRenderSteps[k][pointPointer*3] = v - 0.5
                pointsToRenderSteps[k][pointPointer*3 + 2] = rgbToInt([rMorph, gMorph, bMorph]) / colorSpaceNormalizationSize

                pointsColorsSteps[k][pointPointer*3] = rMorph / 255
                pointsColorsSteps[k][pointPointer*3 + 1] = gMorph / 255
                pointsColorsSteps[k][pointPointer*3 + 2] = bMorph / 255
            }

            const rTarget = scenarioDataWrapper.getValueAt(1, i, j, pointPointer*4 + 0, true, 0)
            const gTarget = scenarioDataWrapper.getValueAt(1, i, j, pointPointer*4 + 1, true, 1)
            const bTarget = scenarioDataWrapper.getValueAt(1, i, j, pointPointer*4 + 2, true, 2)

            pointsToRenderMorph[pointPointer*3 + 1] = -u + (height/width)/2
            pointsToRenderMorph[pointPointer*3] = v - 0.5
            pointsToRenderMorph[pointPointer*3 + 2] = rgbToInt([rTarget, gTarget, bTarget]) / colorSpaceNormalizationSize

            pointsColorsMorph[pointPointer*3] = rTarget / 255
            pointsColorsMorph[pointPointer*3 + 1] = gTarget / 255
            pointsColorsMorph[pointPointer*3 + 2] = bTarget / 255

            pointPointer++
        }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(pointsToRender, POS_NUM))
    geometry.setAttribute('color', new THREE.BufferAttribute(pointsColors, COL_NUM))
    geometry.morphAttributes.position = []
    geometry.morphAttributes.color = []

    for(let i = 0; i < steps; i++) {
        geometry.morphAttributes.position[i] = new THREE.BufferAttribute( pointsToRenderSteps[i], POS_NUM)
        geometry.morphAttributes.color[i] = new THREE.BufferAttribute( pointsColorsSteps[i], COL_NUM)
    }

    // Add final destination image
    geometry.morphAttributes.position[steps] = new THREE.BufferAttribute(pointsToRenderMorph, POS_NUM)
    geometry.morphAttributes.color[steps] = new THREE.BufferAttribute(pointsColorsMorph, COL_NUM)

    return geometry
}

export function getAIImagesBufferGeometryForPlane(
  scenarioDataWrapper: ScenarioDataWrapper,
  imgCenterPoints: { [sceneType: string]: Array<THREE.Vector3> },
  targetGeometry: string
): THREE.BufferGeometry {
  // Initialize the center points array if it doesn't exist for this geometry type
  if (imgCenterPoints[targetGeometry] == undefined) {
    imgCenterPoints[targetGeometry] = [];
  }

  const geometry = new THREE.BufferGeometry();

  // Get dimensions of the first image
  const height = scenarioDataWrapper.getHeightOfFrame(0);
  const width = scenarioDataWrapper.getWidthOfFrame(0);

  // Calculate aspect ratio
  const aspectRatio = width / height;

  // Find the maximum dimensions across all images (for padding)
  const maxHeight = height;
  const maxWidth = Math.round(maxHeight * aspectRatio);

  // Calculate offsets for centering smaller images in the maximum-sized space
  const heightDifference = maxHeight - height;
  const widthDifference = maxWidth - width;
  const heightOffset = Math.floor(heightDifference / 2);
  const widthOffset = Math.floor(widthDifference / 2);

  const positions = [];
  const colors = [];
  const uvs = [];
  const indices = [];

  let imgMinZ = Infinity;
  let imgMaxZ = -Infinity;

  // Generate vertices, UVs, and colors
  for (let i = 0; i < maxHeight; i++) {
    for (let j = 0; j < maxWidth; j++) {
      const u = j / (maxWidth - 1);
      const v = i / (maxHeight - 1);

      // For pixels outside the actual image area (padding), set flat with black color
      if (
        j < widthOffset ||
        j >= maxWidth - widthOffset ||
        i < heightOffset ||
        i >= maxHeight - heightOffset
      ) {
        positions.push(u - 0.5, -(v - 0.5) / aspectRatio, 0); // Flat Z position
        colors.push(0, 0, 0); // Black color
        uvs.push(u, 1.0 - v); // UV coordinates
      } else {
        // Calculate indices within the actual image
        const iShiftedIndex = i - heightOffset;
        const jShiftedIndex = j - widthOffset;

        // Match the coordinate calculation from getAIImagesBufferGeometry
        const posX = u - 0.5; // X position
        const posY = -(v - 0.5) / aspectRatio; // Y position (adjusted for aspect ratio)
        const z = scenarioDataWrapper.getValueAt(
          1,                          // Depth map index
          iShiftedIndex,              // Height position
          jShiftedIndex,              // Width position
          4 * (iShiftedIndex * width + jShiftedIndex) // Data index
        ) / 40;                       // Scale factor for depth

        positions.push(posX, posY, z);

        // Track min and max z values
        imgMinZ = Math.min(imgMinZ, z);
        imgMaxZ = Math.max(imgMaxZ, z);

        // Set UV coordinates - normalized to [0,1]
        uvs.push(u, 1.0 - v); // Flip V coordinate to match texture orientation

        // Get color from the RGB image (index 0)
        const r = scenarioDataWrapper.getValueAt(
          0, iShiftedIndex, jShiftedIndex,
          4 * (iShiftedIndex * width + jShiftedIndex),
          true, 0
        ) / 255;

        const g = scenarioDataWrapper.getValueAt(
          0, iShiftedIndex, jShiftedIndex,
          4 * (iShiftedIndex * width + jShiftedIndex) + 1,
          true, 1
        ) / 255;

        const b = scenarioDataWrapper.getValueAt(
          0, iShiftedIndex, jShiftedIndex,
          4 * (iShiftedIndex * width + jShiftedIndex) + 2,
          true, 2
        ) / 255;

        colors.push(r, g, b);
      }
    }
  }

  // Generate indices for triangles
  const depthThreshold = 0.2; // Adjust this threshold based on your scene scale
  for (let i = 0; i < maxHeight - 1; i++) {
    for (let j = 0; j < maxWidth - 1; j++) {
      const a = i * maxWidth + j;
      const b = i * maxWidth + j + 1;
      const c = (i + 1) * maxWidth + j;
      const d = (i + 1) * maxWidth + j + 1;

      // Get z-values for each corner of the quad
      const zA = positions[a * 3 + 2];
      const zB = positions[b * 3 + 2];
      const zC = positions[c * 3 + 2];
      const zD = positions[d * 3 + 2];

      // Check for depth discontinuities
      const maxDiff1 = Math.max(
        Math.abs(zA - zB),
        Math.abs(zA - zC),
        Math.abs(zB - zC)
      );

      const maxDiff2 = Math.max(
        Math.abs(zB - zC),
        Math.abs(zB - zD),
        Math.abs(zC - zD)
      );

      // Only add triangles if the depth differences are below threshold
      if (maxDiff1 < depthThreshold) {
        indices.push(a, c, b);
      }

      if (maxDiff2 < depthThreshold) {
        indices.push(b, c, d);
      }
    }
  }

  // Set attributes and indices
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);

  // Store min and max z values in imgCenterPoints for reference
  imgCenterPoints[targetGeometry] = [
    new THREE.Vector3(0, 0, imgMinZ),
    new THREE.Vector3(0, 0, imgMaxZ),
  ];

  return geometry;
}

export function getAIImagesBufferGeometry(scenarioDataWrapper: ScenarioDataWrapper, imgCenterPoints: {[sceneType: string] : Array<THREE.Vector3>}, targetGeometry: string) : THREE.BufferGeometry {

    // Initialize the center points array if it doesn't exist for this geometry type
    if (imgCenterPoints[targetGeometry] == undefined) {
        imgCenterPoints[targetGeometry] = []
    }

    const geometry = new THREE.BufferGeometry()

    // Arrays to store position and color data for each image-depth pair
    const pointsToRender : Array<Float32Array> = []
    const pointsColors : Array<Float32Array> = []
    let pointPointer = 0

    // Find the maximum dimensions across all images to create uniform-sized point clouds
    let maxHeight = 0
    let maxWidth = 0
    // Divide by 2 because we have pairs of images - even indices (0,2,4...) are RGB images
    // odd indices (1,3,5...) are their corresponding depth maps
    const gallerySize = scenarioDataWrapper.getFramesCount()/2 
    for(let i = 0; i < gallerySize; i++) {
        // Get dimensions from the RGB image (even index)
        maxHeight = Math.max(maxHeight, scenarioDataWrapper.getHeightOfFrame(2*i))
        maxWidth = Math.max(maxHeight, scenarioDataWrapper.getWidthOfFrame(2*i))
    }

    // Process each image-depth pair
    for(let k = 0; k < gallerySize; k++) {

        // Get dimensions of current RGB image
        const height = scenarioDataWrapper.getHeightOfFrame(2*k)
        const width = scenarioDataWrapper.getWidthOfFrame(2*k)
        const numOfPoints = maxWidth*maxHeight
        
        // Store the center depth value for this image-depth pair
        // Uses depth map (2*k + 1) to determine the Z position of the center
        imgCenterPoints[targetGeometry][k] = new THREE.Vector3(0, 0, scenarioDataWrapper.getCenterValueAt(2*k + 1) / aiImagesNormalizationSize)

        // Calculate offsets for centering smaller images in the maximum-sized space
        const heightDifference = maxHeight - height
        const widthDifference = maxWidth - width
        const heightOffset = Math.floor(heightDifference/2)
        const widthOffset = Math.floor(widthDifference/2)

        // Create arrays for this image's points
        pointsToRender[k] = new Float32Array(numOfPoints*3)
        pointsColors[k] = new Float32Array(numOfPoints*3)

        // Process each pixel in the uniform-sized grid
        for(let i = 0; i < maxHeight; i++) {
            for(let j = 0; j < maxWidth; j++) {

                const u = i/maxWidth
                const v = j/maxWidth

                // For pixels outside the actual image area (padding), set flat with black color
                if (j < widthOffset || j >= maxWidth - widthOffset - 1 || i < heightOffset || i >= maxHeight - heightOffset - 1) {
                    pointsToRender[k][pointPointer*3 + 1] = -u + (height/width)/2  // Y position
                    pointsToRender[k][pointPointer*3] = v - 0.5                   // X position
                    pointsToRender[k][pointPointer*3 + 2] = 0                     // Z position (flat)

                    pointsColors[k][pointPointer*3] = 0     // R
                    pointsColors[k][pointPointer*3 + 1] = 0 // G
                    pointsColors[k][pointPointer*3 + 2] = 0 // B
                } else {
                    // Calculate indices within the actual image
                    const iShiftedIndex = i - heightOffset
                    const jShiftedIndex = j - widthOffset

                    // Position points in 3D space
                    pointsToRender[k][pointPointer*3 + 1] = -u + (height/width)/2  // Y position
                    pointsToRender[k][pointPointer*3] = v - 0.5                   // X position
                    
                    // Use depth map (2*k+1) value to set the Z coordinate
                    // This creates the 3D effect - pixels with higher depth values are positioned further away
                    pointsToRender[k][pointPointer*3 + 2] = scenarioDataWrapper.getValueAt(
                        2*k + 1,                                       // Depth map index (odd numbers)
                        iShiftedIndex,                                 // Height position
                        jShiftedIndex,                                 // Width position
                        4*(iShiftedIndex*width + jShiftedIndex)        // Data index
                    ) / 40                                             // Scale factor for depth

                    // Get color from RGB image (2*k - even numbers)
                    pointsColors[k][pointPointer*3] = scenarioDataWrapper.getValueAt(
                        2*k,                                          // RGB image index (even numbers)
                        iShiftedIndex,                                // Height position
                        jShiftedIndex,                                // Width position
                        4*(iShiftedIndex*width + jShiftedIndex),      // Data index for red
                        true, 0                                       // isRGB flag, color offset for red
                    ) / 255                                           // Normalize to 0-1 range
                    
                    // Green channel
                    pointsColors[k][pointPointer*3 + 1] = scenarioDataWrapper.getValueAt(
                        2*k, iShiftedIndex, jShiftedIndex,
                        4*(iShiftedIndex*width + jShiftedIndex) + 1,  // +1 offset for green
                        true, 1
                    ) / 255
                    
                    // Blue channel
                    pointsColors[k][pointPointer*3 + 2] = scenarioDataWrapper.getValueAt(
                        2*k, iShiftedIndex, jShiftedIndex,
                        4*(iShiftedIndex*width + jShiftedIndex) + 2,  // +2 offset for blue
                        true, 2
                    ) / 255
                }
                pointPointer++
            }
        }

        // Reset point pointer for the next image
        pointPointer = 0
    }

    // Set the initial position and color attributes (first image-depth pair)
    geometry.setAttribute('position', new THREE.BufferAttribute(pointsToRender[0], POS_NUM))
    geometry.setAttribute('color', new THREE.BufferAttribute(pointsColors[0], COL_NUM))

    // If we have multiple images, set up morphing attributes for transitions
    if (pointsToRender.length > 1) {
        geometry.morphAttributes.position = []
        geometry.morphAttributes.color = []

        // Add remaining images as morph targets (starting from the second image)
        // This allows for smooth transitions between different images
        for(let i = 1; i < gallerySize; i++) {
            geometry.morphAttributes.position[i - 1] = new THREE.BufferAttribute(pointsToRender[i], POS_NUM)
            geometry.morphAttributes.color[i - 1] = new THREE.BufferAttribute(pointsColors[i], COL_NUM)
        }
    }

    return geometry
}


export function getActBufferGeometry(scenarioDataWrapper: ScenarioDataWrapper, steps: number) : THREE.BufferGeometry {

    const arrayMorphOffset = 4
    const geometry = new THREE.BufferGeometry()

    const height = scenarioDataWrapper.getHeightOfFrame(0)
    const width = scenarioDataWrapper.getWidthOfFrame(0)
    const numOfPoints = width*height

    const pointsToRender = new Float32Array(numOfPoints*3);
    const pointsColors = new Float32Array(numOfPoints*3);
    const pointsToRenderMorph = new Float32Array(numOfPoints*3);
    const pointsColorsMorph = new Float32Array(numOfPoints*3);

    const pointsToRenderSteps : Array<Float32Array> = []
    const pointsColorsSteps : Array<Float32Array> = []
    let pointPointer = 0

    for(let i = 0; i < steps; i++) {
        pointsToRenderSteps[i] = new Float32Array(numOfPoints*3)
        pointsColorsSteps[i] = new Float32Array(numOfPoints*3)
    }

    for(let i = 0; i < height; i++) {
        for(let j = 0; j < width; j++) {
        
            const u = i/width
            const v = j/width

            pointsToRender[pointPointer*3 + 1] = -u + (height/width)/2
            pointsToRender[pointPointer*3] = v - 0.5
            removeNoise(scenarioDataWrapper.getValueAt(1, i, j, pointPointer*4, false, 0, true), scenarioDataWrapper.getFrameRawDataAt(1), i, j, width, height, pointPointer, pointsToRender)

            pointsColors[pointPointer*3] = scenarioDataWrapper.getValueAt(0, i, j, pointPointer*4, true, 0) / 255
            pointsColors[pointPointer*3 + 1] = scenarioDataWrapper.getValueAt(0, i, j, pointPointer*4 + 1, true, 1) / 255
            pointsColors[pointPointer*3 + 2] = scenarioDataWrapper.getValueAt(0, i, j, pointPointer*4 + 2, true, 2) / 255


            for(let k = 0; k < steps; k++) {

                pointsToRenderSteps[k][pointPointer*3 + 1] = -u + (height/width)/2
                pointsToRenderSteps[k][pointPointer*3] = v - 0.5
                removeNoise(scenarioDataWrapper.getValueAt(arrayMorphOffset + steps + k, i, j, pointPointer*4, false, 0, true), scenarioDataWrapper.getFrameRawDataAt(arrayMorphOffset + steps + k), i, j, width, height, pointPointer, pointsToRenderSteps[k])

                pointsColorsSteps[k][pointPointer*3] = scenarioDataWrapper.getValueAt(k + arrayMorphOffset, i, j, pointPointer*4, true, 0) / 255
                pointsColorsSteps[k][pointPointer*3 + 1] = scenarioDataWrapper.getValueAt(k + arrayMorphOffset, i, j, pointPointer*4 + 1, true, 1) / 255
                pointsColorsSteps[k][pointPointer*3 + 2] = scenarioDataWrapper.getValueAt(k + arrayMorphOffset, i, j, pointPointer*4 + 2, true, 2) / 255
            }



            pointsToRenderMorph[pointPointer*3 + 1] = -u + (height/width)/2
            pointsToRenderMorph[pointPointer*3] = v - 0.5
            removeNoise(scenarioDataWrapper.getValueAt(3, i, j, pointPointer*4, false, 0, true), scenarioDataWrapper.getFrameRawDataAt(3), i, j, width, height, pointPointer, pointsToRenderMorph)

            pointsColorsMorph[pointPointer*3] = scenarioDataWrapper.getValueAt(2, i, j, pointPointer*4, true, 0) / 255
            pointsColorsMorph[pointPointer*3 + 1] = scenarioDataWrapper.getValueAt(2, i, j, pointPointer*4 + 1, true, 1) / 255
            pointsColorsMorph[pointPointer*3 + 2] = scenarioDataWrapper.getValueAt(2, i, j, pointPointer*4 + 2, true, 2) / 255

            pointPointer++
        }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(pointsToRender, POS_NUM))
    geometry.setAttribute('color', new THREE.BufferAttribute(pointsColors, COL_NUM))
    geometry.morphAttributes.position = []
    geometry.morphAttributes.color = []

    for(let i = 0; i < steps; i++) {
        geometry.morphAttributes.position[i] = new THREE.BufferAttribute( pointsToRenderSteps[i], POS_NUM)
        geometry.morphAttributes.color[i] = new THREE.BufferAttribute( pointsColorsSteps[i], COL_NUM)
    }

    // Add final destination image
    geometry.morphAttributes.position[steps] = new THREE.BufferAttribute(pointsToRenderMorph, POS_NUM)
    geometry.morphAttributes.color[steps] = new THREE.BufferAttribute(pointsColorsMorph, COL_NUM)

    return geometry
}

// util functions

function removeNoise(depthMapColor: number, depthmap: Array<Array<number>> | ImageData, i: number, j: number, width: number, height: number, pointPointer: number, pointsToRender: Float32Array) {
    if (depthMapColor != 0) {

        const percentage = depthMapColor/100
        let left = depthMapColor
        let right = depthMapColor
        let top = depthMapColor
        let down = depthMapColor
        const dropThreshold = 5*percentage

        if (!Array.isArray(depthmap)) {
            if (j > 0) left = (depthmap as ImageData).data[pointPointer*4-4]
            if (j < width - 1) right = (depthmap as ImageData).data[pointPointer*4+4]
            if (pointPointer - width > 0) top = (depthmap as ImageData).data[4*(pointPointer - width)]
            if (pointPointer + width < height*width-1) down = (depthmap as ImageData).data[4*(pointPointer + width)]
        } else {
            if (j > 0) left = depthmap[i][j-1]
            if (j < width-1) right = depthmap[i][j+1]
            if (i > 0) top = depthmap[i-1][j]
            if (i < height-1) down = depthmap[i+1][j]
        }
        
        if(Math.abs(left - depthMapColor) > dropThreshold || Math.abs(right - depthMapColor) > dropThreshold) {
            pointsToRender[pointPointer*3 + 2] = 0
        }
        else if(Math.abs(top - depthMapColor) > dropThreshold || Math.abs(down - depthMapColor) > dropThreshold) {
            pointsToRender[pointPointer*3 + 2] = 0
        } else {
            // extra scale
            if (!Array.isArray(depthmap)) {
                pointsToRender[pointPointer*3 + 2] = 10 + -1*depthMapColor / 20
            } else {
                pointsToRender[pointPointer*3 + 2] = 3*(1 - depthMapColor)
            }
        }
    }
}

function rgbToInt(color: Array<number>): number {
    let rbgInt = 0
    for(let c of color) {
        rbgInt = (rbgInt<<8) + c
    }

    return rbgInt
}

// Wrapper of frame data so we can merge geometry generation methods
export class ScenarioDataWrapper {

    parsedData: any[] = []

    constructor(public imageData: ImageData[] = [], public jsonData: any[] = [] ) {
        if (jsonData.length > 0) {
            for (let i = 0; i < jsonData.length; i++) {
                this.parsedData.push(JSON.parse(jsonData[i]))
            }
        }
    }

    getHeightOfFrame(frame: number) : number {
        if (this.imageData.length != 0) {
            return this.imageData[frame].height
        } else {
            return this.parsedData[frame].length
        }
    }

    getWidthOfFrame(frame: number) : number {
        if (this.imageData.length != 0) {
            return this.imageData[frame].width
        } else {
            return this.parsedData[frame][0].length
        }
    }

    getCenterValueAt(frame: number) : number {
        if (this.imageData.length != 0) {
            return this.imageData[frame].data[this.imageData[frame].width*this.imageData[frame].height*2]
        } else {
            return this.parsedData[frame][Math.floor(this.parsedData[frame].length/2)][Math.floor(this.parsedData[frame][0].length/2)]
        }
    }

    getValueAt(frame: number, height: number, width: number, index: number, isRgb = false, offset = 0, ignoreScale = false) : number {
        if (this.imageData.length != 0) {
            return this.imageData[frame].data[index]
        } else {
            if (isRgb) {
                return this.parsedData[frame][height][width][offset]
            } else {
                let scale = 330
                if (ignoreScale) {
                    scale = 1
                }
                return this.parsedData[frame][height][width] / scale
            }
        }
    }

    getFramesCount() : number {
        if (this.imageData.length != 0) {
            return this.imageData.length
        } else {
            return this.parsedData.length
        }
    }

    getFrameRawDataAt(frame: number) : ImageData | number[][] {
        if (this.imageData.length != 0) {
            return this.imageData[frame]
        } else {
            return this.parsedData[frame]
        }
    }
}