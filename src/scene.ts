import * as THREE from 'three';
import { GUI } from 'lil-gui';
import Stats from 'stats.js';
import { BokehShader, BokehDepthShader } from 'three/examples/jsm/shaders/BokehShader2.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export function initScene() {
  const container = document.getElementById('app');
  if (!container) {
    console.error('App container not found');
    return;
  }

  // Scene, Camera, Renderer
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 3000);
  camera.position.y = 150;
  camera.position.z = 450;

  let distance = 100;

  const renderer = new THREE.WebGLRenderer();
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 20, -50); // Set the initial focus point
  controls.update();

  // Stats
  const stats = new Stats();
  container.appendChild(stats.dom);

  const depthShader = BokehDepthShader;
  const materialDepth = new THREE.ShaderMaterial({
    uniforms: depthShader.uniforms,
    vertexShader: depthShader.vertexShader,
    fragmentShader: depthShader.fragmentShader,
  });

  // Set near and far plane values for depth calculation
  materialDepth.uniforms['mNear'].value = camera.near;
  materialDepth.uniforms['mFar'].value = camera.far;

  // Skybox
  const r = 'textures/cube/Bridge2/';
  const urls = [
    r + 'posx.jpg', r + 'negx.jpg',
    r + 'posy.jpg', r + 'negy.jpg',
    r + 'posz.jpg', r + 'negz.jpg'
  ];

  const textureCube = new THREE.CubeTextureLoader().load(urls);
  scene.background = textureCube;

  // Add lights
  scene.add(new THREE.AmbientLight(0xcccccc));

  const directionalLight1 = new THREE.DirectionalLight(0xffffff, 6);
  directionalLight1.position.set(2, 1.2, 10).normalize();
  scene.add(directionalLight1);

  const directionalLight2 = new THREE.DirectionalLight(0xffffff, 3);
  directionalLight2.position.set(-2, 1.2, -10).normalize();
  scene.add(directionalLight2);

  const postprocessing = initPostprocessing(renderer, scene, camera);

  const gui = new GUI();
  const effectController = {
    enabled: true,
    jsDepthCalculation: true,
    shaderFocus: false,
    focalDepth: 2.8,
    fstop: 2.2,
    maxblur: 1.0,
    showFocus: false,
    manualdof: false,
    vignetting: false,
    depthblur: false,
    threshold: 0.5,
    gain: 2.0,
    bias: 0.5,
    fringe: 0.7,
    focalLength: 35,
    noise: true,
    pentagon: false,
    dithering: 0.0001,
  };

  
  const shaderSettings = {
    rings: 3,
    samples: 4,
  };

  const matChanger = function () {
    for (const e in effectController) {
      if (e in postprocessing.bokeh_uniforms) {
        // @ts-ignore
        postprocessing.bokeh_uniforms[e].value = effectController[e];
      }
    }
  
    postprocessing.enabled = effectController.enabled;
    postprocessing.bokeh_uniforms['znear'].value = camera.near;
    postprocessing.bokeh_uniforms['zfar'].value = camera.far;
    camera.setFocalLength(effectController.focalLength);
  
    // Ensure the shader material is updated
    postprocessing.materialBokeh.needsUpdate = true;
  };

  gui.add(effectController, 'enabled').onChange(matChanger);
  gui.add(effectController, 'jsDepthCalculation').onChange(matChanger);
  gui.add(effectController, 'shaderFocus').onChange(matChanger);
  gui.add(effectController, 'focalDepth', 0.0, 200.0).listen().onChange(matChanger);
  gui.add(effectController, 'fstop', 0.1, 22, 0.001).onChange(matChanger);
  gui.add(effectController, 'maxblur', 0.0, 5.0, 0.025).onChange(matChanger);
  gui.add(effectController, 'showFocus').onChange(matChanger);
  gui.add(effectController, 'manualdof').onChange(matChanger);
  gui.add(effectController, 'vignetting').onChange(matChanger);
  gui.add(effectController, 'depthblur').onChange(matChanger);
  gui.add(effectController, 'threshold', 0, 1, 0.001).onChange(matChanger);
  gui.add(effectController, 'gain', 0, 100, 0.001).onChange(matChanger);
  gui.add(effectController, 'bias', 0, 3, 0.001).onChange(matChanger);
  gui.add(effectController, 'fringe', 0, 5, 0.001).onChange(matChanger);
  gui.add(effectController, 'focalLength', 16, 80, 0.001).onChange(matChanger);
  gui.add(effectController, 'noise').onChange(matChanger);
  gui.add(effectController, 'dithering', 0, 0.001, 0.0001).onChange(matChanger);
  gui.add(effectController, 'pentagon').onChange(matChanger);
  gui.add(shaderSettings, 'rings', 1, 8).step(1).onChange(() => {
    postprocessing.materialBokeh.defines.RINGS = shaderSettings.rings;
    postprocessing.materialBokeh.needsUpdate = true;
  });
  gui.add(shaderSettings, 'samples', 1, 13).step(1).onChange(() => {
    postprocessing.materialBokeh.defines.SAMPLES = shaderSettings.samples;
    postprocessing.materialBokeh.needsUpdate = true;
  });

  // Add balls
  const sphereGeometry = new THREE.SphereGeometry(1, 20, 20);

  for (let i = 0; i < 20; i++) {
    const sphereMaterial = new THREE.MeshPhongMaterial({
      color: Math.random() * 0xffffff,
      shininess: 0.5,
      specular: 0xffffff,
      envMap: textureCube,
    });

    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere.position.set(
      (Math.random() - 0.5) * 200,
      Math.random() * 50,
      (Math.random() - 0.5) * 200
    );
    sphere.scale.multiplyScalar(10);
    scene.add(sphere);
  }

  const target = new THREE.Vector3(0, 20, -50);

  const mouse = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();

  container.style.touchAction = 'none';
  container.addEventListener('pointermove', (event) => {
    if (!postprocessing.enabled) return;
  
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  
    raycaster.setFromCamera(mouse, camera);
  
    const intersects = raycaster.intersectObjects(scene.children, true);
  
    if (intersects.length > 0) {
      console.log('Intersected object:', intersects[0].object);
      const distance = intersects[0].distance;
      postprocessing.bokeh_uniforms['focalDepth'].value = distance;
    } else {
      console.log('No intersection');
    }
  });

  function animateCamera() {
    const time = Date.now() * 0.00015;

    camera.position.x = Math.cos(time) * 400;
    camera.position.z = Math.sin(time) * 500;
    camera.position.y = Math.sin(time / 1.4) * 100;

    camera.lookAt(target);
  }
  
  // Animation loop
  function animate() {
    stats.update();
    requestAnimationFrame(animate);
  
    // animateCamera();
    controls.update();
    render();
  }

  function render() {

    if (effectController.jsDepthCalculation) {
      raycaster.setFromCamera(mouse, camera);
  
      const intersects = raycaster.intersectObjects(scene.children, true);
  
      const targetDistance = intersects.length > 0 ? intersects[0].distance : 1000;
  
      // Smoothly transition to the new focal depth
      distance += (targetDistance - distance) * 0.03;
  
      const sdistance = smoothstep(camera.near, camera.far, distance);
      const ldistance = linearize(1 - sdistance);
  
      postprocessing.bokeh_uniforms['focalDepth'].value = ldistance;
      effectController.focalDepth = ldistance; // Sync with GUI
    }
  
    if (postprocessing.enabled) {
      renderer.clear();
  
      // Render scene into color texture
      renderer.setRenderTarget(postprocessing.rtTextureColor);
      renderer.clear();
      renderer.render(scene, camera);
  
      // Render depth into depth texture
      // @ts-ignore
      scene.overrideMaterial = materialDepth;
      renderer.setRenderTarget(postprocessing.rtTextureDepth);
      renderer.clear();
      renderer.render(scene, camera);
      scene.overrideMaterial = null;
  
      // Render postprocessing
      renderer.setRenderTarget(null);
      renderer.render(postprocessing.scene, postprocessing.camera);
    } else {
      renderer.render(scene, camera);
    }
  }

  animate();

  function smoothstep(near: number, far: number, depth: number): number {
    const x = Math.max(0, Math.min(1, (depth - near) / (far - near)));
    return x * x * (3 - 2 * x);
  }
  
  function linearize(depth: number): number {
    const zfar = camera.far;
    const znear = camera.near;
    return -zfar * znear / (depth * (zfar - znear) - zfar);
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  
    postprocessing.rtTextureColor.setSize(window.innerWidth, window.innerHeight);
    postprocessing.rtTextureDepth.setSize(window.innerWidth, window.innerHeight);
  
    postprocessing.bokeh_uniforms['textureWidth'].value = window.innerWidth;
    postprocessing.bokeh_uniforms['textureHeight'].value = window.innerHeight;
  
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}


