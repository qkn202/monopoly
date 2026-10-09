import * as THREE from 'three';

export interface BoardFrameInstance {
  group: THREE.Group;
  update: (time: number, delta: number) => void;
  dispose: () => void;
}

/**
 * Calculates a point along the rectangular perimeter of the center panel.
 */
function getRectPoint(distance: number, hw: number, hh: number, totalLen: number): THREE.Vector3 {
  let d = ((distance % totalLen) + totalLen) % totalLen;
  const w = hw * 2;
  const h = hh * 2;

  if (d < w) {
    return new THREE.Vector3(-hw + d, hh, 0.035);
  }
  d -= w;
  if (d < h) {
    return new THREE.Vector3(hw, hh - d, 0.035);
  }
  d -= h;
  if (d < w) {
    return new THREE.Vector3(hw - d, -hh, 0.035);
  }
  d -= w;
  return new THREE.Vector3(-hw, -hh + d, 0.035);
}

/**
 * Generates an ancient gothic magic rune circle texture
 */
function createMagicRuneRingTexture(innerR: number, outerR: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  const cx = 512;
  const cy = 512;
  const radius = 460;

  ctx.clearRect(0, 0, 1024, 1024);

  // Outer golden rings
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#00f2fe';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, radius - 16, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, radius - 45, 0, Math.PI * 2);
  ctx.stroke();

  // Runes glyphs
  const runes = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ⚡⚔⚖⚜✦✧★⚝';
  ctx.font = 'bold 30px "Cinzel", "Times New Roman", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const count = 36;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const r = radius - 30;
    const gx = cx + Math.cos(angle) * r;
    const gy = cy + Math.sin(angle) * r;

    ctx.save();
    ctx.translate(gx, gy);
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillStyle = i % 2 === 0 ? '#ffd700' : '#4facfe';
    ctx.shadowColor = '#00f2fe';
    ctx.shadowBlur = 8;
    ctx.fillText(runes[i % runes.length], 0, 0);
    ctx.restore();
  }

  // Inner geometric magic octagon
  ctx.strokeStyle = 'rgba(255, 215, 0, 0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  const octPoints = 8;
  for (let i = 0; i <= octPoints; i++) {
    const angle = (i / octPoints) * Math.PI * 2;
    const r = radius - 70;
    const ox = cx + Math.cos(angle) * r;
    const oy = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(ox, oy);
    else ctx.lineTo(ox, oy);
  }
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
  color: number = 0x090c14,
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
    0x0a0d14,
    0.2,
    0.9
  );
  group.add(outerMesh);

  // Outer Gold & Cyan Trim Lines
  const outerGoldLine = createRectLine(outerFrameOuter / 2, outerFrameOuter / 2, 0.08, 0xffd700, 0.9);
  const outerCyanLine = createRectLine(outerFrameInner / 2, outerFrameInner / 2, 0.075, 0x00f2fe, 0.8);
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
    0x0c0f18,
    0.24,
    0.85
  );
  group.add(innerMesh);

  // Inner Gold & Cyan Trim Lines
  const innerCyanLine = createRectLine(innerFrameOuter / 2, innerFrameOuter / 2, 0.065, 0x00f2fe, 0.85);
  const innerGoldLine = createRectLine(innerFrameInner / 2, innerFrameInner / 2, 0.065, 0xffd700, 0.95);
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
    0x05070c,
    0.35,
    0.7
  );
  group.add(trayMesh);

  // Base Bottom Slab (Nền móng tổng thể bàn cờ)
  const baseGeom = new THREE.BoxGeometry(outerFrameOuter + 0.2, outerFrameOuter + 0.2, 0.16);
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x030408,
    roughness: 0.4,
    metalness: 0.9,
  });
  const baseMesh = new THREE.Mesh(baseGeom, baseMat);
  baseMesh.position.z = -0.15;
  baseMesh.receiveShadow = true;
  group.add(baseMesh);

  // 4. TRUNG TÂM BÀN CỜ (Center Plaza - Thiết kế giữ nguyên như cũ)
  // Perfectly fills the entire interior of the Inner Frame (halfW = 3.71, span = 7.42)
  const centerHalfW = 3.71;
  const centerHalfH = 3.71;
  const perimeter = 2 * (centerHalfW * 2 + centerHalfH * 2); // 29.68 units

  // 4.1 Center Obsidian Floor Slab (Spans the entire inner rectangle)
  const centerFloorGeom = new THREE.PlaneGeometry(centerHalfW * 2, centerHalfH * 2);
  const centerFloorMat = new THREE.MeshStandardMaterial({
    color: 0x09101d,
    roughness: 0.28,
    metalness: 0.85,
  });
  const centerFloorMesh = new THREE.Mesh(centerFloorGeom, centerFloorMat);
  centerFloorMesh.position.set(0, 0, 0.005);
  centerFloorMesh.receiveShadow = true;
  group.add(centerFloorMesh);

  // Subtle interior stepped border lines
  const centerSteppedLine1 = createRectLine(centerHalfW - 0.15, centerHalfH - 0.15, 0.012, 0xd4af37, 0.65);
  const centerSteppedLine2 = createRectLine(centerHalfW - 0.35, centerHalfH - 0.35, 0.010, 0x00f2fe, 0.35);
  group.add(centerSteppedLine1);
  group.add(centerSteppedLine2);

  // 4.2 Exact Center Hogwarts Crest Emblem Mesh
  const textureLoader = new THREE.TextureLoader();
  const crestUrl = (import.meta.env.BASE_URL || '/') + 'hogwarts_center_crest.jpg';

  const emblemTexture = textureLoader.load(crestUrl);
  emblemTexture.colorSpace = THREE.SRGBColorSpace;

  const emblemGeom = new THREE.PlaneGeometry(4.8, 4.8);
  const emblemMat = new THREE.MeshStandardMaterial({
    map: emblemTexture,
    roughness: 0.15,
    metalness: 0.75,
    emissive: new THREE.Color(0x00f2fe),
    emissiveMap: emblemTexture,
    emissiveIntensity: 0.32,
  });
  const emblemMesh = new THREE.Mesh(emblemGeom, emblemMat);
  emblemMesh.position.set(0, 0, 0.015);
  group.add(emblemMesh);

  // 4.3 Center Perimeter Cyan Border Line
  const centerBorderLine = createRectLine(centerHalfW, centerHalfH, 0.02, 0x00f2fe, 0.75);
  group.add(centerBorderLine);

  // 4.4 Dynamic Neon Running Tracers along the Center Rectangle
  const TRAIL_SEGMENTS = 36;
  const TRAIL_LENGTH = 3.2;

  // Pulse 1 (Clockwise)
  const trailPositions1 = new Float32Array(TRAIL_SEGMENTS * 3);
  const trailColors1 = new Float32Array(TRAIL_SEGMENTS * 3);
  const trailGeom1 = new THREE.BufferGeometry();
  trailGeom1.setAttribute('position', new THREE.BufferAttribute(trailPositions1, 3));
  trailGeom1.setAttribute('color', new THREE.BufferAttribute(trailColors1, 3));

  const trailMat1 = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    linewidth: 3,
  });
  const trailLine1 = new THREE.Line(trailGeom1, trailMat1);
  group.add(trailLine1);

  // Pulse 2 (Opposite Phase)
  const trailPositions2 = new Float32Array(TRAIL_SEGMENTS * 3);
  const trailColors2 = new Float32Array(TRAIL_SEGMENTS * 3);
  const trailGeom2 = new THREE.BufferGeometry();
  trailGeom2.setAttribute('position', new THREE.BufferAttribute(trailPositions2, 3));
  trailGeom2.setAttribute('color', new THREE.BufferAttribute(trailColors2, 3));

  const trailMat2 = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    linewidth: 3,
  });
  const trailLine2 = new THREE.Line(trailGeom2, trailMat2);
  group.add(trailLine2);

  // 4.5 Dual Concentric Rotating Magic Rune Rings
  const runeTexture = createMagicRuneRingTexture(2.8, 5.0);
  const runeGeom = new THREE.PlaneGeometry(6.6, 6.6);
  const runeMat1 = new THREE.MeshBasicMaterial({
    map: runeTexture,
    transparent: true,
    opacity: 0.60,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const runeMesh1 = new THREE.Mesh(runeGeom, runeMat1);
  runeMesh1.position.set(0, 0, 0.022);
  group.add(runeMesh1);

  const runeMat2 = new THREE.MeshBasicMaterial({
    map: runeTexture,
    transparent: true,
    opacity: 0.40,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const runeMesh2 = new THREE.Mesh(runeGeom, runeMat2);
  runeMesh2.scale.set(0.78, 0.78, 1);
  runeMesh2.position.set(0, 0, 0.025);
  group.add(runeMesh2);

  return {
    group,
    update: (time: number, _delta: number) => {
      // 1. Slow, hypnotic rotation of dual magic rune rings
      runeMesh1.rotation.z = time * 0.12;
      runeMesh2.rotation.z = -time * 0.18;

      // 2. Pulse emblem magic emission
      emblemMat.emissiveIntensity = 0.28 + Math.sin(time * 3) * 0.12;

      // 3. Update Running Neon Tracers along the Center Perimeter
      const speed = 2.4; // Units per second
      const headDist1 = (time * speed) % perimeter;
      const headDist2 = (headDist1 + perimeter * 0.5) % perimeter;

      const posAttr1 = trailGeom1.attributes.position as THREE.BufferAttribute;
      const colAttr1 = trailGeom1.attributes.color as THREE.BufferAttribute;
      const posAttr2 = trailGeom2.attributes.position as THREE.BufferAttribute;
      const colAttr2 = trailGeom2.attributes.color as THREE.BufferAttribute;

      const cyanColor = new THREE.Color(0x00f2fe);
      const goldColor = new THREE.Color(0xffd700);

      for (let i = 0; i < TRAIL_SEGMENTS; i++) {
        const segFrac = i / (TRAIL_SEGMENTS - 1);
        const trailOffset = segFrac * TRAIL_LENGTH;

        // Trail 1
        const pt1 = getRectPoint(headDist1 - trailOffset, centerHalfW, centerHalfH, perimeter);
        posAttr1.setXYZ(i, pt1.x, pt1.y, pt1.z);
        const brightness1 = Math.pow(1 - segFrac, 1.8);
        const c1 = cyanColor.clone().multiplyScalar(brightness1);
        colAttr1.setXYZ(i, c1.r, c1.g, c1.b);

        // Trail 2
        const pt2 = getRectPoint(headDist2 - trailOffset, centerHalfW, centerHalfH, perimeter);
        posAttr2.setXYZ(i, pt2.x, pt2.y, pt2.z);
        const brightness2 = Math.pow(1 - segFrac, 1.8);
        const c2 = goldColor.clone().multiplyScalar(brightness2);
        colAttr2.setXYZ(i, c2.r, c2.g, c2.b);
      }

      posAttr1.needsUpdate = true;
      colAttr1.needsUpdate = true;
      posAttr2.needsUpdate = true;
      colAttr2.needsUpdate = true;
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
      emblemGeom.dispose();
      emblemMat.dispose();
      emblemTexture.dispose();
      runeGeom.dispose();
      runeMat1.dispose();
      runeMat2.dispose();
      runeTexture.dispose();
      trailGeom1.dispose();
      trailMat1.dispose();
      trailGeom2.dispose();
      trailMat2.dispose();
    },
  };
}
