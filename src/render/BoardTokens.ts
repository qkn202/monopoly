import * as THREE from 'three';
import { Player, HouseType } from '../core/types';
import { soundManager } from '../audio/soundManager';
import { getTileTokenPosition } from './BoardCoordinates';

/**
 * Calculates 3D world coordinates for tile index (0 to 39)
 */
export function getTilePosition(tileIndex: number, playerIndex: number = 0, totalOnTile: number = 1): THREE.Vector3 {
  return getTileTokenPosition(tileIndex, playerIndex, totalOnTile);
}

// --- 8 HOGWARTS UNIQUE GEMSTONE SPECTRUM ---
export type GemShape =
  | 'MARQUISE_FLAME'    // Ruby (Hồng Ngọc) - Marquise Navette Flame Cut
  | 'EMERALD_STEP'       // Emerald (Ngọc Lục Bảo) - Classic Octagonal Step Cut
  | 'ROYAL_BRILLIANT'    // Sapphire (Lam Ngọc) - 12-Faceted Brilliant Cut
  | 'BRIOLETTE_DROP'     // Topaz (Hoàng Ngọc) - Hexagonal Teardrop Briolette Drop
  | 'QUARTZ_OBELISK'     // Amethyst (Thạch Anh Tím) - Natural Terminated Quartz Crystal Pillar
  | 'TRILLIANT_SPIRE'    // Black Onyx (Hắc Ngọc) - 3-Sided Gothic Dagger Spire
  | 'RHOMBIC_KITE'       // Fire Opal (Hỏa Ngọc) - Rhombic Sunburst Kite Crystal
  | 'ICE_COLUMN';        // Aquamarine (Lam Ngọc Biển) - Faceted Ice Cushion Column Prism

export interface GemstoneConfig {
  house: HouseType | string;
  name: string;
  gemName: string;
  gemCut: string;
  shape: GemShape;
  gemColorHex: number;
  accentHex: number;
  coreHex: number;
  motto: string;
}

