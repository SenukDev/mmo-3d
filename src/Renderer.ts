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

        const camera_distance = 16;
        this.camera_position = new THREE.Vector3(0, 0, 0);
        this.camera_target = new THREE.Vector3(0, 0, 0);
        this.camera_offset = new THREE.Vector3(0, camera_distance, camera_distance * 2 );
        
        let aspect_ratio = window.innerWidth / window.innerHeight;
        this.frustumHeight = camera_distance;
        this.frustumWidth = this.frustumHeight * aspect_ratio;

        this.camera = new THREE.OrthographicCamera(-this.frustumWidth / 2, this.frustumWidth / 2, this.frustumHeight / 2, -this.frustumHeight / 2, 1, 60);

        this.camera.position.copy(this.camera_position).add(this.camera_offset);
        this.camera.lookAt(this.camera_position);

        this.renderer = new THREE.WebGPURenderer({ antialias: false });
        
        this.post_processing = this.postProcessing();
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
        this.addModels();
    }

    addLights() {
        const directional_light = new THREE.DirectionalLight(0xffffff, 0.5);
        directional_light.position.set(6, 8, 10);
        directional_light.castShadow = true;
        this.scene.add(directional_light);

        const ambient_light = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambient_light);

        // const pointLight = new THREE.PointLight(0xffffff, 10, 100); 
        // pointLight.position.set(1, 0.5, 0);
        // pointLight.castShadow = true;
        // this.scene.add(pointLight);

        const spot_light = new THREE.SpotLight( 0xff8800, 3, 100, Math.PI / 16, 0.2, 0 )
        spot_light.position.set( 10, 10, 10 )
        let target = new THREE.Object3D()
        spot_light.add( target )
        target.position.set( 0, 0, 0 )
        spot_light.castShadow = true
        this.scene.add( spot_light )
        spot_light.shadow.radius = 0
    }

    

    addGround() {
        //Ground Plane
        const planeGeometry = new THREE.PlaneGeometry(50, 50, 1, 1);
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

    addModels() {
        const loader = new GLTFLoader();
        loader.load(`/models/rock.gltf`, (gltf) => {
            const model = gltf.scene;
            model.scale.x = 4;
            model.scale.y = 4;
            model.scale.z = 4;
            model.rotation.y = -Math.PI / 5 * 5;
            model.position.x = -3.0;
            model.position.z = -3.0;
            
            model.traverse((child) => {
                if ((child as THREE.Mesh).isMesh) {
                    const mesh = child as THREE.Mesh;
                    mesh.material = new THREE.MeshStandardNodeMaterial({
                        color: 0xcccccc,
                        //flatShading: true
                    });

                    const vertexCount = mesh.geometry.attributes.position.count;
                    const objectIdArray = new Float32Array(vertexCount).fill(1.0);
                    mesh.geometry.setAttribute("edgeHighlight", new THREE.BufferAttribute(objectIdArray, 1))

                    mesh.castShadow = true;
                    //mesh.receiveShadow = true;
                }
            });
            this.scene.add(model);
        });
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
                        mesh.material = new THREE.MeshStandardNodeMaterial({
                            color: 0xff5555,
                            flatShading: true,
                        });
                        
                        const vertexCount = mesh.geometry.attributes.position.count;
                        const objectIdArray = new Float32Array(vertexCount).fill(1.0);
                        mesh.geometry.setAttribute("edgeHighlight", new THREE.BufferAttribute(objectIdArray, 1))
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
        
        this.adjustCamera();
        this.post_processing.render();
        // /this.renderer.render(this.scene, this.camera);
    }

    adjustCamera() {
        this.camera_position.lerp(this.camera_target, 0.15);

        this.camera.position.copy(this.camera_position).add(this.camera_offset);
        this.camera.lookAt(this.camera_position);
    }

    inputRightClick(mouse_x: number, mouse_y: number) {
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

    postProcessing() {
        const scenePass = TSL.pass(this.scene, this.camera);
        scenePass.setMRT(
            TSL.mrt({
                output: TSL.output,
                normal: TSL.normalView,
                diffuse: TSL.diffuseColor,
                objectId: TSL.attribute("edgeHighlight", "float")
            })
        );

        const pixel_scale = 4;
        const render_width = window.innerWidth / pixel_scale;
        const render_height = window.innerHeight / pixel_scale;

        const resolution = TSL.vec4(render_width, render_height, 1 / render_width, 1 / render_height);

        scenePass.renderTarget.texture.minFilter = THREE.NearestFilter;
        scenePass.renderTarget.texture.magFilter = THREE.NearestFilter;
        scenePass.renderTarget.texture.generateMipmaps = false;
        scenePass.renderTarget.texture.needsUpdate = true;
    
        const initialTextureNode = scenePass.getTextureNode("output");
        const depthTextureNode  = scenePass.getTextureNode('depth');
        const normalTextureNode = scenePass.getTextureNode("normal");
        const diffuseTextureNode = scenePass.getTextureNode("diffuse");
        const objectIdTextureNode = scenePass.getTextureNode("objectId");
        //const pixelateNodeTexture =  this.postProcessingPixelateTexture(initialTextureNode, resolution);
        const edgeDetectionNode = this.postProcessingPixelateEdgeDetection(initialTextureNode, resolution, depthTextureNode, normalTextureNode, diffuseTextureNode, objectIdTextureNode);
        const pixelateNode = this.postProcessingPixelateUV(edgeDetectionNode, resolution);

        return new THREE.PostProcessing(this.renderer, pixelateNode);
    }

    postProcessingPixelateTexture(
        textureNode: TSL.ShaderNodeObject<THREE.TextureNode>,
        resolution: any
    ) {
        const iuv = TSL.uv()
            .mul(resolution.xy)
            .floor()
            .add(TSL.vec2(0.5, 0.5))
            .mul(resolution.zw);

        return textureNode.sample(iuv);
    }

    postProcessingPixelateUV(
        sampler: (uv: any) => TSL.ShaderNodeObject<any>,
        resolution: any
    ) {
        const iuv = TSL.uv()
            .mul(resolution.xy)
            .floor()
            .add(TSL.vec2(0.5, 0.5))
            .mul(resolution.zw);

        return sampler(iuv);
    }

    postProcessingPixelateEdgeDetection(
        initialTextureNode: TSL.ShaderNodeObject<THREE.TextureNode>,
        resolution: any,
        depthTextureNode: TSL.ShaderNodeObject<THREE.TextureNode>,
        normalTextureNode: TSL.ShaderNodeObject<THREE.TextureNode>,
        diffuseTextureNode: TSL.ShaderNodeObject<THREE.TextureNode>,
        objectIdTextureNode: TSL.ShaderNodeObject<THREE.TextureNode>,
    ) {
        return (uv: any) => {
            const iuv = uv.mul(resolution.xy).floor().add(TSL.vec2(0.5, 0.5)).mul(resolution.zw);

            const getDepth = (x: number, y: number) =>
                depthTextureNode.sample(
                    iuv.add(TSL.vec2(x, y).mul(resolution.zw))
                ).r;

            const getNormal = (x: number, y: number) =>
                normalTextureNode
                    .sample(iuv.add(TSL.vec2(x, y).mul(resolution.zw)))
                    .rgb
                    .mul(2.0)
                    .sub(1.0);

            const getObjectId = () => objectIdTextureNode.sample(iuv).r;
            

            const neighborNormalEdgeIndicator = (x: number, y: number, depth: any, normal: any) => {
                const neighborDepth = getDepth(x, y);
                const depthDiff = neighborDepth.sub(depth);

                const normalEdgeBias = TSL.vec3(1.0, 1.0, 1.0);
                const normalDiff = normal.sub(getNormal(x, y)).dot(normalEdgeBias);

                const normalIndicator = normalDiff.smoothstep(-0.01, 0.01).clamp(0.0, 1.0);

                const depthIndicator = depthDiff.mul(0.25).add(0.0025).sign().clamp(0.0, 1.0);

                return normal.distance(getNormal(x, y))
                    .mul(depthIndicator)
                    .mul(normalIndicator);
            };

            const depth = getDepth(0, 0);
            const diff = getDepth(1, 0).sub(depth).clamp(0.0, 1.0)
                .add(getDepth(-1, 0).sub(depth).clamp(0.0, 1.0))
                .add(getDepth(0, 1).sub(depth).clamp(0.0, 1.0))
                .add(getDepth(0, -1).sub(depth).clamp(0.0, 1.0));

            const dei = diff
                .smoothstep(0.01, 0.02)
                .mul(2.0)
                .floor()
                .div(2.0);
            
            const normal = getNormal(0, 0);
            let nei = neighborNormalEdgeIndicator(0, -1, depth, normal)
                .add(neighborNormalEdgeIndicator(0, 1, depth, normal))
                .add(neighborNormalEdgeIndicator(-1, 0, depth, normal))
                .add(neighborNormalEdgeIndicator(1, 0, depth, normal));
            nei = nei.step(0.1);

            const depthEdgeCoefficient = TSL.float(0.3);
            const normalEdgeCoefficient = TSL.float(0.4);

            const coefficient = dei.greaterThan(TSL.float(0.0)).select(
                TSL.float(1.0).sub(depthEdgeCoefficient.mul(dei)),
                TSL.float(1.0).add(normalEdgeCoefficient.mul(nei))
            );

            const texel = initialTextureNode.sample(iuv);
            const tLum = diffuseTextureNode.sample(iuv).dot(TSL.vec4(0.2126,0.7152,0.0722,0.0));

            const finalColor = texel.mul(coefficient).mul(tLum);

            return getObjectId().greaterThan(TSL.float(0.5)).select(finalColor, texel);
        };
    }
}