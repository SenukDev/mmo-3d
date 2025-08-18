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
    camera_position: THREE.Vector3;
    camera_target: THREE.Vector3;
    camera_offset: THREE.Vector3;
    camera: THREE.OrthographicCamera;
    renderer: THREE.WebGPURenderer;
    entity_map: Map<EntityId, any>;
    frustumHeight: number;
    frustumWidth: number;
    


    constructor() {
        this.entity_map = new Map<EntityId, any>(); 
        this.scene = new THREE.Scene();

        this.camera_position = new THREE.Vector3(0, 0, 0);
        this.camera_target = new THREE.Vector3(0, 0, 0);
        this.camera_offset = new THREE.Vector3(0, 20, 30);

        this.frustumHeight = 20;
        let aspect = window.innerWidth / window.innerHeight;
        this.frustumWidth = this.frustumHeight * aspect;

        this.camera = new THREE.OrthographicCamera(-this.frustumWidth / 2, this.frustumWidth / 2, this.frustumHeight / 2, -this.frustumHeight / 2, 0.01, 2000);

        this.camera.position.copy(this.camera_position).add(this.camera_offset);
        this.camera.lookAt(this.camera_position);

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

                this.camera_target.x = position_x
                this.camera_target.z = position_z
            }
        });
    }

    render(render_packet: Array<RenderItem>) {
        for (let i = 0; i < render_packet.length; i++) {
            const item = render_packet[i];

            const modelFilepath = `/models/${item.model}.gltf`;

            this.loadModel(modelFilepath, item.entity_id, item.position_x, item.position_z, item.rotation_x, item.rotation_y);
        }

        this.adjust_camera()
        
        
        this.renderer.render(this.scene, this.camera);
    }

    adjust_camera() {
        this.camera_position.lerp(this.camera_target, 0.15);

        this.camera.position.copy(this.camera_position).add(this.camera_offset);
        this.camera.lookAt(this.camera_position);
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