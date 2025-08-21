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
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.BasicShadowMap;
        
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
        directional_light.shadow.mapSize.set(2048, 2048);
        directional_light.shadow.bias = -0.001;
        this.scene.add(directional_light);

        const ambient_light = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambient_light);



        const spot_light = new THREE.SpotLight(0xff8800, 1, 100, Math.PI / 16, 0.2, 0);
        spot_light.position.set( 10, 10, 10 );
        let target = new THREE.Object3D();
        spot_light.add(target);
        target.position.set(0, 0, 0);
        spot_light.castShadow = true
        spot_light.shadow.bias = -0.001;
        this.scene.add(spot_light);
        spot_light.shadow.radius = 0;

        // const pointLight = new THREE.PointLight(0xffffff, 4, 100); 
        // pointLight.position.set(1, 0.5, 0);
        // pointLight.shadow.bias = -0.001;
        // pointLight.castShadow = true;
        // this.scene.add(pointLight);
    }

    

    addGround() {
        //Ground Plane
        const planeGeometry = new THREE.PlaneGeometry(25, 25, 1, 1);
        const planeMaterial = new THREE.MeshStandardNodeMaterial({
            color: 0x6ECE86,
            //side: THREE.DoubleSide,
            wireframe: false,
        });
        const plane = new THREE.Mesh(planeGeometry, planeMaterial);
        plane.receiveShadow = true;
        plane.rotation.x = -Math.PI / 2;
        plane.updateMatrixWorld(true);
        setMeshAttributes(plane);
        this.scene.add(plane);
        
        
        //Grass
        const grassGeometry = new THREE.PlaneGeometry(1.0, 1.0);
        const grassMaterial = new THREE.MeshStandardMaterial({
            color: 0x228b22,
            side: THREE.DoubleSide
        });
        //Move Origin
        grassGeometry.translate(0, 0.5, 0);

        const grassPoints = sampleMeshPoisson(plane, 1000, 0.5);

        const count = grassPoints.length;
        const instancedMesh = new THREE.InstancedMesh(grassGeometry, grassMaterial, count);

        const dummy = new THREE.Object3D();

        grassPoints.forEach((p, i) => {
            dummy.position.copy(p);

            dummy.updateMatrix();
            instancedMesh.setMatrixAt(i, dummy.matrix);
        });
        instancedMesh.receiveShadow = true;
        //this.scene.add(instancedMesh);
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
                        flatShading: true
                    });
                    setMeshAttributes(mesh, {applyEdgeHighlight: true});

                    mesh.castShadow = true;
                    mesh.receiveShadow = true;
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

            this.camera_target.x = position_x;
            this.camera_target.z = position_z;
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
                //diffuse: TSL.diffuseColor,
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
            //const tLum = diffuseTextureNode.sample(iuv).dot(TSL.vec4(0.2126,0.7152,0.0722,0.0));

            const finalColor = texel.mul(coefficient);//.mul(tLum);

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