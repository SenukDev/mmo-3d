import Stats from 'stats.js';
import * as THREE from 'three/webgpu';

import init, { ECS } from "../pkg/ecs"
import { Timer } from './Timer';
import { initScene } from './Renderer';

async function run() {
    const fps = 30;

    const stats = new Stats()
    document.body.appendChild(stats.dom)

    //Initialise Three Scene
    const { scene, camera, renderer } = await initScene();
    
    
    //Initialise Rust Console Logger
    await init();

    //Create ECS
    let ecs;
    try {
        ecs = new ECS();
    } catch (err) {
        console.error("Failed to create ECS:", err);
        return;
    }

    // Add a cube
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshStandardMaterial({ color: 0xff5555 });
    const cube = new THREE.Mesh(geometry, material);
    cube.position.y = 1;
    cube.castShadow = true;
    scene.add(cube);
    
    const timer = new Timer(() => {
        try {
            cube.rotation.x += 0.1;
            cube.rotation.y += 0.1;
            ecs.update();
            renderer.render(scene, camera);
            stats.update();
        } catch (err) {
            console.error("Error in ecs.update():", err);
        }
    }, 1000 / fps);

    timer.start();
}

run();