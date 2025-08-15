import * as THREE from 'three/webgpu';
import Stats from 'stats.js';

import init, { ECS } from "../pkg/ecs"
import { Timer } from './Timer';

async function run() {
    const fps = 30;

    const stats = new Stats()
    document.body.appendChild(stats.dom)

    // Create a scene
    const scene = new THREE.Scene();

    // Create a camera
    const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 8, 4);
    camera.lookAt(0, 0, 0);

    // Create a WebGL renderer
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

    // Add a cube
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshStandardMaterial({ color: 0xff5555 });
    const cube = new THREE.Mesh(geometry, material);
    cube.position.y = 1;
    cube.castShadow = true;
    scene.add(cube);

    //Initialise ECS
    await init();

    let ecs;
    try {
        ecs = new ECS();
    } catch (err) {
        console.error("Failed to create ECS:", err);
        return;
    }
    
    const timer = new Timer(() => {
        try {
            ecs.update();
            animate();
        } catch (err) {
            console.error("Error in world.update():", err);
        }
    }, 1000 / fps);

    timer.start();

    // Render loop
    function animate() {
        // Rotate cube
        cube.rotation.x += 0.1;
        cube.rotation.y += 0.1;

        renderer.render(scene, camera);
        stats.update();
    }
}


run();