export const GEMSTONE_SPECTRUM: Record<string, GemstoneConfig> = {
  Gryffindor: {
    house: 'Gryffindor',
    name: 'Gryffindor',
    gemName: 'Ruby (Hồng Ngọc Hoàng Gia)',
    gemCut: 'Marquise Flame Cut (Cắt Hình Hạt Thóc / Ngọn Lửa)',
    shape: 'MARQUISE_FLAME',
    gemColorHex: 0xbe123c, // Rich deep ruby crimson
    accentHex: 0xffd700,
    coreHex: 0xff0033,
    motto: 'Lửa Thiêng & Dũng Khí Bất Diệt',
  },
  Slytherin: {
    house: 'Slytherin',
    name: 'Slytherin',
    gemName: 'Emerald (Ngọc Lục Bảo Quý Tộc)',
    gemCut: 'Classic Emerald Step Cut (Cắt Xếp Tầng Bát Giác)',
    shape: 'EMERALD_STEP',
    gemColorHex: 0x047857, // Deep royal emerald
    accentHex: 0xe2e8f0,
    coreHex: 0x00ff88,
    motto: 'Quyền Lực & Ma Lực Hoàng Gia',
  },
  Ravenclaw: {
    house: 'Ravenclaw',
    name: 'Ravenclaw',
    gemName: 'Sapphire (Lam Ngọc Vĩnh Cửu)',
    gemCut: 'Royal Round Brilliant Cut (Cắt Giác Tròn Kim Cương 12 Cạnh)',
    shape: 'ROYAL_BRILLIANT',
    gemColorHex: 0x1e40af, // Deep royal cobalt sapphire
    accentHex: 0xcd7f32,
    coreHex: 0x38bdf8,
    motto: 'Trí Tuệ & Ánh Sáng Vĩnh Hằng',
  },
  Hufflepuff: {
    house: 'Hufflepuff',
    name: 'Hufflepuff',
    gemName: 'Topaz (Hoàng Ngọc Hổ Phách)',
    gemCut: 'Faceted Briolette Drop (Cắt Giọt Nước Đa Diện Lục Giác)',
    shape: 'BRIOLETTE_DROP',
    gemColorHex: 0xd97706, // Rich warm amber gold
    accentHex: 0xffd700,
    coreHex: 0xfde047,
    motto: 'Trung Thành & Sức Mạnh Bền Bỉ',
  },
  Auror: {
    house: 'Auror',
    name: 'Auror Order',
    gemName: 'Amethyst (Trụ Thạch Anh Tím Tự Nhiên)',
    gemCut: 'Natural Quartz Obelisk Point (Trụ Tinh Thể Lục Lăng Tự Nhiên)',
    shape: 'QUARTZ_OBELISK',
    gemColorHex: 0x7e22ce, // Imperial royal violet
    accentHex: 0xf1f5f9,
    coreHex: 0xc084fc,
    motto: 'Công Lý & Khiên Chắn Phép Thuật',
  },
  DeathEater: {
    house: 'DeathEater',
    name: 'Death Eater',
    gemName: 'Black Onyx (Hắc Kim Cương Gai Nhọn)',
    gemCut: 'Gothic Trilliant Dagger Spire (Mũi Gai Tam Giác Hắc Ám)',
    shape: 'TRILLIANT_SPIRE',
    gemColorHex: 0x0f172a, // Obsidian midnight black
    accentHex: 0x94a3b8,
    coreHex: 0xf8fafc,
    motto: 'Hắc Ám Huyền Bí & Tối Thượng',
  },
  OrderOfPhoenix: {
    house: 'OrderOfPhoenix',
    name: 'Phoenix Order',
    gemName: 'Fire Opal (Hỏa Ngọc Phượng Hoàng)',
    gemCut: 'Rhombic Kite Sunburst (Viên Đá Hình Thoi Cánh Diều)',
    shape: 'RHOMBIC_KITE',
    gemColorHex: 0xc2410c, // Intense fiery orange
    accentHex: 0xffd700,
    coreHex: 0xfb923c,
    motto: 'Bất Khuất & Tái Sinh Từ Tro Tàn',
  },
  Ministry: {
    house: 'Ministry',
    name: 'Ministry of Magic',
    gemName: 'Aquamarine (Lam Ngọc Biển / Hải Lam Tinh)',
    gemCut: 'Faceted Ice Cushion Column (Trụ Băng Bát Giác Hải Thần)',
    shape: 'ICE_COLUMN',
    gemColorHex: 0x0891b2, // Deep vivid marine cyan
    accentHex: 0xe2e8f0,
    coreHex: 0x67e8f9,
    motto: 'Trật Tự & Pháp Thuật Tối Cao',
  },
};

// Backwards-compatible alias
export const DIAMOND_SPECTRUM = GEMSTONE_SPECTRUM;

export interface PlayerTokenMesh {
  id: string;
  group: THREE.Group;
  gemMesh: THREE.Group;
  runeRing: THREE.Mesh;
  satellites: THREE.Mesh[];
  haloLight: THREE.PointLight;
  currentTile: number;
  waypoints: number[];
  hopProgress: number;
  hopStartPos: THREE.Vector3;
  hopTargetPos: THREE.Vector3;
  finalTargetPos: THREE.Vector3;
}

// --- GEOMETRY HELPERS (Z-UP ORIENTED) ---
function makeCylinderZ(rTop: number, rBot: number, height: number, segs = 16): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(rTop, rBot, height, segs);
  g.rotateX(Math.PI / 2);
  return g;
}

function makeConeZ(radius: number, height: number, segs = 16): THREE.BufferGeometry {
  const g = new THREE.ConeGeometry(radius, height, segs);
  g.rotateX(Math.PI / 2);
  return g;
}

function makeTorusZ(radius: number, tube: number, radialSegs = 8, tubularSegs = 24): THREE.BufferGeometry {
  return new THREE.TorusGeometry(radius, tube, radialSegs, tubularSegs);
}

/**
 * Creates one of the 8 unique floating gemstone tokens (no pedestal, pure floating gem).
 */
