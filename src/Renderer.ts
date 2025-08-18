import * as THREE from 'three/webgpu';
import * as TSL from 'three/tsl';
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"

type EntityId = String;

type RenderItem = {
    entity_id: EntityId;
    model: String;
    position_x: number;
    position_z: number;
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
    post_processing: THREE.PostProcessing;


    constructor() {
        this.entity_map = new Map<EntityId, any>(); 
        this.scene = new THREE.Scene();

        const camera_distance = 6;
        this.camera_position = new THREE.Vector3(0, 0, 0);
        this.camera_target = new THREE.Vector3(0, 0, 0);
        this.camera_offset = new THREE.Vector3(0, camera_distance, camera_distance );

        
        let aspect_ratio = window.innerWidth / window.innerHeight;
        this.frustumHeight = camera_distance;
        this.frustumWidth = this.frustumHeight * aspect_ratio;

        this.camera = new THREE.OrthographicCamera(-this.frustumWidth / 2, this.frustumWidth / 2, this.frustumHeight / 2, -this.frustumHeight / 2, 0.01, 2000);

        this.camera.position.copy(this.camera_position).add(this.camera_offset);
        this.camera.lookAt(this.camera_position);

        this.renderer = new THREE.WebGPURenderer({ antialias: false });

        const scenePass = TSL.pass(this.scene, this.camera);
        const colorNode = scenePass.getTextureNode("output");

        scenePass.renderTarget.texture.minFilter = THREE.NearestFilter;
        scenePass.renderTarget.texture.magFilter = THREE.NearestFilter;
        scenePass.renderTarget.texture.generateMipmaps = false;
        scenePass.renderTarget.texture.needsUpdate = true;

        const width = window.innerWidth / 6;
        const height = window.innerHeight / 6;
        const res = TSL.vec4(width, height, 1 / width, 1 / height);
        
        const iuv = TSL.uv()
            .mul(res.xy)
            .floor()
            .add(TSL.vec2(0.5, 0.5))
            .mul(res.zw);

        const outputNode = colorNode.sample(iuv);

        this.post_processing = new THREE.PostProcessing(this.renderer, outputNode);
        this.renderer.setRenderTarget(null);
    }

    async init() {
        await this.renderer.init();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);
        this.renderer.setPixelRatio(1);
        this.renderer.domElement.style.imageRendering = 'pixelated';

        this.renderer.shadowMap.enabled = true;

        this.addLights();
        this.addGround();
    }

    addLights() {
        const directional_light = new THREE.DirectionalLight(0xffffff, 1);
        directional_light.position.set(3, 5, 2);
        directional_light.castShadow = true;
        this.scene.add(directional_light);

        const ambient_light = new THREE.AmbientLight(0xffffff, 1);
        this.scene.add(ambient_light);

        const pointLight = new THREE.PointLight(0xffffff, 1, 100); 
        pointLight.position.set(1, 0.5, 0);
        this.scene.add(pointLight);
    }

    

    addGround() {
        const planeGeometry = new THREE.PlaneGeometry(25, 25, 10, 10);
        const planeMaterial = new THREE.MeshStandardNodeMaterial({
            color: 0x6ECE86,
            side: THREE.DoubleSide,
            wireframe: false,
        });
        const plane = new THREE.Mesh(planeGeometry, planeMaterial);
        plane.receiveShadow = true;
        plane.rotation.x = -Math.PI / 2;
        this.scene.add(plane);
    }

    updateModel(filepath: string, entity_id: EntityId, position_x: number, position_z: number, rotation_y:number) {
        const entity_model = this.entity_map.get(entity_id);
        if (!entity_model) {
            //Create Model
            const loader = new GLTFLoader();
            loader.load(filepath, (gltf) => {
                const model = gltf.scene;

                model.traverse((child) => {
                    if ((child as THREE.Mesh).isMesh) {
                        const mesh = child as THREE.Mesh;
                        mesh.castShadow = true;
                    }
                });

                model.userData.entity_id = entity_id;
                model.position.x = position_x;
                model.position.z = position_z;

                model.setRotationFromQuaternion
                const quaternionTarget = new THREE.Quaternion().setFromEuler(
                    new THREE.Euler(0, rotation_y, 0)
                );
                model.quaternion.rotateTowards(quaternionTarget, 0.5)

                this.entity_map.set(entity_id, model);
                
                this.scene.add(model);
            });
        }
        else {
            //Update Model
            entity_model.position.x = position_x;
            entity_model.position.z = position_z;
            
            entity_model.setRotationFromQuaternion
            const quaternionTarget = new THREE.Quaternion().setFromEuler(
                new THREE.Euler(0, rotation_y, 0)
            );
            entity_model.quaternion.rotateTowards(quaternionTarget, 0.5)

            this.camera_target.x = position_x
            this.camera_target.z = position_z
        }
    }

    render(render_packet: Array<RenderItem>) {
        for (let i = 0; i < render_packet.length; i++) {
            const item = render_packet[i];

            const modelFilepath = `/models/${item.model}.gltf`;

            this.updateModel(modelFilepath, item.entity_id, item.position_x, item.position_z, item.rotation_y);
        }

        this.adjust_camera()
        
        this.post_processing.render();
        //this.renderer.render(this.scene, this.camera);
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