import * as THREE from 'three';
import { Player } from '../core/types';
import { soundManager } from '../audio/soundManager';

import { getTileTokenPosition } from './BoardCoordinates';

/**
 * Calculates 3D world coordinates for tile index (0 to 39)
 */
export function getTilePosition(tileIndex: number, playerIndex: number = 0, totalOnTile: number = 1): THREE.Vector3 {
  return getTileTokenPosition(tileIndex, playerIndex, totalOnTile);
}

export interface PlayerTokenMesh {
  id: string;
  group: THREE.Group;
  currentTile: number;
  waypoints: number[];
  hopProgress: number;
  hopStartPos: THREE.Vector3;
  hopTargetPos: THREE.Vector3;
  finalTargetPos: THREE.Vector3;
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
    // Count players on each tile
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
            token.hopProgress = 1.0; // Trigger immediate start of next waypoint
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

  private createTokenMesh(player: Player, initialPos: THREE.Vector3): PlayerTokenMesh {
    const group = new THREE.Group();
    group.position.copy(initialPos);

    // 1. Glowing Pedestal Base
    const baseGeom = new THREE.CylinderGeometry(0.18, 0.22, 0.08, 16);
    baseGeom.rotateX(Math.PI / 2);
    const baseMat = new THREE.MeshStandardMaterial({
      color: player.color,
      roughness: 0.2,
      metalness: 0.8,
      emissive: player.color,
      emissiveIntensity: 0.5,
    });
    const baseMesh = new THREE.Mesh(baseGeom, baseMat);
    group.add(baseMesh);

    // 2. Faceted Magic Crystal / Token Figure
    const crystalGeom = new THREE.OctahedronGeometry(0.15, 0);
    crystalGeom.scale(1, 1, 1.8);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.1,
      metalness: 0.9,
      emissive: player.color,
      emissiveIntensity: 0.7,
    });
    const crystalMesh = new THREE.Mesh(crystalGeom, crystalMat);
    crystalMesh.position.z = 0.22;
    group.add(crystalMesh);

    // 3. Floating Token Aura Light
    const light = new THREE.PointLight(player.color, 1.2, 1.5);
    light.position.z = 0.3;
    group.add(light);

    this.container.add(group);

    return {
      id: player.id,
      group,
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
      // 1. Check if token is actively hopping through waypoints
      if (token.waypoints.length > 0) {
        if (token.hopProgress >= 1.0) {
          // Finish previous hop and pick next waypoint
          const nextTile = token.waypoints.shift()!;
          token.hopStartPos.copy(token.group.position);

          // If this is the last waypoint, land on final target with slot offset
          if (token.waypoints.length === 0) {
            token.hopTargetPos.copy(token.finalTargetPos);
          } else {
            token.hopTargetPos.copy(getTilePosition(nextTile));
          }

          token.hopProgress = 0.0;
          soundManager.playTokenStep(nextTile);

          // If passing GO (tile 0)
          if (nextTile === 0) {
            soundManager.playCoin();
          }
        }

        // Advance hop progress (5.5 hops/s normal, scaled up in turbo)
        token.hopProgress += deltaTime * (5.5 * Math.max(0.5, speedMultiplier));

        if (token.hopProgress > 1.0) {
          token.hopProgress = 1.0;
        }

        const t = token.hopProgress;
        // Linear interpolation in XY
        token.group.position.x = THREE.MathUtils.lerp(token.hopStartPos.x, token.hopTargetPos.x, t);
        token.group.position.y = THREE.MathUtils.lerp(token.hopStartPos.y, token.hopTargetPos.y, t);

        // Parabolic jump arc in Z
        const jumpHeight = Math.sin(t * Math.PI) * 0.45;
        token.group.position.z = THREE.MathUtils.lerp(token.hopStartPos.z, token.hopTargetPos.z, t) + jumpHeight;

        token.group.rotation.z += 0.08;
      } else {
        // Idle floating state
        token.group.position.lerp(token.finalTargetPos, 0.1);
        token.group.position.z = token.finalTargetPos.z + Math.sin(time + token.group.position.x) * 0.03;
        token.group.rotation.z += 0.02;
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