export function createGemstoneToken(
  shape: GemShape,
  gemColorHex: number,
  accentColorHex: number = 0xffd700,
  coreColorHex?: number
): {
  group: THREE.Group;
  gemGroup: THREE.Group;
  runeRing: THREE.Mesh;
  satellites: THREE.Mesh[];
  auraLight: THREE.PointLight;
} {
  const group = new THREE.Group();
  group.name = `GemstonePiece_${shape}`;

  const innerFireColor = coreColorHex || gemColorHex;

  // 1. Spinning Runic Aura Floor Halo (ground level z = 0.005)
  const runeGeom = new THREE.RingGeometry(0.16, 0.28, 32);
  const runeMat = new THREE.MeshBasicMaterial({
    color: innerFireColor,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
  });
  const runeRing = new THREE.Mesh(runeGeom, runeMat);
  runeRing.position.z = 0.005;
  group.add(runeRing);

  // 2. The Floating Gemstone Crystal Group
  const gemGroup = new THREE.Group();
  gemGroup.name = `Gem_${shape}`;
  gemGroup.position.set(0, 0, 0);

  // Sparkling Crystal Material with flat faceting for maximum brilliance
  // Non-metallic dielectric minerals (metalness ~ 0.08) preserve genuine body color saturation
  const diamondMat = new THREE.MeshStandardMaterial({
    color: gemColorHex,
    roughness: shape === 'TRILLIANT_SPIRE' ? 0.08 : 0.12,
    metalness: shape === 'TRILLIANT_SPIRE' ? 0.85 : 0.08,
    emissive: gemColorHex,
    emissiveIntensity: shape === 'TRILLIANT_SPIRE' ? 0.15 : 0.32,
    flatShading: true,
  });

  const metalMat = new THREE.MeshStandardMaterial({
    color: accentColorHex,
    roughness: 0.20,
    metalness: 0.95,
  });

  // Internal Prismatic Fire Core Material
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: innerFireColor,
    emissiveIntensity: 4.2,
    roughness: 0.04,
    metalness: 0.95,
    flatShading: true,
  });

  // Build the specific 3D gemstone geometry
  switch (shape) {
    case 'MARQUISE_FLAME': {
      // 1. Ruby - Marquise Flame Cut (Almond-shaped pointed crystal)
      const upper = new THREE.Mesh(makeCylinderZ(0.001, 0.20, 0.42, 8), diamondMat);
      upper.position.z = 0.55;
      gemGroup.add(upper);

      const lower = new THREE.Mesh(makeCylinderZ(0.20, 0.001, 0.28, 8), diamondMat);
      lower.position.z = 0.20;
      gemGroup.add(lower);

      const girdle = new THREE.Mesh(makeCylinderZ(0.204, 0.204, 0.03, 8), diamondMat);
      girdle.position.z = 0.34;
      gemGroup.add(girdle);

      const ring = new THREE.Mesh(makeTorusZ(0.206, 0.008, 6, 24), metalMat);
      ring.position.z = 0.34;
      gemGroup.add(ring);

      const core = new THREE.Mesh(makeCylinderZ(0.001, 0.08, 0.34, 8), coreMat);
      core.position.z = 0.38;
      gemGroup.add(core);

      gemGroup.scale.set(1.42, 0.76, 1.0);
      break;
    }

    case 'EMERALD_STEP': {
      // 2. Emerald - Classic Octagonal Step Cut
      const girdle = new THREE.Mesh(makeCylinderZ(0.20, 0.20, 0.16, 8), diamondMat);
      girdle.position.z = 0.34;
      gemGroup.add(girdle);

      const crown = new THREE.Mesh(makeCylinderZ(0.13, 0.20, 0.18, 8), diamondMat);
      crown.position.z = 0.51;
      gemGroup.add(crown);

      const table = new THREE.Mesh(makeCylinderZ(0.13, 0.13, 0.015, 8), diamondMat);
      table.position.z = 0.60;
      gemGroup.add(table);

      const pavilion = new THREE.Mesh(makeCylinderZ(0.20, 0.05, 0.24, 8), diamondMat);
      pavilion.position.z = 0.14;
      gemGroup.add(pavilion);

      const ring = new THREE.Mesh(makeTorusZ(0.206, 0.008, 6, 24), metalMat);
      ring.position.z = 0.34;
      gemGroup.add(ring);

      const core = new THREE.Mesh(makeCylinderZ(0.07, 0.09, 0.30, 8), coreMat);
      core.position.z = 0.34;
      gemGroup.add(core);

      gemGroup.scale.set(1.36, 0.88, 1.0);
      break;
    }

    case 'ROYAL_BRILLIANT': {
      // 3. Sapphire - 12-sided Royal Brilliant Diamond Cut
      const crown = new THREE.Mesh(makeCylinderZ(0.12, 0.21, 0.16, 12), diamondMat);
      crown.position.z = 0.42;
      gemGroup.add(crown);

      const table = new THREE.Mesh(makeCylinderZ(0.12, 0.12, 0.015, 12), diamondMat);
      table.position.z = 0.50;
      gemGroup.add(table);

      const pavilion = new THREE.Mesh(makeCylinderZ(0.21, 0.001, 0.32, 12), diamondMat);
      pavilion.position.z = 0.18;
      gemGroup.add(pavilion);

      const girdle = new THREE.Mesh(makeCylinderZ(0.212, 0.212, 0.025, 12), diamondMat);
      girdle.position.z = 0.34;
      gemGroup.add(girdle);

      const ring = new THREE.Mesh(makeTorusZ(0.214, 0.008, 6, 24), metalMat);
      ring.position.z = 0.34;
      gemGroup.add(ring);

      const core = new THREE.Mesh(makeCylinderZ(0.001, 0.09, 0.30, 12), coreMat);
      core.position.z = 0.32;
      gemGroup.add(core);
      break;
    }

    case 'BRIOLETTE_DROP': {
      // 4. Topaz - Hexagonal Briolette Teardrop Drop
      const dropBase = new THREE.Mesh(makeCylinderZ(0.21, 0.10, 0.18, 6), diamondMat);
      dropBase.position.z = 0.15;
      gemGroup.add(dropBase);

      const dropDome = new THREE.Mesh(makeCylinderZ(0.10, 0.02, 0.08, 6), diamondMat);
      dropDome.position.z = 0.04;
      gemGroup.add(dropDome);

      const dropSpire = new THREE.Mesh(makeCylinderZ(0.001, 0.21, 0.40, 6), diamondMat);
      dropSpire.position.z = 0.44;
      gemGroup.add(dropSpire);

      const ring = new THREE.Mesh(makeTorusZ(0.214, 0.008, 6, 24), metalMat);
      ring.position.z = 0.24;
      gemGroup.add(ring);

      const core = new THREE.Mesh(makeCylinderZ(0.001, 0.09, 0.36, 6), coreMat);
      core.position.z = 0.32;
      gemGroup.add(core);
      break;
    }

    case 'QUARTZ_OBELISK': {
      // 5. Amethyst - Natural 6-sided Terminated Quartz Crystal Pillar
      const shaft = new THREE.Mesh(makeCylinderZ(0.18, 0.18, 0.38, 6), diamondMat);
      shaft.position.z = 0.32;
      gemGroup.add(shaft);

      const termination = new THREE.Mesh(makeConeZ(0.18, 0.26, 6), diamondMat);
      termination.position.z = 0.64;
      gemGroup.add(termination);

      const root = new THREE.Mesh(makeCylinderZ(0.18, 0.08, 0.10, 6), diamondMat);
      root.position.z = 0.08;
      gemGroup.add(root);

      const ring = new THREE.Mesh(makeTorusZ(0.184, 0.008, 6, 24), metalMat);
      ring.position.z = 0.32;
      gemGroup.add(ring);

      const core = new THREE.Mesh(makeCylinderZ(0.001, 0.08, 0.42, 6), coreMat);
      core.position.z = 0.36;
      gemGroup.add(core);
      break;
    }

    case 'TRILLIANT_SPIRE': {
      // 6. Black Onyx - 3-sided Gothic Trilliant Dagger Spire
      const body = new THREE.Mesh(makeCylinderZ(0.19, 0.19, 0.38, 3), diamondMat);
      body.position.z = 0.32;
      gemGroup.add(body);

      const spire = new THREE.Mesh(makeConeZ(0.19, 0.32, 3), diamondMat);
      spire.position.z = 0.67;
      gemGroup.add(spire);

      const keel = new THREE.Mesh(makeCylinderZ(0.19, 0.001, 0.14, 3), diamondMat);
      keel.position.z = 0.06;
      gemGroup.add(keel);

      const ring = new THREE.Mesh(makeTorusZ(0.194, 0.008, 3, 24), metalMat);
      ring.position.z = 0.32;
      gemGroup.add(ring);

      const core = new THREE.Mesh(makeCylinderZ(0.001, 0.07, 0.40, 3), coreMat);
      core.position.z = 0.35;
      gemGroup.add(core);
      break;
    }

    case 'RHOMBIC_KITE': {
      // 7. Fire Opal - Rhombic Kite Sunburst Crystal
      const upper = new THREE.Mesh(makeCylinderZ(0.001, 0.22, 0.36, 4), diamondMat);
      upper.position.z = 0.52;
      upper.rotation.z = Math.PI / 4;
      gemGroup.add(upper);

      const lower = new THREE.Mesh(makeCylinderZ(0.22, 0.001, 0.28, 4), diamondMat);
      lower.position.z = 0.20;
      lower.rotation.z = Math.PI / 4;
      gemGroup.add(lower);

      const upper2 = new THREE.Mesh(makeCylinderZ(0.001, 0.20, 0.34, 4), diamondMat);
      upper2.position.z = 0.51;
      gemGroup.add(upper2);

      const lower2 = new THREE.Mesh(makeCylinderZ(0.20, 0.001, 0.26, 4), diamondMat);
      lower2.position.z = 0.21;
      gemGroup.add(lower2);

      const ring = new THREE.Mesh(makeTorusZ(0.224, 0.008, 6, 24), metalMat);
      ring.position.z = 0.34;
      gemGroup.add(ring);

      const core = new THREE.Mesh(makeCylinderZ(0.001, 0.09, 0.30, 8), coreMat);
      core.position.z = 0.34;
      gemGroup.add(core);

      gemGroup.scale.set(1.1, 1.1, 1.2);
      break;
    }

    case 'ICE_COLUMN':
    default: {
      // 8. Aquamarine - Faceted Ice Cushion Column Prism
      const shaft = new THREE.Mesh(makeCylinderZ(0.17, 0.17, 0.40, 8), diamondMat);
      shaft.position.z = 0.32;
      gemGroup.add(shaft);

      const crown = new THREE.Mesh(makeCylinderZ(0.11, 0.17, 0.14, 8), diamondMat);
      crown.position.z = 0.59;
      gemGroup.add(crown);

      const table = new THREE.Mesh(makeCylinderZ(0.11, 0.11, 0.015, 8), diamondMat);
      table.position.z = 0.66;
      gemGroup.add(table);

      const pavilion = new THREE.Mesh(makeCylinderZ(0.17, 0.07, 0.14, 8), diamondMat);
      pavilion.position.z = 0.05;
      gemGroup.add(pavilion);

      const ring = new THREE.Mesh(makeTorusZ(0.176, 0.008, 8, 24), metalMat);
      ring.position.z = 0.32;
      gemGroup.add(ring);

      const core = new THREE.Mesh(makeCylinderZ(0.06, 0.06, 0.36, 8), coreMat);
      core.position.z = 0.32;
      gemGroup.add(core);
      break;
    }
  }

  // 3. Orbiting Mini Diamond Shards / Satellites
  const satellites: THREE.Mesh[] = [];
  const satGeom = new THREE.OctahedronGeometry(0.028, 0);
  const satMat = new THREE.MeshStandardMaterial({
    color: innerFireColor,
    emissive: 0xffffff,
    emissiveIntensity: 2.5,
    roughness: 0.06,
    metalness: 0.9,
    flatShading: true,
  });

  const sat1 = new THREE.Mesh(satGeom, satMat);
  sat1.position.set(0.28, 0, 0.34);
  gemGroup.add(sat1);
  satellites.push(sat1);

  const sat2 = new THREE.Mesh(satGeom, satMat);
  sat2.position.set(-0.25, 0.12, 0.32);
  gemGroup.add(sat2);
  satellites.push(sat2);

  // 4. Colored Light Aura
  const auraLight = new THREE.PointLight(innerFireColor, 2.2, 2.8);
  auraLight.position.set(0, 0, 0.34);
  group.add(auraLight);

  group.add(gemGroup);

  return {
    group,
    gemGroup,
    runeRing,
    satellites,
    auraLight,
  };
}

