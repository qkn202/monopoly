import * as THREE from 'three';
import { soundManager } from '../audio/soundManager';

/**
 * Creates 6 canvas textures for dice pips (1 to 6)
 */
function createDiceMaterials(): THREE.MeshStandardMaterial[] {
  const materials: THREE.MeshStandardMaterial[] = [];

  for (let n = 1; n <= 6; n++) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    // Dice background: Antique ivory gold-edged stone
    ctx.fillStyle = '#1e1b2e';
    ctx.fillRect(0, 0, 128, 128);

    // Gold border
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, 116, 116);

    // Glowing Gold Pips
    ctx.fillStyle = '#f59e0b';
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 8;

    const drawPip = (x: number, y: number) => {
      ctx.beginPath();
      ctx.arc(x, y, 11, 0, Math.PI * 2);
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
        roughness: 0.3,
        metalness: 0.6,
      })
    );
  }

  return materials;
}

// Map face number (1-6) to BoxGeometry material index (0-5)
// In Three.js Box: 0=+X, 1=-X, 2=+Y, 3=-Y, 4=+Z, 5=-Z
// We configure materials array so:
// Face 1 -> material 4 (+Z is top in our board view!)
// Face 2 -> material 0 (+X)
// Face 3 -> material 2 (+Y)
// Face 4 -> material 3 (-Y)
// Face 5 -> material 1 (-X)
// Face 6 -> material 5 (-Z)

export class Board3DDice {
  private container: THREE.Group;
  private die1Mesh: THREE.Mesh;
  private die2Mesh: THREE.Mesh;
  private materials: THREE.MeshStandardMaterial[];
  private isRolling: boolean = false;
  private rollProgress: number = 1.0;
  private die1TargetRot = new THREE.Euler();
  private die2TargetRot = new THREE.Euler();
  private die1StartPos = new THREE.Vector3();
  private die2StartPos = new THREE.Vector3();
  private die1EndPos = new THREE.Vector3(-0.55, -0.6, 0.45);
  private die2EndPos = new THREE.Vector3(0.55, -0.6, 0.45);

  constructor(scene: THREE.Scene) {
    this.container = new THREE.Group();
    this.container.name = 'Board3DDice';
    scene.add(this.container);

    this.materials = createDiceMaterials();
    const geom = new THREE.BoxGeometry(0.42, 0.42, 0.42);

    this.die1Mesh = new THREE.Mesh(geom, this.materials);
    this.die2Mesh = new THREE.Mesh(geom, this.materials);

    this.die1Mesh.position.copy(this.die1EndPos);
    this.die2Mesh.position.copy(this.die2EndPos);

    this.container.add(this.die1Mesh);
    this.container.add(this.die2Mesh);

    // Initial orientation: face 1 on +Z
    this.orientDieToValue(this.die1Mesh, 1);
    this.orientDieToValue(this.die2Mesh, 1);
  }

  private orientDieToValue(mesh: THREE.Mesh, value: number): THREE.Euler {
    // Face 1 is on +Z by default
    // We rotate so the chosen face points along +Z (towards camera)
    const euler = new THREE.Euler();
    switch (value) {
      case 1:
        euler.set(0, 0, 0); // +Z is face 1
        break;
      case 2:
        euler.set(0, -Math.PI / 2, 0); // +X (face 2) moves to +Z
        break;
      case 3:
        euler.set(Math.PI / 2, 0, 0); // +Y (face 3) moves to +Z
        break;
      case 4:
        euler.set(-Math.PI / 2, 0, 0); // -Y (face 4) moves to +Z
        break;
      case 5:
        euler.set(0, Math.PI / 2, 0); // -X (face 5) moves to +Z
        break;
      case 6:
        euler.set(Math.PI, 0, 0); // -Z (face 6) moves to +Z
        break;
    }
    return euler;
  }

