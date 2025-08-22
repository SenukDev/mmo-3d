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
    terrain_displacement_scale: number;
    directional_light: THREE.DirectionalLight;
    terrain?: THREE.Mesh;


    constructor() {
        this.entity_map = new Map<EntityId, any>();
        this.scene = new THREE.Scene();

        const camera_distance = 20;
        this.camera_position = new THREE.Vector3(0, 0, 0);
        this.camera_target = new THREE.Vector3(0, 0, 0);
        this.camera_offset = new THREE.Vector3(0, camera_distance, camera_distance * 2 );
        
        let aspect_ratio = window.innerWidth / window.innerHeight;
        this.frustumHeight = camera_distance;
        this.frustumWidth = this.frustumHeight * aspect_ratio;

        this.camera = new THREE.OrthographicCamera(-this.frustumWidth / 2, this.frustumWidth / 2, this.frustumHeight / 2, -this.frustumHeight / 2, 1, 200);

        this.camera.position.copy(this.camera_position).add(this.camera_offset);
        this.camera.lookAt(this.camera_position);

        this.renderer = new THREE.WebGPURenderer({ antialias: false });
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.BasicShadowMap;
        
        this.post_processing = this.postProcessing();
        this.terrain_displacement_scale = 5;

        this.directional_light = this.addLights();
    }

    async init() {
        await this.renderer.init();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);
        this.renderer.setPixelRatio(1);
        this.renderer.domElement.style.imageRendering = 'pixelated';

        this.renderer.shadowMap.enabled = true;

        
        this.terrain = await this.addTerrain();
        this.addModels();
        this.addGrass(this.terrain, 16000, 0.25);
    }

    addLights() {
        const directional_light = new THREE.DirectionalLight(0xffffff, 1.0);
        directional_light.position.set(60, 80, 100);
        directional_light.castShadow = true;
        directional_light.shadow.mapSize.set(2048, 2048);
        directional_light.shadow.bias = -0.001;
        directional_light.shadow.camera as THREE.OrthographicCamera;
        directional_light.shadow.camera.left   = this.camera.left * 1.5;
        directional_light.shadow.camera.right  = this.camera.right * 1.5;
        directional_light.shadow.camera.top    = this.camera.top * 1.5;
        directional_light.shadow.camera.bottom = this.camera.bottom * 1.5;
        directional_light.shadow.camera.near   = this.camera.near;
        directional_light.shadow.camera.far    = this.camera.far;

        directional_light.target.position.copy(this.camera_position);
        this.scene.add(directional_light.target);

        this.scene.add(directional_light);

        const ambient_light = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambient_light);
        
        return directional_light;
        // const spot_light = new THREE.SpotLight(0xff8800, 10, 100, Math.PI / 16, 0.2, 0);
        // spot_light.position.set( 10, 10, 10 );
        // let target = new THREE.Object3D();
        // target.position.set(-3, 0, 5);
        // spot_light.add(target);
        // spot_light.castShadow = true
        // spot_light.shadow.bias = -0.001;
        // this.scene.add(spot_light);
        // spot_light.shadow.radius = 0;

        // const pointLight = new THREE.PointLight(0xffffff, 4, 100); 
        // pointLight.position.set(1, 0.5, 0);
        // pointLight.shadow.bias = -0.001;
        // pointLight.castShadow = true;
        // this.scene.add(pointLight);
    }

    

    async addTerrain(): Promise<THREE.Mesh> {
        return new Promise((resolve) => {
            //Terrain Plane
            const planeSizeWidth = 100;
            const planeSizeHeight = 100;
            const planeSegmentWidth = 100;
            const planeSegmentHeight = 100;
            

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
                plane.rotation.x = -Math.PI / 2;
                
                plane.updateMatrixWorld(true);

                setMeshAttributes(plane);
                this.scene.add(plane);

                const minY = TSL.float(0);
                const maxY = TSL.float(this.terrain_displacement_scale);

                const heightFactor = TSL.positionWorld.y.sub(minY).div(maxY.sub(minY)).clamp(0.0, 1.0);
                const brightness = heightFactor.mul(0.8);
                const baseColor = TSL.vec3(0.20, 1.0, 0.30);

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
        grassGeometry.translate(0, 0.25, 0);

        const grassMaterial = new THREE.MeshStandardNodeMaterial({
            alphaTest: 0.1,
            side: THREE.DoubleSide,
        });

        const grassPoints = sampleMeshPoisson(mesh, numSamples, minDist);
        let count = grassPoints.length;

        const instancedGrassMesh = new THREE.InstancedMesh(
            grassGeometry,
            grassMaterial,
            count
        );

        const dummy = new THREE.Object3D();

        grassPoints.forEach((p, i) => {
            dummy.position.copy(p);
            dummy.updateMatrix();
            instancedGrassMesh.setMatrixAt(i, dummy.matrix);
        });

        
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


        const hash = TSL.fract(TSL.float(TSL.instanceIndex).mul(78.233)).mul(43758.5453).mul(2).sub(1);

        const swayWave = TSL.sin(TSL.time.mul(0.1).add(hash));
        const windBias = TSL.float(1.0).sub(windMap).mul(0.05);
        const sway = swayWave.mul(0.1).sub(windBias)

        grassMaterial.positionNode = TSL.positionLocal.add(
            TSL.vec3(sway, 0.0, 0.0)
        );
        
        const minY = TSL.float(0);
        const maxY = TSL.float(this.terrain_displacement_scale + 0.5);
        const heightFactor = TSL.positionWorld.y.sub(minY).div(maxY.sub(minY)).clamp(0.0, 1.0);
        const brightness = heightFactor.mul(0.8);

        grassMaterial.colorNode = TSL.vec3(0.2, 1.0, 0.3).mul(brightness).mul(windMap.mul(0.1).sub(1).abs());
        
        instancedGrassMesh.receiveShadow = true;
        setMeshAttributes(instancedGrassMesh);
        this.scene.add(instancedGrassMesh);
    }

    addModels() {
        const loader = new GLTFLoader();
        loader.load(`/models/rock.gltf`, (gltf) => {
            const model = gltf.scene;
            model.scale.x = 5;
            model.scale.y = 5;
            model.scale.z = 5;
            model.rotation.y = -Math.PI / 5 * 5;
            model.position.x = -3.0;
            model.position.z = 5.0;
            
            if (this.terrain) {
                const raycaster = new THREE.Raycaster();
                const down = new THREE.Vector3(0, -1, 0);
                const origin = new THREE.Vector3(model.position.x, 100, model.position.z);
                raycaster.set(origin, down);
                const intersects = raycaster.intersectObject(this.terrain);

                if (intersects.length > 0) {
                    model.position.y = intersects[0].point.y;
                }
            }
            
            model.traverse((child) => {
                if ((child as THREE.Mesh).isMesh) {
                    const mesh = child as THREE.Mesh;
                    mesh.material = new THREE.MeshStandardNodeMaterial({
                        color: 0xcccccc,
                        flatShading: true
                    });
                    setMeshAttributes(mesh, {applyEdgeHighlight: true});

                    mesh.castShadow = true;
                    mesh.receiveShadow = true;
                }
            });
            //this.scene.add(model);
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
                        mesh.receiveShadow = true;
                        mesh.material = new THREE.MeshStandardNodeMaterial({
                            color: 0xff5555,
                            flatShading: true,
                        });
                        
                        setMeshAttributes(mesh, {applyEdgeHighlight: true});
                    }
                });

                model.userData.entity_id = entity_id;
                model.position.x = position_x;
                model.position.z = position_z;

                model.scale.x = 1.5;
                model.scale.y = 1.5;
                model.scale.z = 1.5;

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

                model.updateMatrixWorld(true);

                this.entity_map.set(entity_id, model);
                
                this.scene.add(model);

                this.camera_target.x = entity_model.position.x;
                this.camera_target.y = entity_model.position.y;
                this.camera_target.z = entity_model.position.z;
            });
        }
        else {
            //Update Model
            entity_model.position.x = position_x;
            entity_model.position.z = position_z;
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
            this.camera_target.y = entity_model.position.y;
            this.camera_target.z = entity_model.position.z;
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
        //this.renderer.render(this.scene, this.camera);
    }

    adjustCamera() {
        this.camera_position.lerp(this.camera_target, 0.15);

        this.camera.position.copy(this.camera_position).add(this.camera_offset);
        this.camera.lookAt(this.camera_position);

        this.directional_light.position.copy(this.camera.position).add(new THREE.Vector3(60, 80, 100));
        this.directional_light.target.position.copy(this.camera_position);
    }

    inputRightClick(mouse_x: number, mouse_y: number) {
        if (this.terrain) {
            const raycaster = new THREE.Raycaster();
            const mouse = new THREE.Vector2(mouse_x, mouse_y);

            raycaster.setFromCamera(mouse, this.camera);

            const intersects = raycaster.intersectObject(this.terrain);
            if (intersects.length > 0) {
                const p = intersects[0].point;
                return { x: p.x, z: p.z };
            }
            else {
                return null;
            }
        }
        else {
            return null;
        }
    }

    postProcessing() {
        const scenePass = TSL.pass(this.scene, this.camera);
        scenePass.setMRT(
            TSL.mrt({
                output: TSL.output,
                normal: TSL.normalView,
                //diffuse: TSL.diffuseColor,
                shaderFlags: TSL.attribute("shaderFlags", "float")
            })
        );

        const pixel_scale = 5;
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
        //const diffuseTextureNode = scenePass.getTextureNode("diffuse");
        const shaderFlagsTextureNode = scenePass.getTextureNode("shaderFlags");
        const edgeHighlightSampler = this.postProcessingEdgeHighlight(initialTextureNode, shaderFlagsTextureNode, SHADER_FLAG_MAP.applyEdgeHighlight + 1, resolution, depthTextureNode, normalTextureNode);//, diffuseTextureNode);
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
        //diffuseTextureNode: TSL.ShaderNodeObject<THREE.TextureNode>,
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

            const depthEdgeCoefficient = TSL.float(0.3);
            const normalEdgeCoefficient = TSL.float(0.4);

            const coefficient = dei.greaterThan(TSL.float(0.0)).select(
                TSL.float(1.0).sub(depthEdgeCoefficient.mul(dei)),
                TSL.float(1.0).add(normalEdgeCoefficient.mul(nei))
            );
            
            const texel = initialTextureNode.sample(iuv);
            //const tLum = diffuseTextureNode.sample(iuv).dot(TSL.vec4(0.2126,0.7152,0.0722,0.0));

            const finalColor = texel.mul(coefficient);//TSL.vec3(1.0, 1.0, 1.0)//texel.mul(coefficient);//.mul(tLum);

            const shaderFlags = shaderFlagTextureNode.sample(iuv).r.mul(255.0).round().toInt();
            const hasFlag = (mask: number) =>
                shaderFlags.bitAnd(TSL.int(mask)).notEqual(TSL.int(0));
            
            const applyShader = hasFlag(shaderFlagIndex);

            return applyShader.select(finalColor, texel);
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