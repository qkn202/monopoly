import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { soundManager } from '../audio/soundManager';
import { LOW_POWER } from './quality';

/**
 * Creates 6 canvas textures for dice pips (1 to 6)
 * Materials are returned in order: [2, 5, 3, 4, 1, 6]
 * This matches BoxGeometry face mapping: [0]=+X, [1]=-X, [2]=+Y, [3]=-Y, [4]=+Z, [5]=-Z
 * So rotating to show face N on +Z requires specific rotations.
 */
function createDiceMaterials(): THREE.MeshStandardMaterial[] {
  // Create materials in order: [2, 5, 3, 4, 1, 6]
  // materials[0] = value 2, materials[1] = value 5, etc.
  const faceOrder = [2, 5, 3, 4, 1, 6];
  const materials: THREE.MeshStandardMaterial[] = [];

  for (const n of faceOrder) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(2, 2);

    // Dark lacquer face with a soft centre light and a thin gold inlay
    const face = ctx.createRadialGradient(64, 52, 8, 64, 64, 90);
    face.addColorStop(0, '#3a2814');
    face.addColorStop(1, '#140c06');
    ctx.fillStyle = face;
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = 'rgba(243, 220, 154, 0.55)';
    ctx.lineWidth = 2;
    ctx.strokeRect(11, 11, 106, 106);

    // Engraved gold pips: dark socket, gold dome, small highlight
    const drawPip = (x: number, y: number) => {
      const r = n === 1 ? 15 : 11;
      ctx.fillStyle = '#0a0603';
      ctx.beginPath();
      ctx.arc(x, y + 1, r + 1.5, 0, Math.PI * 2);
      ctx.fill();
      const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, 1, x, y, r);
      g.addColorStop(0, '#fff3c4');
      g.addColorStop(0.45, '#e2b866');
      g.addColorStop(1, '#8a6326');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    };

    if (n === 1) {
      // Center
      drawPip(64, 64);
    } else if (n === 2) {
      drawPip(36, 36);
      drawPip(92, 92);
    } else if (n === 3) {
      drawPip(36, 36);
      drawPip(64, 64);
      drawPip(92, 92);
    } else if (n === 4) {
      drawPip(36, 36);
      drawPip(92, 36);
      drawPip(36, 92);
      drawPip(92, 92);
    } else if (n === 5) {
      drawPip(36, 36);
      drawPip(92, 36);
      drawPip(64, 64);
      drawPip(36, 92);
      drawPip(92, 92);
    } else if (n === 6) {
      drawPip(36, 32);
      drawPip(92, 32);
      drawPip(36, 64);
      drawPip(92, 64);
      drawPip(36, 96);
      drawPip(92, 96);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    materials.push(
      new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.35,
        metalness: 0.45,
        emissive: new THREE.Color(0xe2b866),
        emissiveMap: texture,
        emissiveIntensity: 0,
      })
    );
  }

  return materials;
}

// Map face number (1-6) to BoxGeometry material index (0-5)
// In Three.js BoxGeometry: materials[0]=+X, [1]=-X, [2]=+Y, [3]=-Y, [4]=+Z (top), [5]=-Z (bottom)
// We reorder materials array so that:
// materials[0] = value 2 (shows on +X when rotated)
// materials[1] = value 5 (shows on -X when rotated)
// materials[2] = value 3 (shows on +Y when rotated)
// materials[3] = value 4 (shows on -Y when rotated)
// materials[4] = value 1 (shows on +Z when rotated - TOP)
// materials[5] = value 6 (shows on -Z when rotated - BOTTOM)

// Roll feel: thrown big from near the camera, three decaying bounces, a gold flash on landing,
// then the pair settles a little smaller in the centre plaza.
const DIE = 0.42;
const ROLL_SCALE = 3.8; // in the air
const REST_SCALE = 2.6; // resting on the crest
const ROLL_SECONDS = 1.15;

/** When the dice are (or will be) at rest, in performance.now() ms; overlays wait for it. */
export const diceClock = { settleAt: 0 };

