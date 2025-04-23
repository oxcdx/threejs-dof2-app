import * as THREE from 'three';
import { GUI } from 'lil-gui';
import Stats from 'stats.js';
import { BokehShader, BokehDepthShader } from 'three/examples/jsm/shaders/BokehShader2.js';

export function initScene() {
  const container = document.getElementById('app');
  if (!container) {
    console.error('App container not found');
    return;
  }

  // Scene, Camera, Renderer
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 3000);
  camera.position.set(0, 150, 450);
  scene.add(camera);

  

  const renderer = new THREE.WebGLRenderer();
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.autoClear = false;
  container.appendChild(renderer.domElement);

  // Stats
  const stats = new Stats();
  container.appendChild(stats.dom);

  const mouse = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  const target = new THREE.Vector3(0, 20, -50);

  container.addEventListener('pointermove', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
      const distance = intersects[0].distance;
      postprocessing.bokeh_uniforms['focalDepth'].value = distance;
    }
  });

  // Lights
  scene.add(new THREE.AmbientLight(0xcccccc));
  const directionalLight1 = new THREE.DirectionalLight(0xffffff, 6);
  directionalLight1.position.set(2, 1.2, 10).normalize();
  scene.add(directionalLight1);

  const directionalLight2 = new THREE.DirectionalLight(0xffffff, 3);
  directionalLight2.position.set(-2, 1.2, -10).normalize();
  scene.add(directionalLight2);

  // Skybox
  const textureLoader = new THREE.CubeTextureLoader();
  const textureCube = textureLoader.load([
    'textures/cube/Bridge2/posx.jpg',
    'textures/cube/Bridge2/negx.jpg',
    'textures/cube/Bridge2/posy.jpg',
    'textures/cube/Bridge2/negy.jpg',
    'textures/cube/Bridge2/posz.jpg',
    'textures/cube/Bridge2/negz.jpg',
  ]);
  scene.background = textureCube;

  const planes: THREE.Mesh[] = [];
  const planeGeometry = new THREE.PlaneGeometry(10, 10);
  const planeMaterial = new THREE.MeshPhongMaterial({
    color: 0xffffff * 0.4,
    shininess: 0.5,
    specular: 0xffffff,
    envMap: textureCube,
    side: THREE.DoubleSide,
  });

  // Objects
  const geometry = new THREE.SphereGeometry(1, 20, 20);
  for (let i = 0; i < 20; i++) {
    const material = new THREE.MeshPhongMaterial({
      color: Math.random() * 0xffffff,
      shininess: 0.5,
      specular: 0xffffff,
      envMap: textureCube,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(
      (Math.random() - 0.5) * 200,
      Math.random() * 50,
      (Math.random() - 0.5) * 200
    );
    mesh.scale.multiplyScalar(10);
    scene.add(mesh);
  }

  // Postprocessing
  const postprocessing = initPostprocessing(renderer, scene, camera);

  // GUI
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

  // Add shader settings
  const shaderSettings = {
    rings: 3,
    samples: 4,
  };

  // Function to update material properties
  const matChanger = () => {
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
  };

  // Add GUI controls
  const gui = new GUI();

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

  // Animation Loop
  function animate() {
    stats.update();
    render();
    requestAnimationFrame(animate);
  }

  function animateCamera() {
    const time = Date.now() * 0.0001;
    camera.position.x = Math.cos(time) * 400;
    camera.position.z = Math.sin(time) * 400;
    camera.lookAt(target);
  }

  function render() {
    animateCamera();

    for (let i = 0; i < 100; i++) {
      const plane = new THREE.Mesh(planeGeometry, planeMaterial);
      plane.position.set(
        Math.random() * 300 - 150,
        Math.random() * 300,
        Math.random() * 300 - 150
      );
      plane.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      planes.push(plane);
      scene.add(plane);
    }
    
    // Animate planes in the render loop
    planes.forEach((plane) => {
      plane.rotation.x += 0.01;
      plane.rotation.y += 0.01;
    });
  
    if (postprocessing.enabled) {
      renderer.clear();
  
      // Render scene into color texture
      renderer.setRenderTarget(postprocessing.rtTextureColor);
      renderer.clear();
      renderer.render(scene, camera);
  
      // Render depth into depth texture
      scene.overrideMaterial = postprocessing.materialDepth;
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
}

function initPostprocessing(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
  const postprocessing: any = {};

  postprocessing.scene = new THREE.Scene();
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

  postprocessing.rtTextureColor = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
    type: THREE.HalfFloatType,
  });
  postprocessing.rtTextureDepth = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
    type: THREE.HalfFloatType,
  });

  const bokehShader = BokehShader;
  // @ts-ignore
  postprocessing.bokeh_uniforms = THREE.UniformsUtils.clone(bokehShader.uniforms);
  postprocessing.bokeh_uniforms['tColor'].value = postprocessing.rtTextureColor.texture;
  postprocessing.bokeh_uniforms['tDepth'].value = postprocessing.rtTextureDepth.texture;
  postprocessing.bokeh_uniforms['textureWidth'].value = window.innerWidth;
  postprocessing.bokeh_uniforms['textureHeight'].value = window.innerHeight;

  postprocessing.materialBokeh = new THREE.ShaderMaterial({
    uniforms: postprocessing.bokeh_uniforms,
    vertexShader: bokehShader.vertexShader,
    fragmentShader: bokehShader.fragmentShader,
    defines: {
      RINGS: 3,
      SAMPLES: 4,
    },
  });

  postprocessing.quad = new THREE.Mesh(
    new THREE.PlaneGeometry(window.innerWidth, window.innerHeight),
    postprocessing.materialBokeh
  );
  postprocessing.quad.position.z = -500;
  postprocessing.scene.add(postprocessing.quad);

  const depthShader = BokehDepthShader;
  postprocessing.materialDepth = new THREE.ShaderMaterial({
    uniforms: depthShader.uniforms,
    vertexShader: depthShader.vertexShader,
    fragmentShader: depthShader.fragmentShader,
  });
  // @ts-ignore
  postprocessing.materialDepth.uniforms['mNear'].value = camera.near;
  // @ts-ignore
  postprocessing.materialDepth.uniforms['mFar'].value = camera.far;

  return postprocessing;
}