// Backwards compatibility helper
export function createDiamondToken(
  gemColorHex: number,
  accentColorHex: number = 0xffd700,
  coreColorHex?: number
) {
  return createGemstoneToken('MARQUISE_FLAME', gemColorHex, accentColorHex, coreColorHex);
}

export class PlayerTokenManager {
  private tokens: Map<string, PlayerTokenMesh> = new Map();
  private container: THREE.Group;

  constructor(scene: THREE.Scene) {
    this.container = new THREE.Group();
    this.container.name = 'PlayerTokens';
    scene.add(this.container);
  }

  public syncPlayers(players: Player[]): void {
    // Count players on each tile for multi-player offset positioning
    const tileCounts: Record<number, number> = {};
    players.forEach((p) => {
      if (!p.isBankrupt) {
        tileCounts[p.position] = (tileCounts[p.position] || 0) + 1;
      }
    });

    const tileIndices: Record<number, number> = {};

    players.forEach((player) => {
      if (player.isBankrupt) {
        this.removeToken(player.id);
        return;
      }

      const countOnTile = tileCounts[player.position] || 1;
      const slotIndex = tileIndices[player.position] || 0;
      tileIndices[player.position] = slotIndex + 1;

      const target = getTilePosition(player.position, slotIndex, countOnTile);

      let token = this.tokens.get(player.id);
      if (!token) {
        token = this.createTokenMesh(player, target);
        token.currentTile = player.position;
        this.tokens.set(player.id, token);
      } else {
        token.finalTargetPos.copy(target);

        // If player moved to a new position, compute hop waypoints
        if (token.currentTile !== player.position) {
          const oldPos = token.currentTile;
          const newPos = player.position;

          // Compute forward step distance around 40 tiles
          let steps = (newPos - oldPos + 40) % 40;
          if (steps === 0 && oldPos !== newPos) steps = 40;

          // If it's a normal forward move (1 to 12 steps), generate hopping waypoints!
          if (steps > 0 && steps <= 12) {
            token.waypoints = [];
            for (let s = 1; s <= steps; s++) {
              token.waypoints.push((oldPos + s) % 40);
            }
            token.hopProgress = 1.0;
          } else {
            // Direct teleport (e.g. Go to Jail or Card jump)
            token.waypoints = [newPos];
            token.hopProgress = 1.0;
          }
          token.currentTile = newPos;
        }
      }
    });
  }

