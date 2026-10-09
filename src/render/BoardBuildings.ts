import * as THREE from 'three';
import { Player } from '../core/types';
import { HOGWARTS_TILES } from '../core/boardData';
import { getCardBuildingBasePos } from './BoardCoordinates';

interface AnimatedOrb {
  mesh: THREE.Mesh;
  baseZ: number;
  speed: number;
  phase: number;
}

interface AnimatedFlag {
  mesh: THREE.Mesh;
  baseRotZ: number;
  speed: number;
  phase: number;
}

/**
 * Calculates position for cottages/castles/flags on the inner edge of a deed card.
 */
function getTileBuildingBasePos(tileIndex: number): { x: number; y: number; rotZ: number } {
  return getCardBuildingBasePos(tileIndex);
}

/**
 * High-Definition 3D Building & Ownership Figure Manager for Hogwarts Monopoly
 * - Figures for owned plots without houses: Royal House Crest Boundary Monument & Silk Pennant
 * - Figures for developed plots (1-4 Cottages): Cozy medieval wizard cottages with glowing windows & house roofs
 * - Figures for upgraded plots (Hotel): Grand Hogwarts Castle Tower with golden spire & radiant floating beacon
 */
export class BoardBuildingManager {
  private container: THREE.Group;

  // Reusable Geometries
  private cottageBaseGeom: THREE.BoxGeometry;
  private cottageWindowGeom: THREE.BoxGeometry;
  private cottageRoofGeom: THREE.ConeGeometry;
  private cottageChimneyGeom: THREE.BoxGeometry;

  private castleTowerGeom: THREE.CylinderGeometry;
  private castleParapetGeom: THREE.CylinderGeometry;
  private castleSpireGeom: THREE.ConeGeometry;
  private castleOrbGeom: THREE.SphereGeometry;
  private castlePennantGeom: THREE.PlaneGeometry;

  private flagPlinthGeom: THREE.CylinderGeometry;
  private flagStaffGeom: THREE.CylinderGeometry;
  private flagPennantGeom: THREE.PlaneGeometry;
  private flagFinialGeom: THREE.SphereGeometry;

  // Reusable Base Materials
  private stoneWallMat: THREE.MeshStandardMaterial;
  private windowMat: THREE.MeshStandardMaterial;
  private chimneyMat: THREE.MeshStandardMaterial;
  private plinthMat: THREE.MeshStandardMaterial;
  private brassMat: THREE.MeshStandardMaterial;
  private crystalOrbMat: THREE.MeshStandardMaterial;

  // Dynamic House Color Material Caches
  private roofMatCache = new Map<string, THREE.MeshStandardMaterial>();
  private bannerMatCache = new Map<string, THREE.MeshStandardMaterial>();
  private spireMatCache = new Map<string, THREE.MeshStandardMaterial>();

  // Real-time animated components
  private animatedOrbs: AnimatedOrb[] = [];
  private animatedFlags: AnimatedFlag[] = [];

