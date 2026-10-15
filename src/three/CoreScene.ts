/**
 * O núcleo 3D: portal de entrada da experiência.
 *
 * Classe framework-agnóstica. **Não possui rAF próprio** — quem chama
 * `render()` é o orquestrador de quadro único, que no mesmo quadro também
 * escreve os transforms do DOM da constelação. Dois relógios separados sairiam
 * de fase, e o handoff chama a suavização de ponto mais sensível do projeto.
 */

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  Mesh,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderer,
} from 'three';

import { ATMOSPHERE, cullSky, emptyCull } from '../core/atmosphere';
import type { Sky } from '../core/atmosphere';
import {
  ATMOSPHERE_TIME_SCALE,
  TIME_SCALE,
  decayPulse,
  nextPulseAt,
} from '../core/motion';
import {
  cameraZ,
  coreAmp,
  coreOpacity,
  coreScale,
  dustZ,
  innerGlow,
  innerScale,
} from '../core/navigation';
import { CAMERA_BASE_Z, CAMERA_FOV_DEG } from './framing';
import type { Framing } from './framing';
import { CORE_FRAGMENT_SHADER, CORE_VERTEX_SHADER } from './shaders/core';
import {
  BACKGROUND_FRAGMENT_SHADER,
  BACKGROUND_VERTEX_SHADER,
  MAX_GALAXIES,
  MAX_NEBULAE,
} from './shaders/background';
import { DUST_FRAGMENT_SHADER, DUST_VERTEX_SHADER } from './shaders/dust';
import { INNER_FRAGMENT_SHADER, INNER_VERTEX_SHADER } from './shaders/inner';

/** Abaixo disto a atmosfera não é desenhada: a passada inteira é pulada. */
const ATMOSPHERE_VISIBLE_ABOVE = 0.001;

/** Teto de pixel ratio, conforme o handoff. */
const MAX_PIXEL_RATIO = 1.75;

/** Abaixo desta largura a malha e a poeira são reduzidas. */
const NARROW_WIDTH = 780;

const MESH_DETAIL = { wide: 7, narrow: 5 } as const;
const DUST_COUNT = { wide: 1500, narrow: 700 } as const;

export interface CoreSceneOptions {
  readonly canvas: HTMLCanvasElement;
  readonly reducedMotion: boolean;
}

export class CoreScene {
  private readonly renderer: WebGLRenderer;
  private readonly scene: Scene;
  private readonly camera: PerspectiveCamera;
  private readonly group: Group;
  private readonly coreMesh: Mesh;
  private readonly innerMesh: Mesh;
  private readonly innerUniforms: { uO: { value: number }; uP: { value: number } };
  private readonly dust: Points;
  private readonly background: {
    readonly scene: Scene;
    readonly camera: OrthographicCamera;
    readonly mesh: Mesh;
    readonly uniforms: BackgroundUniforms;
  };
  private readonly uniforms: {
    uTime: { value: number };
    uAmp: { value: number };
    uMouse: { value: Vector2 };
    uOpacity: { value: number };
    uPulse: { value: number };
  };

  private framing: Framing | null = null;
  private sky: Sky = { nebulae: [], galaxies: [] };
  private readonly cull = emptyCull();
  private pan = 0;
  private atmosphere = 0;
  private atmosphereTime = 0;
  private width = 0;
  private height = 0;
  private pixelRatio = 1;
  private enter = 0;
  private pointerX = 0;
  private pointerY = 0;
  private reducedMotion: boolean;

  private shaderTime = 0;
  private pulse = 0;
  private pulseNextAt = 0;
  private disposed = false;

