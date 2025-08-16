import * as THREE from 'three/webgpu';
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"

type EntityId = String;

type RenderItem = {
    entity_id: EntityId;
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
    entity_map: Map<EntityId, any>;

    constructor() {
        this.entity_map = new Map<EntityId, any>(); 
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

    loadModel(filepath: string, entity_id: EntityId, position_x: number, position_z: number, rotation_x: number, rotation_y:number) {
        const loader = new GLTFLoader();
        loader.load(filepath, (gltf) => {
            const entity_model = this.entity_map.get(entity_id);

            if (!entity_model) {
                const model = gltf.scene;

                model.userData.entity_id = entity_id;
                model.position.x = position_x;
                model.position.z = position_z;

                model.rotation.x = rotation_x;
                model.rotation.y = rotation_y;

                this.entity_map.set(entity_id, model);
                
                this.scene.add(model);
            }
            else {
                entity_model.position.x = position_x;
                entity_model.position.z = position_z;

                entity_model.rotation.x = rotation_x;
                entity_model.rotation.y = rotation_y;
            }
        });
    }

    render(render_packet: Array<RenderItem>) {
        for (let i = 0; i < render_packet.length; i++) {
            const item = render_packet[i];

            const modelFilepath = `/models/${item.model}.gltf`;

            this.loadModel(modelFilepath, item.entity_id, item.position_x, item.position_z, item.rotation_x, item.rotation_y);
        }
        
        this.renderer.render(this.scene, this.camera);
    }

    input_right_click(mouse_x: number, mouse_y: number) {
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2(mouse_x, mouse_y);

        raycaster.setFromCamera(mouse, this.camera);

        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const p = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(plane, p)) {
            return { x: p.x, z: p.z };
        } else {
            return null;
        }
    }
}