  public roll(val1: number, val2: number): void {
    soundManager.playDiceRoll();

    this.isRolling = true;
    this.rollProgress = 0.0;

    // Drop from sky above plaza
    this.die1StartPos.set(-0.9 + (Math.random() - 0.5) * 0.4, -0.6 + (Math.random() - 0.5) * 0.4, 2.8);
    this.die2StartPos.set(0.9 + (Math.random() - 0.5) * 0.4, -0.6 + (Math.random() - 0.5) * 0.4, 3.2);

    this.die1Mesh.position.copy(this.die1StartPos);
    this.die2Mesh.position.copy(this.die2StartPos);

    // Calculate final resting rotations
    this.die1TargetRot = this.orientDieToValue(this.die1Mesh, Math.min(6, Math.max(1, val1)));
    this.die2TargetRot = this.orientDieToValue(this.die2Mesh, Math.min(6, Math.max(1, val2)));
  }

  public update(deltaTime: number, speedMultiplier: number = 1.0): void {
    if (!this.isRolling) {
      // Gentle idle float
      const t = Date.now() * 0.002;
      this.die1Mesh.position.z = this.die1EndPos.z + Math.sin(t) * 0.02;
      this.die2Mesh.position.z = this.die2EndPos.z + Math.cos(t) * 0.02;
      return;
    }

    this.rollProgress += deltaTime * (1.6 * Math.max(0.5, speedMultiplier));

    if (this.rollProgress >= 1.0) {
      this.rollProgress = 1.0;
      this.isRolling = false;
      this.die1Mesh.position.copy(this.die1EndPos);
      this.die2Mesh.position.copy(this.die2EndPos);
      this.die1Mesh.rotation.copy(this.die1TargetRot);
      this.die2Mesh.rotation.copy(this.die2TargetRot);
      return;
    }

    const t = this.rollProgress;
    // Parabolic bounce curve
    const bounce1 = Math.abs(Math.cos(t * Math.PI * 2.2)) * Math.max(0, 1 - t) * 1.5;
    const bounce2 = Math.abs(Math.sin(t * Math.PI * 2.0)) * Math.max(0, 1 - t) * 1.7;

    this.die1Mesh.position.x = THREE.MathUtils.lerp(this.die1StartPos.x, this.die1EndPos.x, t);
    this.die1Mesh.position.y = THREE.MathUtils.lerp(this.die1StartPos.y, this.die1EndPos.y, t);
    this.die1Mesh.position.z = this.die1EndPos.z + bounce1;

    this.die2Mesh.position.x = THREE.MathUtils.lerp(this.die2StartPos.x, this.die2EndPos.x, t);
    this.die2Mesh.position.y = THREE.MathUtils.lerp(this.die2StartPos.y, this.die2EndPos.y, t);
    this.die2Mesh.position.z = this.die2EndPos.z + bounce2;

    // Rapid tumble while in air, smoothly settles to target orientation
    const tumbleWeight = Math.pow(1 - t, 2) * 15;
    this.die1Mesh.rotation.x = this.die1TargetRot.x + tumbleWeight * Math.sin(t * 12);
    this.die1Mesh.rotation.y = this.die1TargetRot.y + tumbleWeight * Math.cos(t * 10);
    this.die1Mesh.rotation.z = this.die1TargetRot.z + tumbleWeight * 0.5;

    this.die2Mesh.rotation.x = this.die2TargetRot.x + tumbleWeight * Math.cos(t * 11);
    this.die2Mesh.rotation.y = this.die2TargetRot.y + tumbleWeight * Math.sin(t * 13);
    this.die2Mesh.rotation.z = this.die2TargetRot.z - tumbleWeight * 0.5;
  }

  public dispose(): void {
    this.container.remove(this.die1Mesh);
    this.container.remove(this.die2Mesh);
    this.die1Mesh.geometry.dispose();
    this.die2Mesh.geometry.dispose();
    this.materials.forEach((m) => {
      m.map?.dispose();
      m.dispose();
    });
  }
}