  constructor(options: CoreSceneOptions) {
    this.reducedMotion = options.reducedMotion;

    this.renderer = new WebGLRenderer({
      canvas: options.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    this.pixelRatio = pixelRatio;
    this.renderer.setPixelRatio(pixelRatio);
    // O fundo e o núcleo dividem o renderer: limpa-se uma vez, desenha-se o
    // céu e por cima a cena.
    this.renderer.autoClear = false;
    this.renderer.setClearColor(0x000000, 0);

    this.scene = new Scene();
    this.camera = new PerspectiveCamera(CAMERA_FOV_DEG, 1, 0.1, 100);
    this.camera.position.set(0, 0, CAMERA_BASE_Z);

    const narrow = window.innerWidth < NARROW_WIDTH;

    this.uniforms = {
      uTime: { value: 0 },
      uAmp: { value: coreAmp(0) },
      uMouse: { value: new Vector2(0, 0) },
      uOpacity: { value: 1 },
      uPulse: { value: 0 },
    };

    this.coreMesh = new Mesh(
      new IcosahedronGeometry(1, narrow ? MESH_DETAIL.narrow : MESH_DETAIL.wide),
      new ShaderMaterial({
        vertexShader: CORE_VERTEX_SHADER,
        fragmentShader: CORE_FRAGMENT_SHADER,
        uniforms: this.uniforms,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
      }),
    );

    // Luz por dentro, não mais uma esfera escura: divide o pulso com a borda,
    // e a energia que a percorre acende o centro junto.
    this.innerUniforms = { uO: { value: 1 }, uP: this.uniforms.uPulse };
    this.innerMesh = new Mesh(
      new IcosahedronGeometry(0.8, 4),
      new ShaderMaterial({
        vertexShader: INNER_VERTEX_SHADER,
        fragmentShader: INNER_FRAGMENT_SHADER,
        uniforms: this.innerUniforms,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );

    this.group = new Group();
    this.group.add(this.coreMesh);
    this.group.add(this.innerMesh);
    this.scene.add(this.group);

    this.dust = CoreScene.createDust(narrow ? DUST_COUNT.narrow : DUST_COUNT.wide, pixelRatio);
    this.scene.add(this.dust);

    this.background = CoreScene.createBackground(pixelRatio);
  }

  private static createBackground(pixelRatio: number): CoreScene['background'] {
    const uniforms: BackgroundUniforms = {
      uRes: { value: new Vector2(1, 1) },
      uDpr: { value: pixelRatio },
      uPan: { value: 0 },
      uTime: { value: 0 },
      uReveal: { value: 0 },
      uMy: { value: 0 },
      uOctaves: { value: 5 },
      uNeb: { value: Array.from({ length: MAX_NEBULAE }, () => new Vector4()) },
      uNebC: { value: Array.from({ length: MAX_NEBULAE }, () => new Vector3()) },
      uNebN: { value: 0 },
      uGal: { value: Array.from({ length: MAX_GALAXIES }, () => new Vector4()) },
      uGalB: { value: Array.from({ length: MAX_GALAXIES }, () => new Vector2(1, 0)) },
      uGalN: { value: 0 },
    };
    const mesh = new Mesh(
      new PlaneGeometry(2, 2),
      new ShaderMaterial({
        vertexShader: BACKGROUND_VERTEX_SHADER,
        fragmentShader: BACKGROUND_FRAGMENT_SHADER,
        uniforms,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        premultipliedAlpha: true,
      }),
    );
    const scene = new Scene();
    scene.add(mesh);
    return { scene, camera: new OrthographicCamera(-1, 1, 1, -1, 0, 1), mesh, uniforms };
  }

  private static createDust(count: number, pixelRatio: number): Points {
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i += 1) {
      const radius = 6 + Math.random() * 26;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      // Achatada em y: a nuvem lê como uma faixa, não como uma bola.
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) * 0.6;
      positions[i * 3 + 2] = radius * Math.cos(phi);
      sizes[i] = 0.02 + Math.random() * 0.05;
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('aSize', new BufferAttribute(sizes, 1));

    return new Points(
      geometry,
      new ShaderMaterial({
        vertexShader: DUST_VERTEX_SHADER,
        fragmentShader: DUST_FRAGMENT_SHADER,
        uniforms: { uPR: { value: pixelRatio } },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
  }

  // -- Entradas -------------------------------------------------------------

  /** `null` significa "medida ainda não confiável": a cena mantém a anterior. */
  setFraming(framing: Framing | null): void {
    if (framing) this.framing = framing;
  }

  /** Progresso da travessia, já suavizado pelo orquestrador. */
  setEnter(enter: number): void {
    this.enter = enter;
  }

  /** Ponteiro normalizado em -1..1, já suavizado. */
  setPointer(x: number, y: number): void {
    this.pointerX = x;
    this.pointerY = y;
  }

  /** O céu do acervo atual. Mesma referência, nada a fazer. */
  setSky(sky: Sky): void {
    this.sky = sky;
  }

  /**
   * Pan suavizado e intensidade da atmosfera (já multiplicada pela revelação
   * e pelo recuo da abertura de artigo). Em zero a passada é pulada.
   */
  setAtmosphere(pan: number, intensity: number): void {
    this.pan = pan;
    this.atmosphere = intensity;
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  resize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    this.width = width;
    this.height = height;
    this.renderer.setSize(width, height, false);
    this.background.uniforms.uRes.value.set(width * this.pixelRatio, height * this.pixelRatio);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  // -- Quadro ---------------------------------------------------------------

  render(deltaSeconds: number): void {
    if (this.disposed || !this.framing) return;

    const scale = this.reducedMotion ? TIME_SCALE.reduced : TIME_SCALE.normal;
    this.shaderTime += deltaSeconds * scale;

    this.advancePulse(deltaSeconds);

    const enter = this.enter;

    this.uniforms.uTime.value = this.shaderTime;
    this.uniforms.uAmp.value = coreAmp(enter);
    this.uniforms.uOpacity.value = coreOpacity(enter);
    this.uniforms.uMouse.value.set(this.pointerX, this.pointerY);

    this.group.position.y = this.framing.baseY;
    this.group.scale.setScalar(coreScale(this.framing.baseScale, enter));
    this.group.rotation.y =
      this.shaderTime * (this.reducedMotion ? 0.01 : 0.05) + this.pointerX * 0.3;
    this.group.rotation.x = Math.sin(this.shaderTime * 0.11) * 0.1 - this.pointerY * 0.22;

    this.innerMesh.scale.setScalar(innerScale(enter));
    this.innerUniforms.uO.value = innerGlow(enter);

    this.camera.position.z = cameraZ(enter);
    this.camera.position.x = this.pointerX * 0.22;
    this.camera.position.y = this.framing.baseY * enter + this.pointerY * 0.16;
    this.camera.lookAt(0, this.framing.baseY * enter, 0);

    this.dust.rotation.y += deltaSeconds * 0.006;
    this.dust.position.z = dustZ(enter);

    this.renderer.clear();
    this.renderAtmosphere(deltaSeconds);
    this.renderer.render(this.scene, this.camera);
  }

  /** O céu, antes do núcleo, só dentro do cosmos. */
  private renderAtmosphere(deltaSeconds: number): void {
    if (this.atmosphere <= ATMOSPHERE_VISIBLE_ABOVE) return;

    const scale = this.reducedMotion ? ATMOSPHERE_TIME_SCALE.reduced : ATMOSPHERE_TIME_SCALE.normal;
    this.atmosphereTime += deltaSeconds * scale;

    const narrow = this.width < NARROW_WIDTH;
    const maxNebulae = narrow ? ATMOSPHERE.maxNebulae.narrow : ATMOSPHERE.maxNebulae.wide;
    cullSky(this.sky, this.pan, this.width, maxNebulae, this.cull);

    const u = this.background.uniforms;
    u.uTime.value = this.atmosphereTime;
    u.uPan.value = this.pan;
    u.uMy.value = this.pointerY;
    u.uReveal.value = this.atmosphere;

    this.cull.nebulae.forEach((nebula, index) => {
      u.uNeb.value[index]?.set(nebula.px, nebula.y01 * this.height, nebula.radius, nebula.weight);
      u.uNebC.value[index]?.set(nebula.color[0], nebula.color[1], nebula.color[2]);
    });
    u.uNebN.value = this.cull.nebulae.length;
    this.cull.galaxies.forEach((galaxy, index) => {
      u.uGal.value[index]?.set(galaxy.px, galaxy.y01 * this.height, galaxy.size, galaxy.angle);
      u.uGalB.value[index]?.set(galaxy.squash, galaxy.brightness);
    });
    u.uGalN.value = this.cull.galaxies.length;

    this.renderer.render(this.background.scene, this.background.camera);
  }

  /**
   * O pulso dispara em intervalos aleatórios e decai continuamente, modulado
   * por uma senoide rápida: é o que faz a energia se ler percorrendo a
   * superfície em vez de piscar.
   */
  private advancePulse(deltaSeconds: number): void {
    if (this.pulseNextAt === 0) this.pulseNextAt = nextPulseAt(this.shaderTime);
    if (this.shaderTime > this.pulseNextAt) {
      this.pulse = 1;
      this.pulseNextAt = nextPulseAt(this.shaderTime);
    }
    this.pulse = decayPulse(this.pulse, this.reducedMotion, deltaSeconds);
    this.uniforms.uPulse.value =
      this.pulse * this.pulse * (0.55 + 0.45 * Math.sin(this.shaderTime * 5.5));
  }

  // -- Ciclo de vida --------------------------------------------------------

  dispose(): void {
    this.disposed = true;

    this.coreMesh.geometry.dispose();
    (this.coreMesh.material as ShaderMaterial).dispose();
    this.innerMesh.geometry.dispose();
    (this.innerMesh.material as ShaderMaterial).dispose();
    this.dust.geometry.dispose();
    (this.dust.material as ShaderMaterial).dispose();
    this.background.mesh.geometry.dispose();
    (this.background.mesh.material as ShaderMaterial).dispose();

    // Sem forceContextLoss: o canvas pertence ao React, que vai desmontá-lo.
    this.renderer.dispose();
  }
}

/** Alias, não interface: o ShaderMaterial exige a assinatura de índice implícita. */
type BackgroundUniforms = {
  uRes: { value: Vector2 };
  uDpr: { value: number };
  uPan: { value: number };
  uTime: { value: number };
  uReveal: { value: number };
  uMy: { value: number };
  uOctaves: { value: number };
  uNeb: { value: Vector4[] };
  uNebC: { value: Vector3[] };
  uNebN: { value: number };
  uGal: { value: Vector4[] };
  uGalB: { value: Vector2[] };
  uGalN: { value: number };
};