  public createTokenMesh(player: Player, initialPos: THREE.Vector3): PlayerTokenMesh {
    // Look up unique gemstone config from spectrum or fall back to Gryffindor
    const config = GEMSTONE_SPECTRUM[player.house] || GEMSTONE_SPECTRUM.Gryffindor;
    const gemColor = config ? config.gemColorHex : new THREE.Color(player.color).getHex();
    const accentColor = config ? config.accentHex : 0xffd700;
    const emissiveColor = config ? config.coreHex : gemColor;
    const gemShape = config ? config.shape : 'MARQUISE_FLAME';

    const { group, gemGroup, runeRing, satellites, auraLight } = createGemstoneToken(
      gemShape,
      gemColor,
      accentColor,
      emissiveColor
    );

    group.name = `PlayerGemstone_${player.id}_${gemShape}`;
    group.position.copy(initialPos);
    this.container.add(group);

    return {
      id: player.id,
      group,
      gemMesh: gemGroup,
      runeRing,
      satellites,
      haloLight: auraLight,
      currentTile: player.position,
      waypoints: [],
      hopProgress: 1.0,
      hopStartPos: initialPos.clone(),
      hopTargetPos: initialPos.clone(),
      finalTargetPos: initialPos.clone(),
    };
  }

  public update(deltaTime: number, speedMultiplier: number = 1.0): void {
    const time = Date.now() * 0.003;

    this.tokens.forEach((token) => {
      // 1. Rotate the ground rune ring smoothly
      if (token.runeRing) {
        token.runeRing.rotation.z -= deltaTime * 0.8;
      }

      // 2. Levitation bobbing & majestic spin of the Diamond Crystal
      if (token.gemMesh) {
        token.gemMesh.position.z = 0.33 + Math.sin(time * 2.5) * 0.035;
        token.gemMesh.rotation.z += deltaTime * 0.9 * speedMultiplier;
      }

      // 3. Orbiting Diamond Satellites
      if (token.satellites && token.satellites.length > 0) {
        const t = Date.now() * 0.004;
        token.satellites.forEach((sat, sIdx) => {
          const offset = sIdx * Math.PI;
          const rad = 0.25;
          sat.position.set(
            Math.cos(t + offset) * rad,
            Math.sin(t + offset) * rad,
            Math.sin(t * 2 + offset) * 0.03
          );
          sat.rotation.z += deltaTime * 2.0;
          sat.rotation.x += deltaTime * 1.5;
        });
      }

      // 4. Hopping Navigation Engine (Parabolic jump along waypoints)
      if (token.waypoints.length > 0) {
        if (token.hopProgress >= 1.0) {
          // Finish previous hop and pick next waypoint
          const nextTile = token.waypoints.shift()!;
          token.hopStartPos.copy(token.group.position);

          // If last waypoint, hop directly to final assigned slot on tile
          if (token.waypoints.length === 0) {
            token.hopTargetPos.copy(token.finalTargetPos);
          } else {
            token.hopTargetPos.copy(getTilePosition(nextTile, 0, 1));
          }

          token.hopProgress = 0.0;
          soundManager.playTokenStep();
        }

        const HOP_SPEED = 4.2 * speedMultiplier;
        token.hopProgress += deltaTime * HOP_SPEED;
        const p = Math.min(1.0, token.hopProgress);

        // Linear interpolation for XY ground plane
        const currentXY = new THREE.Vector3().lerpVectors(token.hopStartPos, token.hopTargetPos, p);

        // Parabolic arc for Z: peak height = 0.55 units
        const arcZ = Math.sin(p * Math.PI) * 0.55;
        token.group.position.set(currentXY.x, currentXY.y, currentXY.z + arcZ);

        // Dynamic forward tilt during jump
        const forwardVector = new THREE.Vector3().subVectors(token.hopTargetPos, token.hopStartPos);
        if (forwardVector.lengthSq() > 0.001) {
          const angle = Math.atan2(forwardVector.y, forwardVector.x);
          const tiltAmount = Math.sin(p * Math.PI) * 0.22;
          token.group.rotation.z = angle - Math.PI / 2;
          token.group.rotation.x = tiltAmount;
        }

        // Landing impact squash & stretch effect
        if (p >= 0.92) {
          const squash = 1.0 - Math.sin((p - 0.92) / 0.08 * Math.PI) * 0.18;
          token.group.scale.set(1.0 + (1.0 - squash) * 0.5, 1.0 + (1.0 - squash) * 0.5, squash);
        } else {
          token.group.scale.set(1, 1, 1);
        }

        // On final arrival
        if (p >= 1.0 && token.waypoints.length === 0) {
          token.group.position.copy(token.finalTargetPos);
          token.group.rotation.set(0, 0, 0);
          token.group.scale.set(1, 1, 1);
        }
      } else {
        // Idle gentle breathing on ground
        token.group.position.lerp(token.finalTargetPos, 0.15);
      }
    });
  }

  public removeToken(playerId: string): void {
    const token = this.tokens.get(playerId);
    if (token) {
      this.container.remove(token.group);
      this.tokens.delete(playerId);
    }
  }

  public dispose(): void {
    this.tokens.forEach((token) => {
      this.container.remove(token.group);
    });
    this.tokens.clear();
  }
}
