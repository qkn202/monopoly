import * as THREE from 'three';
import { TileConfig, Player } from '../core/types';
import { HOGWARTS_TILES, COLOR_GROUP_STYLES } from '../core/boardData';
import { getCardCoord, CardCoord, CardOrientation } from './BoardCoordinates';

export interface BoardCardItem {
  tile: TileConfig;
  coord: CardCoord;
  cardGroup: THREE.Group;
  baseMesh: THREE.Mesh;
  faceMesh: THREE.Mesh;
  borderLine: THREE.LineLoop;
  borderMat: THREE.LineBasicMaterial;
  faceMat: THREE.MeshStandardMaterial;
  targetZ: number;
  currentZ: number;
  isHovered: boolean;
  ownerId?: string | null;
  isMortgaged?: boolean;
}

/**
 * Helper to draw an image centered with "object-fit: cover" without stretching
 */
function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number = 8
) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.clip();

  const imgRatio = img.width / img.height;
  const dstRatio = w / h;

  let sx = 0;
  let sy = 0;
  let sw = img.width;
  let sh = img.height;

  if (imgRatio > dstRatio) {
    sw = img.height * dstRatio;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / dstRatio;
    sy = (img.height - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  ctx.restore();
}

/**
 * Creates an ornate, crystal-clear 100% UPRIGHT deed card canvas texture
 */
function createCardCanvasTexture(
  tile: TileConfig,
  orientation: CardOrientation,
  img: HTMLImageElement | null,
  owner: { name: string; house: string; color: string } | null = null,
  isMortgaged: boolean = false
): THREE.CanvasTexture {
  const isVertical = orientation === 'VERTICAL';
  const isCorner = orientation === 'CORNER';

  // Exact matching aspect ratios:
  // Vertical: 0.88 / 1.58 = 0.557 -> 570 / 1024 = 0.5566
  // Horizontal: 1.58 / 0.88 = 1.795 -> 1024 / 570 = 1.7965
  // Corner: 1.58 / 1.58 = 1.000 -> 1024 / 1024 = 1.0000
  let canvasW = 570;
  let canvasH = 1024;

  if (isCorner) {
    canvasW = 1024;
    canvasH = 1024;
  } else if (!isVertical) {
    canvasW = 1024;
    canvasH = 570;
  }

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d')!;

  const style = tile.colorGroup ? COLOR_GROUP_STYLES[tile.colorGroup] : null;
  const headerColor = style?.bg || '#1e293b';
  const districtName = style?.name || (tile.type === 'GO' ? 'KHỞI HÀNH' : tile.type === 'JAIL' ? 'NGỤC AZKABAN' : 'PHÁP THUẬT');

  // 1. Dark Midnight Slate / Royal Parchment Background (no pure black void)
  const bgGrad = ctx.createLinearGradient(0, 0, 0, canvasH);
  bgGrad.addColorStop(0, '#0f172a');
  bgGrad.addColorStop(0.5, '#0a0f1d');
  bgGrad.addColorStop(1, '#060912');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, canvasW, canvasH);

  // 2. Ornate Golden Filigree Outer Rim (m = 2: right at the physical edge!)
  const m = 2;
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 4;
  ctx.strokeRect(m, m, canvasW - m * 2, canvasH - m * 2);

  ctx.strokeStyle = '#00f2fe';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(m + 4, m + 4, canvasW - (m + 4) * 2, canvasH - (m + 4) * 2);

  if (isVertical) {
    // -------------------------------------------------------------------
    // VERTICAL CARD (South & North tracks) - 570 x 1024
    // -------------------------------------------------------------------
    // A. Header Bar
    const headerH = 145;
    ctx.fillStyle = headerColor;
    ctx.fillRect(m + 4, m + 4, canvasW - (m + 4) * 2, headerH);

    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(m + 4, m + 4 + headerH);
    ctx.lineTo(canvasW - (m + 4), m + 4 + headerH);
    ctx.stroke();

    // District Category
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 22px "Cinzel", "Times New Roman", serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 6;
    ctx.fillText(districtName.toUpperCase(), canvasW / 2, m + 42);

    // Location Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px "Cinzel", "Times New Roman", serif';
    ctx.shadowColor = '#00f2fe';
    ctx.shadowBlur = 10;

    const words = tile.name.split(' ');
    if (words.length > 2) {
      const mid = Math.ceil(words.length / 2);
      ctx.fillText(words.slice(0, mid).join(' '), canvasW / 2, m + 88);
      ctx.fillText(words.slice(mid).join(' '), canvasW / 2, m + 128);
    } else {
      ctx.fillText(tile.name, canvasW / 2, m + 104);
    }

    // B. Center Picture Window (Exact 2:3 Aspect Ratio)
    const picX = m + 6;
    const picY = m + 4 + headerH + 8;
    const picW = canvasW - (m + 6) * 2;
    const picH = 730;

    // Picture frame border
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 3;
    ctx.strokeRect(picX, picY, picW, picH);

    if (img && img.complete && img.naturalWidth > 0) {
      drawImageCover(ctx, img, picX + 2, picY + 2, picW - 4, picH - 4, 4);
    } else {
      ctx.fillStyle = '#111827';
      ctx.fillRect(picX + 2, picY + 2, picW - 4, picH - 4);
      ctx.font = '80px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tile.icon || '⚡', picX + picW / 2, picY + picH / 2);
    }

    // C. Bottom Plaque: Owner House Banner or Price Plaque
    if (owner) {
      const plaqueH = 82;
      const plaqueY = canvasH - m - plaqueH - 10;
      const plaqueW = canvasW - (m + 6) * 2;
      const plaqueX = m + 6;

      const plaqueGrad = ctx.createLinearGradient(plaqueX, plaqueY, plaqueX + plaqueW, plaqueY + plaqueH);
      plaqueGrad.addColorStop(0, owner.color);
      plaqueGrad.addColorStop(0.5, '#0b1120');
      plaqueGrad.addColorStop(1, owner.color);
      ctx.fillStyle = plaqueGrad;
      ctx.beginPath();
      ctx.roundRect(plaqueX, plaqueY, plaqueW, plaqueH, 8);
      ctx.fill();

      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 28px "Cinzel", "Times New Roman", serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 8;
      ctx.fillText(`👑 ${owner.name.toUpperCase()}`, canvasW / 2, plaqueY + 34);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px "Cinzel", "Times New Roman", serif';
      ctx.shadowBlur = 4;
      const rentAmount = tile.baseRent || (tile.rentTiers ? tile.rentTiers[0] : 0);
      ctx.fillText(`${owner.house.toUpperCase()} • THUẾ: ${rentAmount}G`, canvasW / 2, plaqueY + 66);
    } else {
      const plaqueY = canvasH - m - 45;
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 34px "Cinzel", "Times New Roman", serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 12;
      ctx.fillText(tile.price ? `${tile.price} GALLEONS` : 'HOGWARTS REALM', canvasW / 2, plaqueY);
    }

  } else if (!isCorner) {
    // -------------------------------------------------------------------
    // HORIZONTAL CARD (West & East tracks) - 1024 x 570
    // Both Picture & Text are 100% UPRIGHT!
    // -------------------------------------------------------------------
    // Left half: Vertical 2:3 Picture Window standing upright!
    const picX = m + 6;
    const picY = m + 6;
    const picW = 350;
    const picH = canvasH - (m + 6) * 2;

    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 3;
    ctx.strokeRect(picX, picY, picW, picH);

    if (img && img.complete && img.naturalWidth > 0) {
      drawImageCover(ctx, img, picX + 2, picY + 2, picW - 4, picH - 4, 4);
    } else {
      ctx.fillStyle = '#111827';
      ctx.fillRect(picX + 2, picY + 2, picW - 4, picH - 4);
      ctx.font = '80px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tile.icon || '⚡', picX + picW / 2, picY + picH / 2);
    }

    // Right half: District Badge, Title, Description, Price
    const textStartX = picX + picW + 24;
    const textW = canvasW - textStartX - m - 8;

    // District Color Pill
    ctx.fillStyle = headerColor;
    ctx.beginPath();
    ctx.roundRect(textStartX, m + 28, textW, 60, 8);
    ctx.fill();
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px "Cinzel", "Times New Roman", serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 6;
    ctx.fillText(districtName.toUpperCase(), textStartX + textW / 2, m + 68);

    // Location Title
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 44px "Cinzel", "Times New Roman", serif';
    ctx.shadowColor = '#00f2fe';
    ctx.shadowBlur = 12;

    const words = tile.name.split(' ');
    if (words.length > 2) {
      const mid = Math.ceil(words.length / 2);
      ctx.fillText(words.slice(0, mid).join(' '), textStartX + textW / 2, m + 170);
      ctx.fillText(words.slice(mid).join(' '), textStartX + textW / 2, m + 225);
    } else {
      ctx.fillText(tile.name, textStartX + textW / 2, m + 195);
    }

    // Lore / Subtitle
    ctx.fillStyle = '#94a3b8';
    ctx.font = '24px "Cinzel", "Times New Roman", serif';
    ctx.shadowBlur = 0;
    ctx.fillText('ĐỊA DANH PHÙ THỦY CHÍNH THỐNG', textStartX + textW / 2, m + 305);

    // Bottom Plaque: Owner House Banner or Gold Price Plaque
    if (owner) {
      const plaqueH = 82;
      const plaqueY = canvasH - m - plaqueH - 12;
      const plaqueGrad = ctx.createLinearGradient(textStartX, plaqueY, textStartX + textW, plaqueY + plaqueH);
      plaqueGrad.addColorStop(0, owner.color);
      plaqueGrad.addColorStop(0.5, '#0b1120');
      plaqueGrad.addColorStop(1, owner.color);
      ctx.fillStyle = plaqueGrad;
      ctx.beginPath();
      ctx.roundRect(textStartX, plaqueY, textW, plaqueH, 10);
      ctx.fill();

      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 30px "Cinzel", "Times New Roman", serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 8;
      ctx.fillText(`👑 ${owner.name.toUpperCase()}`, textStartX + textW / 2, plaqueY + 35);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px "Cinzel", "Times New Roman", serif';
      ctx.shadowBlur = 4;
      const rentAmount = tile.baseRent || (tile.rentTiers ? tile.rentTiers[0] : 0);
      ctx.fillText(`${owner.house.toUpperCase()} • THUẾ: ${rentAmount} GALLEONS`, textStartX + textW / 2, plaqueY + 68);
    } else {
      const plaqueY = canvasH - m - 60;
      ctx.fillStyle = 'rgba(255, 215, 0, 0.15)';
      ctx.beginPath();
      ctx.roundRect(textStartX, plaqueY - 50, textW, 70, 8);
      ctx.fill();
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 40px "Cinzel", "Times New Roman", serif';
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 12;
      ctx.fillText(tile.price ? `${tile.price} GALLEONS` : 'HOGWARTS REALM', textStartX + textW / 2, plaqueY);
    }

  } else {
    // -------------------------------------------------------------------
    // CORNER CARD (0, 10, 20, 30) - 1024 x 1024
    // -------------------------------------------------------------------
    // Top Title
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 46px "Cinzel", "Times New Roman", serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#00f2fe';
    ctx.shadowBlur = 14;
    ctx.fillText(tile.name.toUpperCase(), canvasW / 2, m + 65);

    // Center Picture Window (Exact 780 x 780 Square)
    const picSize = 780;
    const picX = (canvasW - picSize) / 2;
    const picY = m + 90;

    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 4;
    ctx.strokeRect(picX, picY, picSize, picSize);

    if (img && img.complete && img.naturalWidth > 0) {
      drawImageCover(ctx, img, picX + 3, picY + 3, picSize - 6, picSize - 6, 6);
    } else {
      ctx.fillStyle = '#111827';
      ctx.fillRect(picX + 3, picY + 3, picSize - 6, picSize - 6);
      ctx.font = '140px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tile.icon || '⚡', canvasW / 2, picY + picSize / 2);
    }

    // Bottom Subtitle
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 30px "Cinzel", "Times New Roman", serif';
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 8;
    const sub =
      tile.index === 0
        ? 'VƯỢT QUA NHẬN 200 GALLEONS'
        : tile.index === 10
        ? 'KHU VỰC THĂM NUÔI & TÙ NHÂN'
        : tile.index === 20
        ? 'PHÒNG YÊU CẦU NGHỈ CHÂN MIỄN PHÍ'
        : 'ÁP GIẢI TRỰC TIẾP VÀO AZKABAN';
    ctx.fillText(sub, canvasW / 2, canvasH - m - 45);
  }

  // 4. Mortgaged Caution Banner & Dark Translucent Wash
  if (isMortgaged) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
    ctx.fillRect(0, 0, canvasW, canvasH);

    ctx.save();
    ctx.translate(canvasW / 2, canvasH / 2);
    ctx.rotate(isVertical ? -0.32 : isCorner ? -0.25 : -0.16);

    const bannerW = canvasW * 1.35;
    const bannerH = isVertical ? 92 : 78;

    const bGrad = ctx.createLinearGradient(-bannerW / 2, 0, bannerW / 2, 0);
    bGrad.addColorStop(0, 'rgba(120, 53, 15, 0.96)');
    bGrad.addColorStop(0.5, 'rgba(180, 83, 9, 0.98)');
    bGrad.addColorStop(1, 'rgba(120, 53, 15, 0.96)');
    ctx.fillStyle = bGrad;
    ctx.fillRect(-bannerW / 2, -bannerH / 2, bannerW, bannerH);

    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 3.5;
    ctx.strokeRect(-bannerW / 2, -bannerH / 2, bannerW, bannerH);

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${isVertical ? 38 : isCorner ? 44 : 34}px "Cinzel", "Times New Roman", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 10;
    ctx.fillText('⚡ ĐANG THẾ CHẤP ⚡', 0, 0);

    ctx.restore();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * PHẦN 2: Hệ Thống 40 Lá Bài Đất Độc Lập
 * - Tách biệt hoàn toàn khỏi khung bàn cờ.
 * - 40 lá bài thực thể 3D:
 *   - Sát cạnh nhau, KHÔNG để lộ khoảng cách màu đen nào (zero-gap flush cards)
 *   - Không bị nghiêng lệch (rotZ = 0)
 *   - Ảnh và chữ 100% thẳng đứng theo hướng nhìn của người chơi (upright to camera)
 *   - Tỉ lệ ảnh được bảo toàn 100% (không méo, không bẹp, không dãn)
 *   - Tất cả 40 ô đều có tranh vẽ Harry Potter nghệ thuật cao cấp
 */
export class BoardCards {
  public group: THREE.Group;
  private cards: BoardCardItem[] = [];
  private images = new Map<number, HTMLImageElement>();
  private hoveredTileIndex: number | null = null;
  private activePlayerTileIndex: number | null = null;

  public getCards(): BoardCardItem[] {
    return this.cards;
  }

  public getFaceMeshes(): THREE.Mesh[] {
    return this.cards.map((c) => c.faceMesh);
  }

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.name = 'BoardCards_Part2';
    scene.add(this.group);

    this.buildCards();
  }

  private buildCards(): void {
    const cardThickness = 0.035;
    const baseUrl = import.meta.env.BASE_URL || '/';

    for (let i = 0; i < 40; i++) {
      const tile = HOGWARTS_TILES[i];
      const coord = getCardCoord(i);

      // Card Container Group (positioned at card center, level upright rotZ=0)
      const cardGroup = new THREE.Group();
      cardGroup.position.set(coord.x, coord.y, coord.z);
      cardGroup.userData = { tileConfig: tile, tileIndex: i };

      // 1. Base 3D Slab Mesh (Obsidian card slab)
      const baseGeom = new THREE.BoxGeometry(coord.width, coord.height, cardThickness);
      const baseMat = new THREE.MeshStandardMaterial({
        color: 0x080b12,
        roughness: 0.22,
        metalness: 0.88,
      });
      const baseMesh = new THREE.Mesh(baseGeom, baseMat);
      baseMesh.castShadow = true;
      baseMesh.receiveShadow = true;
      baseMesh.userData = { tileConfig: tile, tileIndex: i };
      cardGroup.add(baseMesh);

      // 2. Card Face Plane Mesh - Full span (Zero Gap with adjacent cards)
      const faceGeom = new THREE.PlaneGeometry(coord.width, coord.height);

      // Create initial canvas texture
      const cardTexture = createCardCanvasTexture(tile, coord.orientation, null);

      const faceMat = new THREE.MeshStandardMaterial({
        map: cardTexture,
        roughness: 0.2,
        metalness: 0.1,
        emissive: new THREE.Color(0x00f2fe),
        emissiveIntensity: 0.04,
      });

      const faceMesh = new THREE.Mesh(faceGeom, faceMat);
      faceMesh.position.set(0, 0, cardThickness / 2 + 0.002);
      faceMesh.receiveShadow = true;
      faceMesh.userData = { tileConfig: tile, tileIndex: i };
      cardGroup.add(faceMesh);

      // Load Image and update canvas texture cleanly
      const img = new Image();
      img.src = `${baseUrl}assets/cards/tile_${i}.jpg?v=unified_master`;
      img.onload = () => {
        this.images.set(i, img);
        // Re-render canvas with loaded image
        const updatedTexture = createCardCanvasTexture(tile, coord.orientation, img);
        faceMat.map = updatedTexture;
        faceMat.needsUpdate = true;
      };

      // 3. Card Glowing Neon Border Line
      const halfW = coord.width / 2;
      const halfH = coord.height / 2;
      const borderPoints = [
        new THREE.Vector3(-halfW, halfH, cardThickness / 2 + 0.003),
        new THREE.Vector3(halfW, halfH, cardThickness / 2 + 0.003),
        new THREE.Vector3(halfW, -halfH, cardThickness / 2 + 0.003),
        new THREE.Vector3(-halfW, -halfH, cardThickness / 2 + 0.003),
      ];
      const borderGeom = new THREE.BufferGeometry().setFromPoints(borderPoints);
      const borderMat = new THREE.LineBasicMaterial({
        color: 0x00f2fe,
        transparent: true,
        opacity: 0.4,
        linewidth: 2,
      });
      const borderLine = new THREE.LineLoop(borderGeom, borderMat);
      borderLine.userData = { tileConfig: tile, tileIndex: i };
      cardGroup.add(borderLine);

      this.group.add(cardGroup);

      this.cards.push({
        tile,
        coord,
        cardGroup,
        baseMesh,
        faceMesh,
        borderLine,
        borderMat,
        faceMat,
        targetZ: coord.z,
        currentZ: coord.z,
        isHovered: false,
        ownerId: null,
      });
    }
  }

  /**
   * Syncs card ownership and mortgaged visuals whenever ownership or mortgages change in the game.
   * Updates card face canvas texture (with royal house plaque / mortgaged ribbon) and 3D border neon/amber color.
   */
  public syncOwnership(
    propertyOwnership: Record<string, string>,
    players: Player[],
    mortgagedProperties: Record<string, boolean> = {}
  ): void {
    for (let i = 0; i < this.cards.length; i++) {
      const card = this.cards[i];
      const newOwnerId = propertyOwnership[card.tile.id] || null;
      const isMortgaged = !!mortgagedProperties[card.tile.id];

      if (card.ownerId !== newOwnerId || card.isMortgaged !== isMortgaged) {
        card.ownerId = newOwnerId;
        card.isMortgaged = isMortgaged;
        const owner = newOwnerId ? players.find((p) => p.id === newOwnerId) || null : null;
        const img = this.images.get(card.tile.index) || null;

        // Dispose previous texture to prevent memory leak
        if (card.faceMat.map) {
          card.faceMat.map.dispose();
        }

        const updatedTexture = createCardCanvasTexture(
          card.tile,
          card.coord.orientation,
          img,
          owner ? { name: owner.name, house: owner.house, color: owner.color } : null,
          isMortgaged
        );
        card.faceMat.map = updatedTexture;
        card.faceMat.needsUpdate = true;

        if (isMortgaged) {
          card.borderMat.color.setHex(0xd97706); // Amber caution border
          card.borderMat.opacity = 0.95;
          card.faceMat.emissive.setHex(0x92400e);
          card.faceMat.emissiveIntensity = 0.08;
        } else if (owner) {
          card.borderMat.color.set(owner.color);
          card.borderMat.opacity = 0.85;
          card.faceMat.emissive.set(owner.color);
          card.faceMat.emissiveIntensity = 0.12;
        } else {
          card.borderMat.color.setHex(0x00f2fe);
          card.borderMat.opacity = 0.4;
          card.faceMat.emissive.setHex(0x00f2fe);
          card.faceMat.emissiveIntensity = 0.04;
        }
      }
    }
  }

  public setActivePlayerTileIndex(index: number | null): void {
    this.activePlayerTileIndex = index;
  }

  public setHoveredTileIndex(index: number | null): void {
    if (this.hoveredTileIndex === index) return;
    this.hoveredTileIndex = index;

    for (let i = 0; i < this.cards.length; i++) {
      const card = this.cards[i];
      const isHovered = card.tile.index === index;
      card.isHovered = isHovered;

      if (isHovered) {
        // Tactile lift
        card.targetZ = card.coord.z + 0.07;
        card.borderMat.opacity = 1.0;
        card.faceMat.emissiveIntensity = card.ownerId ? 0.28 : 0.22;
      } else {
        card.targetZ = card.coord.z;
        const isActive = card.tile.index === this.activePlayerTileIndex;
        if (card.ownerId) {
          card.borderMat.opacity = isActive ? 1.0 : 0.85;
          card.faceMat.emissiveIntensity = isActive ? 0.2 : 0.12;
        } else {
          card.borderMat.opacity = isActive ? 0.75 : 0.4;
          card.borderMat.color.setHex(isActive ? 0xffd700 : 0x00f2fe);
          card.faceMat.emissiveIntensity = isActive ? 0.12 : 0.04;
        }
      }
    }
  }

  public update(time: number, delta: number): void {
    for (let i = 0; i < this.cards.length; i++) {
      const card = this.cards[i];

      if (!card.isHovered) {
        if (card.tile.index === this.activePlayerTileIndex) {
          card.borderMat.opacity = 0.55 + Math.sin(time * 4) * 0.35;
        } else if (card.ownerId) {
          // Subtle breathing aura in owner house color!
          card.borderMat.opacity = 0.75 + Math.sin(time * 2.5 + card.tile.index) * 0.18;
        }
      }

      if (Math.abs(card.currentZ - card.targetZ) > 0.001) {
        card.currentZ += (card.targetZ - card.currentZ) * Math.min(1, delta * 14);
        card.cardGroup.position.z = card.currentZ;
      }
    }
  }

  public dispose(): void {
    for (const card of this.cards) {
      card.baseMesh.geometry.dispose();
      (card.baseMesh.material as THREE.Material).dispose();
      card.faceMesh.geometry.dispose();
      card.faceMat.dispose();
      card.borderLine.geometry.dispose();
      card.borderMat.dispose();
    }
    this.group.clear();
  }
}