  constructor(scene: THREE.Scene) {
    this.container = new THREE.Group();
    this.container.name = 'BoardBuildings_HD';
    scene.add(this.container);

    // 1. Cottage Geometries
    this.cottageBaseGeom = new THREE.BoxGeometry(0.13, 0.13, 0.11);
    this.cottageWindowGeom = new THREE.BoxGeometry(0.045, 0.012, 0.045);
    this.cottageRoofGeom = new THREE.ConeGeometry(0.105, 0.12, 4);
    this.cottageRoofGeom.rotateZ(Math.PI / 4); // Align gables to walls
    this.cottageChimneyGeom = new THREE.BoxGeometry(0.026, 0.026, 0.07);

    // 2. Castle Geometries
    this.castleTowerGeom = new THREE.CylinderGeometry(0.15, 0.17, 0.22, 8);
    this.castleParapetGeom = new THREE.CylinderGeometry(0.185, 0.185, 0.04, 8);
    this.castleSpireGeom = new THREE.ConeGeometry(0.15, 0.28, 8);
    this.castleOrbGeom = new THREE.SphereGeometry(0.034, 12, 12);
    this.castlePennantGeom = new THREE.PlaneGeometry(0.12, 0.07);

    // 3. Ownership Boundary Flagpost Geometries
    this.flagPlinthGeom = new THREE.CylinderGeometry(0.065, 0.075, 0.03, 8);
    this.flagStaffGeom = new THREE.CylinderGeometry(0.009, 0.009, 0.24, 8);
    this.flagPennantGeom = new THREE.PlaneGeometry(0.11, 0.075);
    this.flagFinialGeom = new THREE.SphereGeometry(0.022, 8, 8);

    // 4. Base Materials
    this.stoneWallMat = new THREE.MeshStandardMaterial({
      color: 0x78716c, // Weathered Hogsmeade stone
      roughness: 0.75,
      metalness: 0.15,
    });

    this.windowMat = new THREE.MeshStandardMaterial({
      color: 0xffd54f,
      emissive: new THREE.Color(0xf59e0b),
      emissiveIntensity: 1.4,
      roughness: 0.3,
    });

    this.chimneyMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.9,
      metalness: 0.1,
    });

    this.plinthMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.35,
      metalness: 0.65,
    });

    this.brassMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.9,
      roughness: 0.15,
    });

    this.crystalOrbMat = new THREE.MeshStandardMaterial({
      color: 0xfffbeb,
      emissive: new THREE.Color(0xffd700),
      emissiveIntensity: 1.6,
      roughness: 0.1,
      metalness: 0.1,
    });
  }

  private getRoofMaterial(colorStr: string): THREE.MeshStandardMaterial {
    if (!this.roofMatCache.has(colorStr)) {
      this.roofMatCache.set(
        colorStr,
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(colorStr),
          roughness: 0.4,
          metalness: 0.35,
          emissive: new THREE.Color(colorStr),
          emissiveIntensity: 0.2,
        })
      );
    }
    return this.roofMatCache.get(colorStr)!;
  }

  private getBannerMaterial(colorStr: string): THREE.MeshStandardMaterial {
    if (!this.bannerMatCache.has(colorStr)) {
      this.bannerMatCache.set(
        colorStr,
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(colorStr),
          roughness: 0.3,
          metalness: 0.4,
          side: THREE.DoubleSide,
          emissive: new THREE.Color(colorStr),
          emissiveIntensity: 0.35,
        })
      );
    }
    return this.bannerMatCache.get(colorStr)!;
  }

  private getCastleSpireMaterial(colorStr: string): THREE.MeshStandardMaterial {
    if (!this.spireMatCache.has(colorStr)) {
      this.spireMatCache.set(
        colorStr,
        new THREE.MeshStandardMaterial({
          color: 0xf59e0b, // Radiant golden spire
          metalness: 0.88,
          roughness: 0.18,
          emissive: new THREE.Color(colorStr),
          emissiveIntensity: 0.3,
        })
      );
    }
    return this.spireMatCache.get(colorStr)!;
  }

  /**
   * Synchronizes all 3D figures on the board:
   * - Owned plots with 0 houses: Royal House Crest Boundary Monument
   * - Plots with 1 to 4 houses: Miniature Wizard Cottages with glowing candlelit windows
   * - Plots with a castle (hotel): Grand Hogwarts Castle Keep with golden spire & glowing beacon
   */
  public syncBuildings(
    players: Player[],
    propertyOwnership: Record<string, string>,
    mortgagedProperties: Record<string, boolean> = {}
  ): void {
    // Clear all existing meshes and registered animations
    while (this.container.children.length > 0) {
      const child = this.container.children[0];
      this.container.remove(child);
    }
    this.animatedOrbs = [];
    this.animatedFlags = [];

    // Scan all 40 tiles
    for (let i = 0; i < 40; i++) {
      const tile = HOGWARTS_TILES[i];
      if (!tile || (tile.type !== 'PROPERTY' && tile.type !== 'STATION' && tile.type !== 'UTILITY')) {
        continue;
      }

      const ownerId = propertyOwnership[tile.id];
      if (!ownerId) continue;

      const owner = players.find((p) => p.id === ownerId);
      if (!owner || owner.isBankrupt) continue;

      const isMortgaged = !!mortgagedProperties[tile.id];
      const houseCount = owner.houses[tile.id] || 0;
      const hasHotel = (owner.hotels[tile.id] || 0) > 0;
      const basePos = getTileBuildingBasePos(tile.index);
      const cardSurfaceZ = 0.045; // Exactly flush on top of card face

      if (hasHotel) {
        // =====================================================================
        // CASE A: GRAND HOGWARTS CASTLE (HOTEL)
        // =====================================================================
        const castleGroup = new THREE.Group();
        castleGroup.position.set(basePos.x, basePos.y, cardSurfaceZ);
        castleGroup.rotation.z = basePos.rotZ;

        // 1. Octagonal Fortress Tower Keep
        const towerMesh = new THREE.Mesh(this.castleTowerGeom, this.stoneWallMat);
        towerMesh.position.z = 0.11;
        towerMesh.rotation.x = Math.PI / 2;
        towerMesh.castShadow = true;
        towerMesh.receiveShadow = true;
        castleGroup.add(towerMesh);

        // 2. Parapet / Battlements
        const parapetMesh = new THREE.Mesh(this.castleParapetGeom, this.stoneWallMat);
        parapetMesh.position.z = 0.22;
        parapetMesh.rotation.x = Math.PI / 2;
        castleGroup.add(parapetMesh);

        // 3. Tall Conical Spire
        const spireMesh = new THREE.Mesh(this.castleSpireGeom, this.getCastleSpireMaterial(owner.color));
        spireMesh.position.z = 0.36;
        spireMesh.rotation.x = Math.PI / 2;
        castleGroup.add(spireMesh);

        // 4. Floating Magical Crystal Orb (Beacon)
        const orbMesh = new THREE.Mesh(this.castleOrbGeom, this.crystalOrbMat);
        orbMesh.position.z = 0.52;
        castleGroup.add(orbMesh);

        this.animatedOrbs.push({
          mesh: orbMesh,
          baseZ: 0.52,
          speed: 3.5,
          phase: i * 0.7,
        });

        // 5. Point Light casting mystical glow
        const beaconLight = new THREE.PointLight(new THREE.Color(owner.color), 0.75, 1.4);
        beaconLight.position.z = 0.52;
        castleGroup.add(beaconLight);

        // 6. Castle House Pennant atop tower
        const pennantStaff = new THREE.Mesh(this.flagStaffGeom, this.brassMat);
        pennantStaff.position.set(0.14, 0, 0.28);
        pennantStaff.rotation.x = Math.PI / 2;
        castleGroup.add(pennantStaff);

        const pennantMesh = new THREE.Mesh(this.castlePennantGeom, this.getBannerMaterial(owner.color));
        pennantMesh.position.set(0.14 + 0.06, 0, 0.32);
        pennantMesh.rotation.x = Math.PI / 2;
        castleGroup.add(pennantMesh);

        this.animatedFlags.push({
          mesh: pennantMesh,
          baseRotZ: 0,
          speed: 4.0,
          phase: i * 0.5,
        });

        this.container.add(castleGroup);

      } else if (houseCount > 0) {
        // =====================================================================
        // CASE B: 1 TO 4 WIZARD COTTAGES (HOUSES)
        // =====================================================================
        const spacing = 0.17;
        const startOffset = -((houseCount - 1) * spacing) / 2;

        for (let h = 0; h < houseCount; h++) {
          const cottageGroup = new THREE.Group();
          const localOffset = startOffset + h * spacing;

          let cx = basePos.x;
          let cy = basePos.y;
          if (tile.index < 10 || (tile.index >= 20 && tile.index < 30)) {
            cx += localOffset;
          } else {
            cy += localOffset;
          }

          cottageGroup.position.set(cx, cy, cardSurfaceZ);
          cottageGroup.rotation.z = basePos.rotZ;

          // 1. Stone Wall Base
          const baseMesh = new THREE.Mesh(this.cottageBaseGeom, this.stoneWallMat);
          baseMesh.position.z = 0.055;
          baseMesh.castShadow = true;
          baseMesh.receiveShadow = true;
          cottageGroup.add(baseMesh);

          // 2. Warm Candlelit Window on front
          const windowMesh = new THREE.Mesh(this.cottageWindowGeom, this.windowMat);
          windowMesh.position.set(0, -0.065, 0.055);
          cottageGroup.add(windowMesh);

          // 3. Steep Cottage Roof in Owner House Color
          const roofMesh = new THREE.Mesh(this.cottageRoofGeom, this.getRoofMaterial(owner.color));
          roofMesh.position.z = 0.165;
          roofMesh.rotation.x = Math.PI / 2;
          roofMesh.castShadow = true;
          cottageGroup.add(roofMesh);

          // 4. Stone Chimney
          const chimneyMesh = new THREE.Mesh(this.cottageChimneyGeom, this.chimneyMat);
          chimneyMesh.position.set(0.04, 0.025, 0.18);
          cottageGroup.add(chimneyMesh);

          this.container.add(cottageGroup);
        }

      } else {
        // =====================================================================
        // CASE C: ROYAL OWNERSHIP BOUNDARY MONUMENT & PENNANT (0 HOUSES BUILT)
        // =====================================================================
        const flagGroup = new THREE.Group();
        flagGroup.position.set(basePos.x, basePos.y, cardSurfaceZ);
        flagGroup.rotation.z = basePos.rotZ;

        // 1. Carved Obsidian & Gold Plinth Base
        const plinthMesh = new THREE.Mesh(this.flagPlinthGeom, this.plinthMat);
        plinthMesh.position.z = 0.015;
        plinthMesh.rotation.x = Math.PI / 2;
        flagGroup.add(plinthMesh);

        // 2. Polished Brass Flagstaff
        const staffMesh = new THREE.Mesh(this.flagStaffGeom, this.brassMat);
        staffMesh.position.z = 0.135;
        staffMesh.rotation.x = Math.PI / 2;
        flagGroup.add(staffMesh);

        // 3. Fluttering Royal Silk Pennant (or Dark Amber Mortgaged Pennant)
        const bannerColor = isMortgaged ? '#92400e' : owner.color;
        const bannerMesh = new THREE.Mesh(this.flagPennantGeom, this.getBannerMaterial(bannerColor));
        bannerMesh.position.set(0.055, 0, 0.19);
        bannerMesh.rotation.x = Math.PI / 2;
        flagGroup.add(bannerMesh);

        this.animatedFlags.push({
          mesh: bannerMesh,
          baseRotZ: 0,
          speed: isMortgaged ? 1.5 : 3.2,
          phase: i * 0.8,
        });

        // 4. Golden Crown / Seal Finial at Top
        const finialMesh = new THREE.Mesh(this.flagFinialGeom, this.brassMat);
        finialMesh.position.z = 0.255;
        flagGroup.add(finialMesh);

        // 5. Subtle magical ownership aura light (dimmer amber if mortgaged)
        const markerLightColor = isMortgaged ? 0xd97706 : owner.color;
        const markerLightIntensity = isMortgaged ? 0.18 : 0.35;
        const markerLight = new THREE.PointLight(new THREE.Color(markerLightColor), markerLightIntensity, 0.7);
        markerLight.position.z = 0.22;
        flagGroup.add(markerLight);

        this.container.add(flagGroup);
      }
    }
  }

  /**
   * Real-time animation update:
   * - Gentle hovering bob of magical crystal orbs
   * - Soft fluttering wave of royal silk pennants
   */
  public update(time: number, _delta: number): void {
    // 1. Bobbing Castle Orbs
    for (const orb of this.animatedOrbs) {
      orb.mesh.position.z = orb.baseZ + Math.sin(time * orb.speed + orb.phase) * 0.015;
    }

    // 2. Fluttering Pennants
    for (const flag of this.animatedFlags) {
      flag.mesh.rotation.y = Math.sin(time * flag.speed + flag.phase) * 0.15;
    }
  }

  public dispose(): void {
    while (this.container.children.length > 0) {
      const child = this.container.children[0];
      this.container.remove(child);
    }

    this.cottageBaseGeom.dispose();
    this.cottageWindowGeom.dispose();
    this.cottageRoofGeom.dispose();
    this.cottageChimneyGeom.dispose();

    this.castleTowerGeom.dispose();
    this.castleParapetGeom.dispose();
    this.castleSpireGeom.dispose();
    this.castleOrbGeom.dispose();
    this.castlePennantGeom.dispose();

    this.flagPlinthGeom.dispose();
    this.flagStaffGeom.dispose();
    this.flagPennantGeom.dispose();
    this.flagFinialGeom.dispose();

    this.stoneWallMat.dispose();
    this.windowMat.dispose();
    this.chimneyMat.dispose();
    this.plinthMat.dispose();
    this.brassMat.dispose();
    this.crystalOrbMat.dispose();

    this.roofMatCache.forEach((mat) => mat.dispose());
    this.bannerMatCache.forEach((mat) => mat.dispose());
    this.spireMatCache.forEach((mat) => mat.dispose());
  }
}
