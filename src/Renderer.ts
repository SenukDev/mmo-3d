import * as THREE from 'three/webgpu';
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"

// interface ECSMesh extends THREE.Mesh {
//     ecsId: number;
// }

export class Renderer {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGPURenderer;

    constructor() {
        this.scene = new THREE.Scene();

        this.camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 6, 4);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGPURenderer({ antialias: true });
    }

    async init() {
        await this.renderer.init();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);

        this.renderer.shadowMap.enabled = true;

        this.addLights();
        this.addGround();
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }

    addLights() {
        const directional_light = new THREE.DirectionalLight(0xffffff, 1);
        directional_light.position.set(3, 5, 2);
        directional_light.castShadow = true;
        this.scene.add(directional_light);

        const ambient_light = new THREE.AmbientLight(0xffffff, 0.3);
        this.scene.add(ambient_light);
    }

    addGround() {
        const planeGeometry = new THREE.PlaneGeometry(25, 25, 10, 10);
        const planeMaterial = new THREE.MeshStandardMaterial({
            color: 0x88ff88,
            side: THREE.DoubleSide,
            wireframe: false,
        });
        const plane = new THREE.Mesh(planeGeometry, planeMaterial);
        plane.receiveShadow = true;
        plane.rotation.x = -Math.PI / 2;
        this.scene.add(plane);
    }

    loadModel(filepath: string) {
        const loader = new GLTFLoader();
        loader.load(filepath, (gltf) => {
            const model = gltf.scene;

            model.rotation.y = Math.PI / 4;
            
            this.scene.add(model);
        });
    }
}