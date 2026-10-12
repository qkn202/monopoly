import * as THREE from 'three';
import { LOW_POWER } from './quality';

export interface BoardFrameInstance {
  group: THREE.Group;
  update: (time: number, delta: number) => void;
  /** Brief brightening of the centre rune ring (dice landing). */
  flare: () => void;
  dispose: () => void;
}

const GOLD = '#e8c27a';
const GOLD_HI = '#fff0c2';

/** Engraved gold astrolabe ring: double rim with degree ticks, a band of Elder Futhark runes, diamond markers. */
function createRuneRingTexture(): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const c = size / 2;
  const R = 486;
  const ring = (r: number, w: number, a: number) => {
    ctx.strokeStyle = `rgba(232, 194, 122, ${a})`;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.stroke();
  };
  ctx.shadowColor = 'rgba(255, 214, 140, 0.55)';
  ctx.shadowBlur = 6;
  ring(R, 3, 0.95);
  ring(R - 10, 1.2, 0.7);
  // Degree ticks between the two rims: every 2.5°, longer every 15° and 45°
  for (let i = 0; i < 144; i++) {
    const a = (i / 144) * Math.PI * 2;
    const len = i % 18 === 0 ? 26 : i % 6 === 0 ? 16 : 8;
    ctx.strokeStyle = `rgba(232, 194, 122, ${i % 6 === 0 ? 0.9 : 0.5})`;
    ctx.lineWidth = i % 6 === 0 ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a) * (R - 12), c + Math.sin(a) * (R - 12));
    ctx.lineTo(c + Math.cos(a) * (R - 12 - len), c + Math.sin(a) * (R - 12 - len));
    ctx.stroke();
  }
  ring(R - 46, 1.5, 0.8);
  // Rune band
  const runes = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
  ctx.font = '600 34px "Noto Sans Runic", "Segoe UI Historic", "Apple Symbols", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowBlur = 10;
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const r = R - 72;
    ctx.save();
    ctx.translate(c + Math.cos(a) * r, c + Math.sin(a) * r);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillStyle = i % 4 === 0 ? GOLD_HI : GOLD;
    ctx.fillText(runes[i % runes.length], 0, 0);
    ctx.restore();
  }
  ring(R - 98, 2, 0.85);
  // Diamond markers on the inner rim
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + Math.PI / 12;
    const x = c + Math.cos(a) * (R - 98);
    const y = c + Math.sin(a) * (R - 98);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.fillStyle = GOLD_HI;
    ctx.beginPath();
    ctx.moveTo(0, -9); ctx.lineTo(6, 0); ctx.lineTo(0, 9); ctx.lineTo(-6, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Faint inner sigil: a thin circle with a twelve-point star (two interlaced hexagrams). */
function createSigilTexture(): THREE.CanvasTexture {
  const size = 768;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const c = size / 2;
  const R = 360;
  ctx.strokeStyle = 'rgba(232, 194, 122, 0.8)';
  ctx.shadowColor = 'rgba(255, 214, 140, 0.5)';
  ctx.shadowBlur = 5;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(c, c, R, 0, Math.PI * 2);
  ctx.stroke();
  const star = (offset: number) => {
    ctx.beginPath();
    for (let i = 0; i <= 12; i++) {
      const a = offset + (i * 5 * Math.PI * 2) / 12;
      const x = c + Math.cos(a) * R;
      const y = c + Math.sin(a) * R;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };
  ctx.lineWidth = 1.1;
  star(-Math.PI / 2);
  ctx.strokeStyle = 'rgba(232, 194, 122, 0.45)';
  ctx.beginPath();
  ctx.arc(c, c, R * 0.52, 0, Math.PI * 2);
  ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Creates a thick 3D rectangular frame border mesh with obsidian bevel and gold trim
 */
function createBorderFrameMesh(
  innerW: number,
  innerH: number,
  outerW: number,
  outerH: number,
  depth: number,
  zPos: number,
  color: number = 0x120c07,
  roughness: number = 0.22,
  metalness: number = 0.85
): THREE.Mesh {
  const shape = new THREE.Shape();
  // Outer rectangle
  shape.moveTo(-outerW / 2, -outerH / 2);
  shape.lineTo(outerW / 2, -outerH / 2);
  shape.lineTo(outerW / 2, outerH / 2);
  shape.lineTo(-outerW / 2, outerH / 2);
  shape.closePath();

  // Hole for inner rectangle
  const hole = new THREE.Path();
  hole.moveTo(-innerW / 2, -innerH / 2);
  hole.lineTo(-innerW / 2, innerH / 2);
  hole.lineTo(innerW / 2, innerH / 2);
  hole.lineTo(innerW / 2, -innerH / 2);
  hole.closePath();
  shape.holes.push(hole);

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.02,
    bevelThickness: 0.02,
  };

  const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
  });

  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.z = zPos;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Creates a rectangular LineLoop perimeter
 */
function createRectLine(halfW: number, halfH: number, z: number, color: number, opacity: number = 0.85): THREE.LineLoop {
  const points = [
    new THREE.Vector3(-halfW, halfH, z),
    new THREE.Vector3(halfW, halfH, z),
    new THREE.Vector3(halfW, -halfH, z),
    new THREE.Vector3(-halfW, -halfH, z),
  ];
  const geom = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    linewidth: 2,
  });
  return new THREE.LineLoop(geom, mat);
}

