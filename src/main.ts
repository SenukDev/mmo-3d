import * as THREE from 'three';

// Create a scene
const scene = new THREE.Scene();

// Create a camera
const camera = new THREE.PerspectiveCamera(
    75, // fov
    window.innerWidth / window.innerHeight, // aspect
    0.1, // near
    1000 // far
);

// Create a WebGL renderer
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Add a cube
const geometry = new THREE.BoxGeometry();
const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

// Move the camera back
camera.position.z = 5;

// Render loop
function animate() {
    requestAnimationFrame(animate);

    // Rotate cube
    cube.rotation.x += 0.01;
    cube.rotation.y += 0.01;

    renderer.render(scene, camera);
}
animate();