//
function initPostprocessing(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera
): {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  rtTextureColor: THREE.WebGLRenderTarget;
  rtTextureDepth: THREE.WebGLRenderTarget;
  bokeh_uniforms: { [key: string]: THREE.IUniform };
  materialBokeh: THREE.ShaderMaterial;
  quad: THREE.Mesh;
  enabled: boolean;
} {
  const postprocessing: {
    scene: THREE.Scene;
    camera: THREE.OrthographicCamera;
    rtTextureColor: THREE.WebGLRenderTarget;
    rtTextureDepth: THREE.WebGLRenderTarget;
    bokeh_uniforms: { [key: string]: THREE.IUniform };
    materialBokeh: THREE.ShaderMaterial;
    quad: THREE.Mesh;
    enabled: boolean;
  } = {} as any;

  // Initialize the enabled property
  postprocessing.enabled = true;

  // Create a new scene for postprocessing
  postprocessing.scene = new THREE.Scene();

  // Orthographic camera for postprocessing
  postprocessing.camera = new THREE.OrthographicCamera(
    window.innerWidth / -2,
    window.innerWidth / 2,
    window.innerHeight / 2,
    window.innerHeight / -2,
    -10000,
    10000
  );
  postprocessing.camera.position.z = 100;
  postprocessing.scene.add(postprocessing.camera);

  // Render targets for color and depth
  postprocessing.rtTextureColor = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
    type: THREE.HalfFloatType,
  });
  postprocessing.rtTextureDepth = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
    type: THREE.HalfFloatType,
  });

  // Clone BokehShader uniforms
  const bokehShader = BokehShader;
  // @ts-ignore
  postprocessing.bokeh_uniforms = THREE.UniformsUtils.clone(bokehShader.uniforms);
  postprocessing.bokeh_uniforms['tColor'].value = postprocessing.rtTextureColor.texture;
  postprocessing.bokeh_uniforms['tDepth'].value = postprocessing.rtTextureDepth.texture;
  postprocessing.bokeh_uniforms['textureWidth'].value = window.innerWidth;
  postprocessing.bokeh_uniforms['textureHeight'].value = window.innerHeight;

  // Create the Bokeh material
  postprocessing.materialBokeh = new THREE.ShaderMaterial({
    uniforms: postprocessing.bokeh_uniforms,
    vertexShader: bokehShader.vertexShader,
    fragmentShader: bokehShader.fragmentShader,
    defines: {
      RINGS: 3, // Default value for shader settings
      SAMPLES: 4, // Default value for shader settings
    },
  });

  // Create a quad for rendering the postprocessing effect
  postprocessing.quad = new THREE.Mesh(
    new THREE.PlaneGeometry(window.innerWidth, window.innerHeight),
    postprocessing.materialBokeh
  );
  postprocessing.quad.position.z = -500;
  postprocessing.scene.add(postprocessing.quad);

  return postprocessing;
}

