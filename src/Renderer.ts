import * as THREE from 'three/webgpu';
import * as TSL from 'three/tsl';
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { OrbitControls } from 'three/examples/jsm/Addons.js';

type EntityId = String;

type RenderItem = {
    entity_id: EntityId;
    model: String;
    position_x: number;
    position_z: number;
    rotation_y: number;
    animation_index: number;
};

export class Renderer {
    scene: THREE.Scene;
    camera_position: THREE.Vector3;
    camera_target: THREE.Vector3;
    camera_offset: THREE.Vector3;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGPURenderer;
    entity_map: Map<EntityId, any>;
    frustumHeight: number;
    frustumWidth: number;
    post_processing: THREE.PostProcessing;
    terrain_displacement_scale: number;
    directional_light: THREE.DirectionalLight;
    terrain?: THREE.Mesh;
    animation_map: Map<EntityId, any>;
    controls: OrbitControls;


    constructor() {
        this.entity_map = new Map<EntityId, any>();
        this.animation_map = new Map<EntityId, any>();
        this.scene = new THREE.Scene();

        const camera_distance = 12;
        this.camera_position = new THREE.Vector3(0, 0, 0);
        this.camera_target = new THREE.Vector3(0, 0, 0);
        this.camera_offset = new THREE.Vector3(0, camera_distance, camera_distance);
        
        let aspect_ratio = window.innerWidth / window.innerHeight;
        this.frustumHeight = camera_distance;
        this.frustumWidth = this.frustumHeight * aspect_ratio;

        this.camera = new THREE.PerspectiveCamera(60, aspect_ratio, 1, 200)

        this.camera.position.copy(this.camera_position).add(this.camera_offset);
        this.camera.lookAt(this.camera_position);

        this.renderer = new THREE.WebGPURenderer({ antialias: false });
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.BasicShadowMap;
        
        this.post_processing = this.postProcessing();
        this.terrain_displacement_scale = 7;

        this.directional_light = this.addLights();

        this.controls = new OrbitControls( this.camera, this.renderer.domElement );
        this.controls.mouseButtons = { MIDDLE: THREE.MOUSE.ROTATE };
        this.controls.enablePan = false;
        this.controls.maxDistance = 20.0;
        this.controls.minDistance = 5.0;
        this.controls.minPolarAngle = Math.PI / 8;
        this.controls.maxPolarAngle = Math.PI / 2 - THREE.MathUtils.degToRad(15);
    }

    async init() {
        await this.renderer.init();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);
        this.renderer.setPixelRatio(1);
        this.renderer.domElement.style.imageRendering = 'pixelated';

