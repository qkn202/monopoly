import * as THREE from 'three';

interface SparkParticle {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  color: THREE.Color;
  life: number;
  maxLife: number;
  size: number;
}

export class BoardParticleSystem {
  private particles: SparkParticle[] = [];
  private geom: THREE.BufferGeometry;
  private mat: THREE.PointsMaterial;
  private pointsMesh: THREE.Points;
  private posAttr: THREE.BufferAttribute;
  private colAttr: THREE.BufferAttribute;
  private maxCount = 600;

  constructor(scene: THREE.Scene) {
    this.geom = new THREE.BufferGeometry();
    const positions = new Float32Array(this.maxCount * 3);
    const colors = new Float32Array(this.maxCount * 3);

    this.posAttr = new THREE.BufferAttribute(positions, 3);
    this.colAttr = new THREE.BufferAttribute(colors, 3);

    this.geom.setAttribute('position', this.posAttr);
    this.geom.setAttribute('color', this.colAttr);

    this.mat = new THREE.PointsMaterial({
      size: 0.18,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.pointsMesh = new THREE.Points(this.geom, this.mat);
    scene.add(this.pointsMesh);
  }

  /**
   * Spawns a magical spell burst at a 3D location
   */
  public spawnBurst(pos: THREE.Vector3, hexColor: string = '#f59e0b', count: number = 60): void {
    const color = new THREE.Color(hexColor);

    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxCount) break;

      const angle = Math.random() * Math.PI * 2;
      const speed = 0.8 + Math.random() * 2.2;
      const vel = new THREE.Vector3(
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        0.5 + Math.random() * 2.5
      );

      this.particles.push({
        pos: pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2, 0.1)),
        vel,
        color: color.clone(),
        life: 0,
        maxLife: 0.8 + Math.random() * 0.6,
        size: 0.12 + Math.random() * 0.1,
      });
    }
  }

  public update(deltaTime: number): void {
    const posArr = this.posAttr.array as Float32Array;
    const colArr = this.colAttr.array as Float32Array;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += deltaTime;

      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }

      // Physics
      p.pos.addScaledVector(p.vel, deltaTime);
      p.vel.z -= deltaTime * 3.5; // gravity
      p.vel.multiplyScalar(0.96); // air drag

      const fade = 1 - p.life / p.maxLife;

      const idx = i * 3;
      posArr[idx] = p.pos.x;
      posArr[idx + 1] = p.pos.y;
      posArr[idx + 2] = p.pos.z;

      colArr[idx] = p.color.r * fade;
      colArr[idx + 1] = p.color.g * fade;
      colArr[idx + 2] = p.color.b * fade;
    }

    // Zero out unused slots
    for (let i = this.particles.length; i < this.maxCount; i++) {
      const idx = i * 3;
      posArr[idx] = 0;
      posArr[idx + 1] = 0;
      posArr[idx + 2] = -999;
    }

    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
  }

  public dispose(): void {
    if (this.pointsMesh.parent) {
      this.pointsMesh.parent.remove(this.pointsMesh);
    }
    this.geom.dispose();
    this.mat.dispose();
    this.particles = [];
  }
}
