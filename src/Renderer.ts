import * as THREE from 'three/webgpu';
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"

// interface ECSMesh extends THREE.Mesh {
//     ecsId: number;
// }
type RenderItem = {
    model: String;
    position_x: number;
    position_z: number;
    rotation_x: number;
    rotation_y: number;
};

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

    loadModel(filepath: string, position_x: number, position_z: number, rotation_x: number, rotation_y:number) {
        const loader = new GLTFLoader();
        loader.load(filepath, (gltf) => {
            const model = gltf.scene;

            model.position.x = position_x;
            model.position.z = position_z;

            model.rotation.x = THREE.MathUtils.degToRad(rotation_x)
            model.rotation.y = THREE.MathUtils.degToRad(rotation_y)
            
            this.scene.add(model);
        });
    }

    render(render_packet: Array<RenderItem>) {
        for (let i = 0; i < render_packet.length; i++) {
            const item = render_packet[i];

            const modelFilepath = `/models/${item.model}.gltf`;

            this.loadModel(modelFilepath, item.position_x, item.position_z, item.rotation_x, item.rotation_y);
        }
        

        this.renderer.render(this.scene, this.camera);
    }
}