        this.renderer.shadowMap.enabled = true;

        
        this.terrain = await this.addTerrain();
        this.addGrass(this.terrain, 500000, 0.25);
    }

    addLights() {
        const directional_light = new THREE.DirectionalLight(0xffffff, 1.0);
        directional_light.position.set(60, 80, 100);
        directional_light.castShadow = true;
        directional_light.shadow.mapSize.set(2048, 2048);
        directional_light.shadow.bias = -0.001;

        directional_light.target.position.copy(this.camera_position);
        this.scene.add(directional_light.target);

        this.scene.add(directional_light);

        const ambient_light = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambient_light);

        return directional_light;
    }

    async addTerrain(): Promise<THREE.Mesh> {
        return new Promise((resolve) => {
            //Terrain Plane
            const planeSizeWidth = 400;
            const planeSizeHeight = 400;
            const planeSegmentWidth = 50;
            const planeSegmentHeight = 50;
            

            const loader = new THREE.TextureLoader();

            loader.load("textures/height_map.png", (height_map_texture) => {
                const planeGeometry = new THREE.PlaneGeometry(planeSizeWidth, planeSizeHeight, planeSegmentWidth, planeSegmentHeight);
                const geom = planeGeometry as THREE.BufferGeometry;
                const pos = geom.getAttribute('position') as THREE.BufferAttribute;
                
                const img = height_map_texture.image as HTMLImageElement | HTMLCanvasElement | ImageBitmap;
                const width = (img as any).width;
                const height = (img as any).height;

                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d")!;
                ctx.drawImage(img as any, 0, 0);
                const { data } = ctx.getImageData(0, 0, width, height);
                for (let i = 0; i < pos.count; i++) {
                    const x = pos.getX(i);
                    const y = pos.getY(i);

                    const u = (x / planeSizeWidth + 0.5) * (width - 1);
                    const v = (y / planeSizeHeight + 0.5) * (height - 1);

                    const ix = Math.max(0, Math.min(width  - 1, Math.floor(u)));
                    const iy = Math.max(0, Math.min(height - 1, Math.floor(v)));
                    const idx = (iy * width + ix) * 4;

                    const h = data[idx] / 255.0;
                    pos.setZ(i, h * this.terrain_displacement_scale);
                }
                
                pos.needsUpdate = true;
                geom.computeVertexNormals();

                const planeMaterial = new THREE.MeshStandardNodeMaterial();

                const plane = new THREE.Mesh(planeGeometry, planeMaterial);
                plane.receiveShadow = true;
                plane.userData.terrain = true;
                plane.rotation.x = -Math.PI / 2;
                
                plane.updateMatrixWorld(true);
                
                setMeshAttributes(plane);
                this.scene.add(plane);
                

                const heightFactor = TSL.positionWorld.y;
                const brightness = heightFactor.mul(0.15);
                const baseColor = TSL.vec3(0.2, 1.0, 0.3);

                planeMaterial.colorNode = baseColor.mul(brightness);
                resolve(plane);
            });
        });
    }

    addGrass(mesh: THREE.Mesh,
        numSamples: number,
        minDist: number
    ) {
        const grassGeometry = new THREE.PlaneGeometry(1.0, 1.0);
        grassGeometry.translate(0, 0.5, 0);

        const grassMaterial = new THREE.MeshStandardNodeMaterial({
            alphaTest: 0.1,
        });

        const grassPoints = sampleMeshRandom(mesh, numSamples)//sampleMeshPoisson(mesh, numSamples, minDist);
        let count = grassPoints.length;

        const instancedGrassMesh = new THREE.InstancedMesh(
            grassGeometry,
            grassMaterial,
            count
        );

        const dummy = new THREE.Object3D();

        grassPoints.forEach((p, i) => {
            p.y += 0.25
            dummy.position.copy(p);
            dummy.updateMatrix();
            instancedGrassMesh.setMatrixAt(i, dummy.matrix);
        });

        const view = TSL.cameraViewMatrix;

        const camRight = TSL.vec3(view[0].x, view[1].x, view[2].x);
        const camUp    = TSL.vec3(view[0].y, view[1].y, view[2].y);

        const rightN = TSL.normalize(camRight);
        const upN    = TSL.normalize(camUp);

        const local = TSL.positionLocal.xy;
        const billboardOffset = rightN.mul(local.x).add(upN.mul(local.y));
        grassMaterial.positionNode = billboardOffset;
                
        const scale = 0.3;
        const distortion = 0.8;
        const pos = TSL.positionWorld.xz.mul(scale);

        const windDir = TSL.vec2(0.5, 1.0).normalize();

        const waveSpeed = 0.8;
        const waveScale = 0.3;
        const animatedWavePos = pos.mul(waveScale).add(windDir.mul(TSL.time.mul(waveSpeed)));

        const distortedWave = animatedWavePos.add(
            TSL.mx_noise_float(animatedWavePos.mul(2.0)).mul(distortion)
        );

        let wave = TSL.mx_noise_float(distortedWave);
        wave = wave.mul(wave).add(wave).clamp(0.0, 1.0);

        const noiseSpeed = 1.5;
        const noiseScale = 2.0;
        const animatedNoisePos = pos.mul(noiseScale).add(windDir.mul(TSL.time.mul(noiseSpeed)));

        let turbulence = TSL.mx_noise_float(animatedNoisePos);
        turbulence = turbulence.mul(0.5).clamp(0.0, 1.0);

        const windMap = wave.add(turbulence).clamp(0.0, 1.0);
        
        // const minY = TSL.float(0);
        // const maxY = TSL.float(this.terrain_displacement_scale);
        const heightFactor = TSL.positionWorld.y.sub(1.0);//.sub(minY).div(maxY.sub(minY)).clamp(0.0, 1.0);
        const brightness = heightFactor.mul(0.05);

        grassMaterial.colorNode = TSL.vec3(0.2, 1.0, 0.3).mul(brightness).mul(windMap.mul(0.1).sub(1).abs());
        grassMaterial.lights = false;
        instancedGrassMesh.receiveShadow = true;
        setMeshAttributes(instancedGrassMesh);
        this.scene.add(instancedGrassMesh);
    }

    updateModel(item_model: string, entity_id: EntityId, position_x: number, position_z: number, rotation_y:number, animation_index:number) {
        const entity_model = this.entity_map.get(entity_id);
        if (!entity_model) {

            const filepath = `/models/${item_model}.gltf`;
            //Create Model
            const loader = new GLTFLoader();
            loader.load(filepath, (gltf) => {
                const model = gltf.scene;
                
                let color = 0xffffff;
                let scale = 1;
                let node = false;
                switch(item_model) {
                    case "player":
                        color = 0xff5555
                        break;
                    case "rock":
                        color = 0xcccccc
                        scale = 5;
                        node = true;
                        break;
                }

                model.traverse((child) => {
                    if ((child as THREE.Mesh).isMesh) {
                        const mesh = child as THREE.Mesh;
                        mesh.castShadow = true;
                        mesh.receiveShadow = true;
                        
                        mesh.material = new THREE.MeshStandardNodeMaterial({
                            color: color,
                        });

                        if (node == true) {
                            mesh.userData.entity_id = entity_id;
                        }
                        
                        setMeshAttributes(mesh); //, {applyEdgeHighlight: true}
                    }
                });

                model.userData.entity_id = entity_id;
                model.position.x = position_x;
                model.position.z = position_z;
                model.rotation.y = rotation_y;

                model.scale.x = scale;
                model.scale.y = scale;
                model.scale.z = scale;


                if (this.terrain) {
                    const raycaster = new THREE.Raycaster();
                    const down = new THREE.Vector3(0, -1, 0);
                    const origin = new THREE.Vector3(position_x, 100, position_z);
                    raycaster.set(origin, down);
                    const intersects = raycaster.intersectObject(this.terrain);

                    if (intersects.length > 0) {
                        model.position.y = intersects[0].point.y;
                    } 
                }

                model.setRotationFromQuaternion
                const quaternionTarget = new THREE.Quaternion().setFromEuler(
                    new THREE.Euler(0, rotation_y, 0)
                );
                model.quaternion.rotateTowards(quaternionTarget, 0.5)
                
                this.entity_map.set(entity_id, model);
                
                this.scene.add(model);

                if (animation_index != -1) {
                    const mixer = new THREE.AnimationMixer(model);
                    const action = mixer.clipAction(gltf.animations[animation_index]);
                    action.reset().play();
                    
                    const animation_object = {animation_index: animation_index, mixer: mixer, clips: gltf.animations}
                    this.animation_map.set(entity_id, animation_object);
                }
                
                
                if (item_model == "player") {
                    this.camera_target.x = model.position.x;
                    this.camera_target.y = model.position.y + 1.0;
                    this.camera_target.z = model.position.z;
                }
                
            });
        }
        else {
            //Update Model
            entity_model.position.x = position_x;
            entity_model.position.z = position_z;

            if (animation_index != -1) {
                const animation = this.animation_map.get(entity_id);
                if (animation.animation_index != animation_index) {
                    animation.animation_index = animation_index;
                    animation.mixer.stopAllAction();
                    animation.mixer.clipAction(animation.clips[animation_index]).reset().play();
                }
            }
            
            
            if (this.terrain) {
                const raycaster = new THREE.Raycaster();
                const down = new THREE.Vector3(0, -1, 0);
                const origin = new THREE.Vector3(position_x, 100, position_z);
                raycaster.set(origin, down);
                const intersects = raycaster.intersectObject(this.terrain);

                if (intersects.length > 0) {
                    entity_model.position.y = intersects[0].point.y;
                }
            }
            
            entity_model.setRotationFromQuaternion
            const quaternionTarget = new THREE.Quaternion().setFromEuler(
                new THREE.Euler(0, rotation_y, 0)
            );
            entity_model.quaternion.rotateTowards(quaternionTarget, 0.5)
            this.camera_target.x = entity_model.position.x;
            this.camera_target.y = entity_model.position.y + 1.0;
            this.camera_target.z = entity_model.position.z;

            entity_model.updateMatrixWorld(true);
        }
    }

    render(render_packet: Array<RenderItem>) {
        for (let i = 0; i < render_packet.length; i++) {
            const item = render_packet[i];
            this.updateModel(item.model.toString(), item.entity_id, item.position_x, item.position_z, item.rotation_y, item.animation_index);
        }

        for (const animation of this.animation_map.values()) {
            animation.mixer.update(1/30);
        }

        this.adjustCamera();
        this.post_processing.render();
        //this.renderer.render(this.scene, this.camera);
    }

    adjustCamera() {
        const prevPos = this.camera_position.clone();
        this.camera_position.lerp(this.camera_target, 0.15);
        const camera_offset = prevPos.sub(this.camera_position);

        this.camera.position.sub(camera_offset);
        this.controls.target = this.camera_position;
        
        this.controls.update();

        this.directional_light.position.copy(this.camera.position).add(new THREE.Vector3(100, 80, 20));
        this.directional_light.target.position.copy(this.camera_position);
    }

    inputLeftClick(mouse_x: number, mouse_y: number) {
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2(mouse_x, mouse_y);

        raycaster.setFromCamera(mouse, this.camera);

        const intersects = raycaster.intersectObjects(this.scene.children, true);
        for(let i = 0; i < intersects.length; i ++) {
            const obj = intersects[i].object;
                if (obj.userData && obj.userData.entity_id !== undefined) {
                return {
                    outcome: "node",
                    entity_id: obj.userData.entity_id
                };
            }
            else if (obj.userData && obj.userData.terrain == true) {1
                const p = intersects[i].point;
                return {
                    outcome: "move",
                    x: p.x,
                    z: p.z
                };
            }
        }
        return null;
    }

    postProcessing() {
        const scenePass = TSL.pass(this.scene, this.camera);
        scenePass.setMRT(
            TSL.mrt({
                output: TSL.output,
                normal: TSL.normalView,
                shaderFlags: TSL.attribute("shaderFlags", "float")
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
        const shaderFlagsTextureNode = scenePass.getTextureNode("shaderFlags");
        const edgeHighlightSampler = this.postProcessingEdgeHighlight(initialTextureNode, shaderFlagsTextureNode, SHADER_FLAG_MAP.applyEdgeHighlight + 1, resolution, depthTextureNode, normalTextureNode);
        const pixelateNode = this.postProcessingSampleUV(edgeHighlightSampler);

        return new THREE.PostProcessing(this.renderer, pixelateNode);
    }

    postProcessingSampleUV(
        sampler: (uv: any) => TSL.ShaderNodeObject<any>,
    ) {
        return sampler(TSL.uv());
    }

    postProcessingEdgeHighlight(
        initialTextureNode: TSL.ShaderNodeObject<THREE.TextureNode>,
        shaderFlagTextureNode: TSL.ShaderNodeObject<THREE.TextureNode>,
        shaderFlagIndex: number,
        resolution: any,
        depthTextureNode: TSL.ShaderNodeObject<THREE.TextureNode>,
        normalTextureNode: TSL.ShaderNodeObject<THREE.TextureNode>,
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

            const neighborNormalEdgeIndicator = (x: number, y: number, depth: any, normal: any) => {
                const neighborDepth = getDepth(x, y);
                const depthDiff = neighborDepth.sub(depth);

                const normalEdgeBias = TSL.vec3(1.0, 1.0, 1.0);
                const normalDiff = normal.sub(getNormal(x, y)).dot(normalEdgeBias);

                const normalIndicator = normalDiff.smoothstep(-0.001, 0.001).clamp(0.0, 1.0);

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
                .smoothstep(0.001, 0.005) 
                .mul(2.0)
                .floor()
                .div(2.0);
            
            const normal = getNormal(0, 0);
            let nei = neighborNormalEdgeIndicator(0, -1, depth, normal)
                .add(neighborNormalEdgeIndicator(0, 1, depth, normal))
                .add(neighborNormalEdgeIndicator(-1, 0, depth, normal))
                .add(neighborNormalEdgeIndicator(1, 0, depth, normal));
            nei = nei.step(0.1);

            const depthEdgeCoefficient = TSL.float(0.5);
            //const normalEdgeCoefficient = TSL.float(0.4);
            // const coefficient = dei.greaterThan(TSL.float(0.0)).select(
            //     TSL.float(1.0).sub(depthEdgeCoefficient.mul(dei)),
            //     TSL.float(1.0).add(normalEdgeCoefficient.mul(nei))
            // );
            
            const coefficient = TSL.float(1.0).add(depthEdgeCoefficient.mul(dei))
            

            const initial = initialTextureNode.sample(TSL.uv());

            const texel = initialTextureNode.sample(iuv);
            const finalColor = texel.mul(coefficient);

            const shaderFlags = shaderFlagTextureNode.sample(iuv).r.mul(255.0).round().toInt();
            const hasFlag = (mask: number) =>
                shaderFlags.bitAnd(TSL.int(mask)).notEqual(TSL.int(0));
            
            const applyShader = hasFlag(shaderFlagIndex);

            return applyShader.select(finalColor, initial);
        };
    }
}

function sampleMeshPoisson(
    mesh: THREE.Mesh,
    numSamples: number = 1000,
    minDist: number = 0.5
): THREE.Vector3[] {
    const geom = mesh.geometry.clone().toNonIndexed() as THREE.BufferGeometry;
    geom.applyMatrix4(mesh.matrixWorld);
    geom.computeVertexNormals();

    const posAttr = geom.getAttribute("position") as THREE.BufferAttribute;
    const pos = posAttr.array as Float32Array;

    type TriangleData = { a: THREE.Vector3; b: THREE.Vector3; c: THREE.Vector3; area: number };
    const triangles: TriangleData[] = [];

    for (let i = 0; i < pos.length; i += 9) {
        const a = new THREE.Vector3(pos[i], pos[i + 1], pos[i + 2]);
        const b = new THREE.Vector3(pos[i + 3], pos[i + 4], pos[i + 5]);
        const c = new THREE.Vector3(pos[i + 6], pos[i + 7], pos[i + 8]);
        const area = new THREE.Triangle(a, b, c).getArea();
        triangles.push({ a, b, c, area });
    }

    // build CDF (areas sum to 1)
    const totalArea = triangles.reduce((acc, t) => acc + t.area, 0);
    const cdf: number[] = [];
    let acc = 0;
    for (const t of triangles) {
        acc += t.area / totalArea;
        cdf.push(acc);
    }

    const samples: THREE.Vector3[] = [];
    const minDistSq = minDist * minDist;

    function tooClose(p: THREE.Vector3): boolean {
        for (const q of samples) {
            if (p.distanceToSquared(q) < minDistSq) return true;
        }
        return false;
    }

    for (let i = 0; i < numSamples * 5 && samples.length < numSamples; i++) {
        // pick triangle by area
        const r = Math.random();
        let idx = cdf.findIndex((c) => c > r);
        if (idx < 0) idx = cdf.length - 1;
        const { a, b, c } = triangles[idx];

        // barycentric random point
        let u = Math.random();
        let v = Math.random();
        if (u + v > 1) {
            u = 1 - u;
            v = 1 - v;
        }
        const w = 1 - u - v;

        const p = new THREE.Vector3()
            .addScaledVector(a, u)
            .addScaledVector(b, v)
            .addScaledVector(c, w);

        if (!tooClose(p)) samples.push(p);
    }

    return samples;
}

function sampleMeshRandom(
    mesh: THREE.Mesh,
    numSamples: number = 1000,
): THREE.Vector3[] {
    const geom = mesh.geometry.clone().toNonIndexed() as THREE.BufferGeometry;
    geom.applyMatrix4(mesh.matrixWorld);
    geom.computeVertexNormals();

    const posAttr = geom.getAttribute("position") as THREE.BufferAttribute;
    const pos = posAttr.array as Float32Array;

    type TriangleData = { a: THREE.Vector3; b: THREE.Vector3; c: THREE.Vector3; area: number };
    const triangles: TriangleData[] = [];

    for (let i = 0; i < pos.length; i += 9) {
        const a = new THREE.Vector3(pos[i], pos[i + 1], pos[i + 2]);
        const b = new THREE.Vector3(pos[i + 3], pos[i + 4], pos[i + 5]);
        const c = new THREE.Vector3(pos[i + 6], pos[i + 7], pos[i + 8]);
        const area = new THREE.Triangle(a, b, c).getArea();
        triangles.push({ a, b, c, area });
    }

    // build CDF (areas sum to 1)
    const totalArea = triangles.reduce((acc, t) => acc + t.area, 0);
    const cdf: number[] = [];
    let acc = 0;
    for (const t of triangles) {
        acc += t.area / totalArea;
        cdf.push(acc);
    }

    const samples: THREE.Vector3[] = [];

    for (let i = 0; i < numSamples; i++) {
        // pick triangle by area
        const r = Math.random();
        let idx = cdf.findIndex((c) => c > r);
        if (idx < 0) idx = cdf.length - 1;
        const { a, b, c } = triangles[idx];

        // barycentric random point
        let u = Math.random();
        let v = Math.random();
        if (u + v > 1) {
            u = 1 - u;
            v = 1 - v;
        }
        const w = 1 - u - v;

        const p = new THREE.Vector3()
            .addScaledVector(a, u)
            .addScaledVector(b, v)
            .addScaledVector(c, w);

        samples.push(p);
    }

    return samples;
}

const SHADER_FLAG_MAP = {
    applyEdgeHighlight: 0,
} as const;

export type ShaderFlagName = keyof typeof SHADER_FLAG_MAP;

export function setMeshAttributes(
    mesh: THREE.Mesh,
    overrides: Partial<Record<ShaderFlagName, boolean>> = {}
) {
    const vertexCount = mesh.geometry.attributes.position.count;

    let flagsValue = 0;

    for (const [name, bit] of Object.entries(SHADER_FLAG_MAP)) {
        const enabled = overrides[name as ShaderFlagName] ?? false;
        if (enabled) {
            flagsValue |= (1 << bit);
        }
    }

    const array = new Float32Array(vertexCount).fill(flagsValue / 255);

    mesh.geometry.setAttribute(
        "shaderFlags",
        new THREE.BufferAttribute(array, 1, false)
    );

    //console.log("Packed Flags:", flagsValue.toString(2).padStart(32, "0"));
}