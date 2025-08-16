import * as THREE from 'three/webgpu';

// interface ECSMesh extends THREE.Mesh {
//     ecsId: number;
// }

export async function initScene() {
    // Create a scene
    const scene = new THREE.Scene();

    // Create a camera
    const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 8, 4);
    camera.lookAt(0, 0, 0);

    // Create a WebGPU renderer
    const renderer = new THREE.WebGPURenderer( {antialias: true});
    await renderer.init();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    renderer.shadowMap.enabled = true;

    // Light
    const directional_light = new THREE.DirectionalLight(0xffffff, 1);
    directional_light.position.set(3, 5, 2);
    directional_light.castShadow = true;
    scene.add(directional_light);

    const ambient_light = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambient_light);

    //Add a plane
    const planeGeometry = new THREE.PlaneGeometry(25, 25, 10, 10);
    const planeMaterial = new THREE.MeshStandardMaterial({
        color: 0x88FF88,
        side: THREE.DoubleSide,
        wireframe: false
    });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);

    plane.receiveShadow = true;
    plane.rotation.x = -Math.PI / 2;
    scene.add(plane);
    
    return { scene, camera, renderer };
}

