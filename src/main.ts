import * as THREE from 'three/webgpu';

import init, { ECS } from "../pkg/ecs"
import { Timer } from './Timer';

async function run() {
    const fps = 30;

    // Create a scene
    const scene = new THREE.Scene();

    // Create a camera
    const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000);

    // Create a WebGL renderer
    const renderer = new THREE.WebGPURenderer( {antialias: true});
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Add a cube
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    // Move the camera back
    camera.position.z = 5;

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
        //requestAnimationFrame(animate);

        // Rotate cube
        cube.rotation.x += 0.02;
        cube.rotation.y += 0.02;

        renderer.render(scene, camera);
    }
}


run();