/**
 * PHẦN 1: Khung Bàn Cờ & Khu Vực Trung Tâm (Board Frame & Center Plaza)
 * - Gồm 2 hình chữ nhật:
 *   1. Khung ngoài (Outer Rectangle): Vách viền ngoài bằng đá Obsidian viền vàng kim hoàng gia & neon cyan.
 *   2. Khung trong (Inner Rectangle): Vách viền trong ngăn cách máng bài và khu trung tâm.
 *   3. Máng lọt lòng (Recessed Tray): Nằm giữa 2 hình chữ nhật, tuyệt đối KHÔNG chứa tile đất nào.
 * - Trung tâm bàn cờ:
 *   Giữ nguyên thiết kế Hogwarts Scrying Plaza với huy hiệu Hogwarts Center Crest,
 *   vòng phù chú ma thuật vàng xoay ngược chiều, vệt sáng ma thuật neon chạy quanh và sàn đổ xúc xắc 3D.
 */
export function createBoardFrame(scene: THREE.Scene): BoardFrameInstance {
  const group = new THREE.Group();
  group.name = 'BoardFrame_Part1';
  scene.add(group);

  // Exact Board Layout Geometry
  // Cards sit flush edge-to-edge from 3.96 to 5.54 (span = 1.58).
  // Inner Frame sits at [3.71, 3.96] (width = 0.25)
  // Outer Frame sits at [5.54, 5.84] (width = 0.30)
  const innerFrameInner = 7.42; // 3.71 * 2
  const innerFrameOuter = 7.92; // 3.96 * 2

  const outerFrameInner = 11.08; // 5.54 * 2
  const outerFrameOuter = 11.68; // 5.84 * 2

  // 1. Outer Frame (Khung Chữ Nhật Ngoài)
  const outerMesh = createBorderFrameMesh(
    outerFrameInner,
    outerFrameInner,
    outerFrameOuter,
    outerFrameOuter,
    0.14,
    -0.07,
    0x130d08,
    0.2,
    0.9
  );
  group.add(outerMesh);

  // Outer Gold & Cyan Trim Lines
  const outerGoldLine = createRectLine(outerFrameOuter / 2, outerFrameOuter / 2, 0.08, 0xf3d189, 0.9);
  const outerCyanLine = createRectLine(outerFrameInner / 2, outerFrameInner / 2, 0.075, 0xe2b866, 0.8);
  group.add(outerGoldLine);
  group.add(outerCyanLine);

  // 2. Inner Frame (Khung Chữ Nhật Trong)
  const innerMesh = createBorderFrameMesh(
    innerFrameInner,
    innerFrameInner,
    innerFrameOuter,
    innerFrameOuter,
    0.12,
    -0.06,
    0x150f09,
    0.24,
    0.85
  );
  group.add(innerMesh);

  // Inner Gold & Cyan Trim Lines
  const innerCyanLine = createRectLine(innerFrameOuter / 2, innerFrameOuter / 2, 0.065, 0xe2b866, 0.85);
  const innerGoldLine = createRectLine(innerFrameInner / 2, innerFrameInner / 2, 0.065, 0xf3d189, 0.95);
  group.add(innerCyanLine);
  group.add(innerGoldLine);

  // 3. Recessed Tray Floor (Đáy máng nằm lọt lòng giữa 2 hình chữ nhật)
  // Clean obsidian floor between innerFrameOuter and outerFrameInner.
  // Contains NO property tiles! Pure sleek textured obsidian base tray.
  const trayMesh = createBorderFrameMesh(
    innerFrameOuter,
    innerFrameOuter,
    outerFrameInner,
    outerFrameInner,
    0.04,
    -0.04,
    0x0a0604,
    0.35,
    0.7
  );
  group.add(trayMesh);

  // Base Bottom Slab (Nền móng tổng thể bàn cờ)
  const baseGeom = new THREE.BoxGeometry(outerFrameOuter + 0.2, outerFrameOuter + 0.2, 0.16);
  // warm dark walnut, so the board sits on the HPVN brown stage instead of a black slab
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x2a1a0c,
    roughness: 0.62,
    metalness: 0.25,
  });
  const baseMesh = new THREE.Mesh(baseGeom, baseMat);
  baseMesh.position.z = -0.15;
  baseMesh.receiveShadow = true;
  group.add(baseMesh);

  // 4. TRUNG TÂM BÀN CỜ (Center Plaza - Thiết kế giữ nguyên như cũ)
  // Perfectly fills the entire interior of the Inner Frame (halfW = 3.71, span = 7.42)
  const centerHalfW = 3.71;
  const centerHalfH = 3.71;

  // 4.1 Centre "table": matte leather with a soft vignette, so the dice and cards are the only bright things.
  const leather = document.createElement('canvas');
  leather.width = leather.height = 512;
  const lctx = leather.getContext('2d')!;
  const vignette = lctx.createRadialGradient(256, 236, 40, 256, 256, 360);
  vignette.addColorStop(0, '#3a2613');
  vignette.addColorStop(0.65, '#21150a');
  vignette.addColorStop(1, '#120b05');
  lctx.fillStyle = vignette;
  lctx.fillRect(0, 0, 512, 512);
  const leatherTexture = new THREE.CanvasTexture(leather);
  leatherTexture.colorSpace = THREE.SRGBColorSpace;
  const centerFloorGeom = new THREE.PlaneGeometry(centerHalfW * 2, centerHalfH * 2);
  const centerFloorMat = new THREE.MeshStandardMaterial({ map: leatherTexture, roughness: 0.9, metalness: 0.05 });
  const centerFloorMesh = new THREE.Mesh(centerFloorGeom, centerFloorMat);
  centerFloorMesh.position.set(0, 0, 0.005);
  centerFloorMesh.receiveShadow = true;
  group.add(centerFloorMesh);

  // 4.2 Crest as a faint watermark (no pulsing glow)
  const textureLoader = new THREE.TextureLoader();
  const crestUrl = (import.meta.env.BASE_URL || '/') + 'hogwarts_center_crest.webp';
  const emblemTexture = textureLoader.load(crestUrl);
  emblemTexture.colorSpace = THREE.SRGBColorSpace;
  const emblemGeom = new THREE.PlaneGeometry(5.4, 5.4);
  const emblemMat = new THREE.MeshBasicMaterial({ map: emblemTexture, transparent: true, opacity: 0.16, depthWrite: false });
  const emblemMesh = new THREE.Mesh(emblemGeom, emblemMat);
  emblemMesh.position.set(0, 0.25, 0.012);
  group.add(emblemMesh);

  // 4.3 One thin gold edge around the table
  const centerBorderLine = createRectLine(centerHalfW, centerHalfH, 0.016, 0xe2b866, 0.45);
  group.add(centerBorderLine);

  // 4.4 Desktop only: engraved rune ring + inner sigil, slow counter-rotation, gentle breathing,
  // flaring when the dice land. Phones skip it (additive full-plaza planes cost fill rate there).
  let ringTexture: THREE.CanvasTexture | null = null;
  let sigilTexture: THREE.CanvasTexture | null = null;
  let ringMat: THREE.MeshBasicMaterial | null = null;
  let sigilMat: THREE.MeshBasicMaterial | null = null;
  let ringMesh: THREE.Mesh | null = null;
  let sigilMesh: THREE.Mesh | null = null;
  const ringGeom = new THREE.PlaneGeometry(7.0, 7.0);
  const sigilGeom = new THREE.PlaneGeometry(4.9, 4.9);
  if (!LOW_POWER) {
    ringTexture = createRuneRingTexture();
    sigilTexture = createSigilTexture();
    const additive = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false } as const;
    ringMat = new THREE.MeshBasicMaterial({ map: ringTexture, opacity: 0.5, ...additive });
    sigilMat = new THREE.MeshBasicMaterial({ map: sigilTexture, opacity: 0.22, ...additive });
    ringMesh = new THREE.Mesh(ringGeom, ringMat);
    sigilMesh = new THREE.Mesh(sigilGeom, sigilMat);
    ringMesh.position.set(0, 0, 0.02);
    sigilMesh.position.set(0, 0, 0.018);
    group.add(ringMesh, sigilMesh);
  }
  let flareLevel = 0;
  let spin = 0;

  return {
    group,
    update: (time: number, delta: number) => {
      if (!ringMesh || !sigilMesh || !ringMat || !sigilMat) return;
      flareLevel = Math.max(0, flareLevel - delta * 1.1);
      spin += delta * (0.045 + flareLevel * 0.6);
      ringMesh.rotation.z = spin;
      sigilMesh.rotation.z = -spin * 1.6;
      const breathe = 0.5 + Math.sin(time * 1.3) * 0.5;
      ringMat.opacity = 0.56 + breathe * 0.12 + flareLevel * 0.4;
      sigilMat.opacity = 0.2 + breathe * 0.1 + flareLevel * 0.45;
      const s = 1 + flareLevel * 0.03;
      ringMesh.scale.set(s, s, 1);
    },
    flare: () => {
      flareLevel = 1;
    },
    dispose: () => {
      scene.remove(group);
      outerMesh.geometry.dispose();
      (outerMesh.material as THREE.Material).dispose();
      innerMesh.geometry.dispose();
      (innerMesh.material as THREE.Material).dispose();
      trayMesh.geometry.dispose();
      (trayMesh.material as THREE.Material).dispose();
      baseMesh.geometry.dispose();
      (baseMesh.material as THREE.Material).dispose();
      centerFloorGeom.dispose();
      centerFloorMat.dispose();
      leatherTexture.dispose();
      emblemGeom.dispose();
      emblemMat.dispose();
      emblemTexture.dispose();
      ringGeom.dispose();
      sigilGeom.dispose();
      ringMat?.dispose();
      sigilMat?.dispose();
      ringTexture?.dispose();
      sigilTexture?.dispose();
    },
  };
}