export class Board3DDice {
  private container: THREE.Group;
  private die1Mesh: THREE.Mesh;
  private die2Mesh: THREE.Mesh;
  private materials: THREE.MeshStandardMaterial[];
  private flash: THREE.PointLight;
  private isRolling: boolean = false;
  private rollProgress: number = 1.0;
  private landed = false;
  private glow = 0; // 1 at landing, fades to 0
  private die1TargetRot = new THREE.Euler();
  private die2TargetRot = new THREE.Euler();
  private die1StartPos = new THREE.Vector3();
  private die2StartPos = new THREE.Vector3();
  private die1EndPos = new THREE.Vector3(-0.72, -0.35, 0.62);
  private die2EndPos = new THREE.Vector3(0.72, -0.35, 0.62);

  constructor(scene: THREE.Scene, private onLand?: (center: THREE.Vector3) => void) {
    this.container = new THREE.Group();
    this.container.name = 'Board3DDice';
    scene.add(this.container);

    this.materials = createDiceMaterials();
    const geom = new RoundedBoxGeometry(DIE, DIE, DIE, 4, DIE * 0.16);

    this.die1Mesh = new THREE.Mesh(geom, this.materials);
    this.die2Mesh = new THREE.Mesh(geom, this.materials);
    this.die1Mesh.scale.setScalar(REST_SCALE);
    this.die2Mesh.scale.setScalar(REST_SCALE);

    this.die1Mesh.position.copy(this.die1EndPos);
    this.die2Mesh.position.copy(this.die2EndPos);

    this.container.add(this.die1Mesh);
    this.container.add(this.die2Mesh);

    // Landing flash light; phones skip it (one more light costs every lit material) and keep the emissive pulse.
    this.flash = new THREE.PointLight(0xffd98a, 0, 9, 2);
    this.flash.position.set(0, -0.35, 2.4);
    if (!LOW_POWER) this.container.add(this.flash);

    // Initial orientation: face 1 on +Z
    this.orientDieToValue(this.die1Mesh, 1);
    this.orientDieToValue(this.die2Mesh, 1);
  }

  private orientDieToValue(mesh: THREE.Mesh, value: number): THREE.Euler {
    // We want the chosen value to show on the +Z face (top, towards camera)
    // BoxGeometry materials: [0]=+X, [1]=-X, [2]=+Y, [3]=-Y, [4]=+Z, [5]=-Z
    const euler = new THREE.Euler();
    switch (value) {
      case 1:
        // materials[4] has value 1, +Z face is already correct (no rotation needed)
        euler.set(0, 0, 0);
        break;
      case 2:
        // materials[0] has value 2, rotate -90° around Y to bring +X to +Z
        euler.set(0, -Math.PI / 2, 0);
        break;
      case 3:
        // materials[2] has value 3, rotate +90° around X to bring +Y to +Z
        euler.set(Math.PI / 2, 0, 0);
        break;
      case 4:
        // materials[3] has value 4, rotate -90° around X to bring -Y to +Z
        euler.set(-Math.PI / 2, 0, 0);
        break;
      case 5:
        // materials[1] has value 5, rotate +90° around Y to bring -X to +Z
        euler.set(0, Math.PI / 2, 0);
        break;
      case 6:
        // materials[5] has value 6, rotate 180° around X to bring -Z to +Z
        euler.set(Math.PI, 0, 0);
        break;
    }
    // A small random twist about the up axis so the pair never lands perfectly aligned.
    euler.z += (Math.random() - 0.5) * 0.5;
    return euler;
  }

  public roll(val1: number, val2: number): void {
    soundManager.playDiceRoll();

    this.isRolling = true;
    this.landed = false;
    this.rollProgress = 0.0;
    diceClock.settleAt = performance.now() + ROLL_SECONDS * 1000;

    // Thrown from the near side of the board (towards the camera), high up
    this.die1StartPos.set(-1.6 + (Math.random() - 0.5) * 0.5, -3.2 + (Math.random() - 0.5) * 0.4, 3.4);
    this.die2StartPos.set(1.6 + (Math.random() - 0.5) * 0.5, -3.0 + (Math.random() - 0.5) * 0.4, 3.8);

    this.die1Mesh.position.copy(this.die1StartPos);
    this.die2Mesh.position.copy(this.die2StartPos);

    // Calculate final resting rotations
    this.die1TargetRot = this.orientDieToValue(this.die1Mesh, Math.min(6, Math.max(1, val1)));
    this.die2TargetRot = this.orientDieToValue(this.die2Mesh, Math.min(6, Math.max(1, val2)));
  }

  private setGlow(v: number) {
    this.glow = v;
    this.flash.intensity = v * 9;
    this.materials.forEach((m) => (m.emissiveIntensity = v * 0.55));
  }

  public update(deltaTime: number, speedMultiplier: number = 1.0): void {
    if (this.glow > 0) this.setGlow(Math.max(0, this.glow - deltaTime * 1.8));

    if (!this.isRolling) {
      // Gentle idle float
      const t = Date.now() * 0.002;
      this.die1Mesh.position.z = this.die1EndPos.z + Math.sin(t) * 0.02;
      this.die2Mesh.position.z = this.die2EndPos.z + Math.cos(t) * 0.02;
      return;
    }

    this.rollProgress += (deltaTime / ROLL_SECONDS) * Math.max(0.5, speedMultiplier);
    const t = Math.min(1, this.rollProgress);

    // Three bounces that lose height (|cos| arcs scaled by a decaying envelope), first one tallest
    const env = Math.pow(1 - t, 1.6);
    const bounce1 = Math.abs(Math.cos(t * Math.PI * 3.0)) * env * 3.4;
    const bounce2 = Math.abs(Math.cos(t * Math.PI * 3.0 + 0.35)) * env * 3.8;

    // Ease-out travel so the dice skid to a stop
    const e = 1 - Math.pow(1 - t, 3);
    this.die1Mesh.position.x = THREE.MathUtils.lerp(this.die1StartPos.x, this.die1EndPos.x, e);
    this.die1Mesh.position.y = THREE.MathUtils.lerp(this.die1StartPos.y, this.die1EndPos.y, e);
    this.die1Mesh.position.z = this.die1EndPos.z + bounce1;
    this.die2Mesh.position.x = THREE.MathUtils.lerp(this.die2StartPos.x, this.die2EndPos.x, e);
    this.die2Mesh.position.y = THREE.MathUtils.lerp(this.die2StartPos.y, this.die2EndPos.y, e);
    this.die2Mesh.position.z = this.die2EndPos.z + bounce2;

    // Big in the air, shrinking to rest size over the last third
    const scale = THREE.MathUtils.lerp(ROLL_SCALE, REST_SCALE, THREE.MathUtils.smoothstep(t, 0.62, 1));
    this.die1Mesh.scale.setScalar(scale);
    this.die2Mesh.scale.setScalar(scale);

    // Fast tumble that winds down onto the target face
    const tumble = Math.pow(1 - t, 2.2) * 18;
    this.die1Mesh.rotation.set(
      this.die1TargetRot.x + tumble * Math.sin(t * 9 + 0.4),
      this.die1TargetRot.y + tumble * Math.cos(t * 7),
      this.die1TargetRot.z + tumble * 0.6,
    );
    this.die2Mesh.rotation.set(
      this.die2TargetRot.x + tumble * Math.cos(t * 8),
      this.die2TargetRot.y + tumble * Math.sin(t * 10 + 1.1),
      this.die2TargetRot.z - tumble * 0.6,
    );

    // Final landing (last bounce touches down around t ≈ 0.83)
    if (!this.landed && t > 0.83) {
      this.landed = true;
      this.setGlow(1);
      diceClock.settleAt = performance.now();
      this.onLand?.(new THREE.Vector3(0, this.die1EndPos.y, this.die1EndPos.z));
    }

    if (this.rollProgress >= 1.0) {
      this.isRolling = false;
      this.die1Mesh.position.copy(this.die1EndPos);
      this.die2Mesh.position.copy(this.die2EndPos);
      this.die1Mesh.rotation.copy(this.die1TargetRot);
      this.die2Mesh.rotation.copy(this.die2TargetRot);
      this.die1Mesh.scale.setScalar(REST_SCALE);
      this.die2Mesh.scale.setScalar(REST_SCALE);
    }
  }

  public dispose(): void {
    this.container.remove(this.die1Mesh);
    this.container.remove(this.die2Mesh);
    this.container.remove(this.flash);
    this.die1Mesh.geometry.dispose();
    this.materials.forEach((m) => {
      m.map?.dispose();
      m.dispose();
    });
  }
}
