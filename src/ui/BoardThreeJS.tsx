import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { LOW_POWER, viewScale } from '../render/quality';
import { flooCovers } from '../hpvn/bridge';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GameState, TileConfig, Player } from '../core/types';
import { HOGWARTS_TILES } from '../core/boardData';
import { createBoardFrame, BoardFrameInstance } from '../render/BoardFrame';
import { PlayerTokenManager, getTilePosition } from '../render/BoardTokens';
import { BoardCards } from '../render/BoardCards';
import { getCardCoord } from '../render/BoardCoordinates';
import { BoardBuildingManager } from '../render/BoardBuildings';
import { Board3DDice } from '../render/Board3DDice';
import { BoardParticleSystem } from '../render/BoardParticles';
import { CardInspectModal } from './CardInspectModal';
import { LeaderboardHud } from './LeaderboardHud';
import { soundManager } from '../audio/soundManager';
import { calculateTakeoverCost } from '../core/rulesEngine';
import './BoardThreeJS.css';
import { g, galleons } from '../hpvn/money';

interface BoardThreeJSProps {
  gameState: GameState;
  myPlayerId?: string;
}

export interface HoveredTileInfo {
  tile: TileConfig;
  owner: Player | null;
}

export interface PurchaseNotice {
  id: number;
  tile: TileConfig;
  owner: Player;
  prevOwner?: Player | null;
  isTakeover?: boolean;
}

export interface RentNotice {
  id: number;
  debtor: Player;
  creditor?: Player | null;
  amount: number;
  tile: TileConfig;
  isTax?: boolean;
}

export function BoardThreeJS({ gameState, myPlayerId }: BoardThreeJSProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [hoveredTileInfo, setHoveredTileInfo] = useState<HoveredTileInfo | null>(null);
  const [purchaseNotice, setPurchaseNotice] = useState<PurchaseNotice | null>(null);
  const [rentNotice, setRentNotice] = useState<RentNotice | null>(null);
  const [rollBadge, setRollBadge] = useState<{ id: number; total: number; double: boolean } | null>(null);
  const [inspectedTile, setInspectedTile] = useState<TileConfig | null>(null);
  const [currentView, setCurrentView] = useState<'follow' | 'overview' | 'topdown'>('overview');
  const currentViewRef = useRef<'follow' | 'overview' | 'topdown'>('overview');
  const prevRentPaymentRef = useRef<number>(0);

  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cardMeshesRef = useRef<BoardCards | null>(null);
  const boardFrameRef = useRef<BoardFrameInstance | null>(null);
  const tokenManagerRef = useRef<PlayerTokenManager | null>(null);
  const buildingManagerRef = useRef<BoardBuildingManager | null>(null);
  const dice3DRef = useRef<Board3DDice | null>(null);
  const particlesRef = useRef<BoardParticleSystem | null>(null);

  // Keep fresh reference to gameState for mouse handlers without re-binding
  const gameStateRef = useRef<GameState>(gameState);
  gameStateRef.current = gameState;

  // Keep currentViewRef in sync with currentView state for use in event handlers
  useEffect(() => {
    currentViewRef.current = currentView;
  }, [currentView]);
  const turboRef = useRef<boolean>(!!gameState.turboMode);
  turboRef.current = !!gameState.turboMode;

  // Target camera interpolation vectors for buttery-smooth broadcast glide
  const targetCamPos = useRef(new THREE.Vector3(0, -10.5, 13.2));
  const targetLookAt = useRef(new THREE.Vector3(0, -0.4, 0.1));
  const targetUpVec = useRef(new THREE.Vector3(0, 1, 0));
  const isUserInteracting = useRef(false);

  // Previous state trackers for sound & VFX triggers
  const prevDiceRef = useRef<{ die1: number; die2: number } | null>(null);
  const prevCardRef = useRef<unknown>(null);
  const prevAuctionRef = useRef<boolean>(false);
  const prevOwnershipRef = useRef<Record<string, string>>({});
  const prevHouseCountRef = useRef<number>(0);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene setup
    (window as any).THREE = THREE;
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // 2. Camera setup - 2.5D Overview Tilt initial position (with portrait adaptation)
    const aspect = container.clientWidth / container.clientHeight;
    const portraitScale = viewScale(aspect);
    const camera = new THREE.PerspectiveCamera(44, aspect, 0.1, 100);
    camera.position.set(0, -11.0 * portraitScale, 13.8 * portraitScale);
    cameraRef.current = camera;
    (window as any).__threeCamera = camera;
    (window as any).__targetCamPos = targetCamPos;
    (window as any).__targetLookAt = targetLookAt;

    // 3. Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: !LOW_POWER, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(container.clientWidth, container.clientHeight, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, LOW_POWER ? 1.5 : 1.75));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.touchAction = 'none';
    container.appendChild(renderer.domElement);

    // 4. OrbitControls - DISABLED ROTATION, ONLY ZOOM + PAN TO TARGET
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.minDistance = 3;   // Allow zooming in closer
    controls.maxDistance = 46;  // HPVN: the overview sits 24-44 away (viewScale); 12 clamped it and cropped the board
    controls.zoomSpeed = 0.8;
    controls.enableRotate = false; // DISABLE rotation - only zoom allowed
    controls.enablePan = false;  // DISABLE pan - stay focused on board center
    // HPVN: no minPolarAngle — the overview tilt (~37°) and the top-down view sit below upstream's 45°
    controls.maxPolarAngle = Math.PI / 2 - 0.05; // HPVN: upstream π/2.2 clamped the overview and cropped the top row
    controls.target.set(0, 0.0, 0);
    controlsRef.current = controls;
    // A zoom sticks: the camera lerp stops while the user zooms and continues from where they left it
    const handleControlsStart = () => {
      isUserInteracting.current = true;
    };
    const handleControlsEnd = () => {
      isUserInteracting.current = false;
      targetCamPos.current.copy(camera.position);
      targetLookAt.current.copy(controls.target);
    };
    controls.addEventListener('start', handleControlsStart);
    controls.addEventListener('end', handleControlsEnd);

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.1);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff1dc, 2.8);
    sunLight.position.set(10, -10, 15);
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x00e5ff, 2.2);
    rimLight.position.set(-10, 10, 8);
    scene.add(rimLight);

    const centerPoint = new THREE.PointLight(0xe2b866, 4.2, 12);
    centerPoint.position.set(0, 0, 1.8);
    scene.add(centerPoint);

    // 6. PHẦN 2: Hệ Thống 40 Lá Bài Đất Độc Lập
    const cards = new BoardCards(scene);
    cardMeshesRef.current = cards;
    setLoading(false);

    // 7. Raycasting for hover tooltip & card click inspection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let raycastPending = false;

    const findHitTile = (clientX: number, clientY: number): TileConfig | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);

      // 1. Pixel-perfect direct raycast on the 40 card face meshes
      const faceMeshes = cards.getFaceMeshes();
      const faceIntersects = raycaster.intersectObjects(faceMeshes, false);
      if (faceIntersects.length > 0 && faceIntersects[0].object.userData?.tileConfig) {
        return faceIntersects[0].object.userData.tileConfig as TileConfig;
      }

      // 2. Fallback: Raycast scene for player tokens / buildings on tiles
      const sceneIntersects = raycaster.intersectObjects(scene.children, true);
      for (const hit of sceneIntersects) {
        let hitObj: THREE.Object3D | null = hit.object;
        while (
          hitObj &&
          !hitObj.userData?.tileConfig &&
          hitObj.userData?.tileIndex === undefined &&
          hitObj.parent &&
          hitObj.parent !== scene
        ) {
          hitObj = hitObj.parent;
        }
        if (hitObj) {
          if (hitObj.userData?.tileConfig) {
            return hitObj.userData.tileConfig as TileConfig;
          }
          if (typeof hitObj.userData?.tileIndex === 'number') {
            return HOGWARTS_TILES[hitObj.userData.tileIndex] || null;
          }
        }
      }

      return null;
    };

    let pointerDownPos = { x: 0, y: 0, time: 0 };

    const handlePointerDown = (event: PointerEvent) => {
      pointerDownPos = { x: event.clientX, y: event.clientY, time: performance.now() };
    };

    const handlePointerUp = (event: PointerEvent) => {
      const dist = Math.hypot(event.clientX - pointerDownPos.x, event.clientY - pointerDownPos.y);
      const duration = performance.now() - pointerDownPos.time;
      // If movement is minimal (< 8px) and duration is under 600ms, it is a genuine click/tap!
      if (dist < 8 && duration < 600) {
        const tile = findHitTile(event.clientX, event.clientY);
        if (tile) {
          soundManager.playSpellCard();
          setInspectedTile(tile);
        }
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (raycastPending) return;
      raycastPending = true;

      requestAnimationFrame(() => {
        raycastPending = false;
        if (!mountRef.current) return;

        const tile = findHitTile(event.clientX, event.clientY);
        if (tile) {
          cards.setHoveredTileIndex(tile.index);
          const curState = gameStateRef.current;
          const ownerId = curState.propertyOwnership[tile.id];
          const owner = ownerId ? curState.players.find((p) => p.id === ownerId) || null : null;

          setHoveredTileInfo({ tile, owner });
          renderer.domElement.style.cursor = 'pointer';
        } else {
          cards.setHoveredTileIndex(null);
          setHoveredTileInfo(null);
          renderer.domElement.style.cursor = 'default';
        }
      });
    };

    const handleClick = (event: MouseEvent) => {
      const tile = findHitTile(event.clientX, event.clientY);
      if (tile) {
        soundManager.playSpellCard();
        setInspectedTile(tile);
      }
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);
    renderer.domElement.addEventListener('mousemove', handleMouseMove);
    renderer.domElement.addEventListener('click', handleClick);

    // Dev test helper
    (window as any).__findHitTile = findHitTile;
    (window as any).__setInspectedTile = setInspectedTile;
    (window as any).__cards = cards;
    (window as any).__camera = camera;
    (window as any).__renderer = renderer;
    (window as any).__testAllCards = () => {
      const allCards = cards.getCards();
      const rect = renderer.domElement.getBoundingClientRect();
      const results = [];
      for (let i = 0; i < allCards.length; i++) {
        const item = allCards[i];
        const worldPos = new THREE.Vector3();
        item.faceMesh.getWorldPosition(worldPos);
        const screenPos = worldPos.clone().project(camera);
        const clientX = ((screenPos.x + 1) / 2) * rect.width + rect.left;
        const clientY = ((-screenPos.y + 1) / 2) * rect.height + rect.top;
        const hit = findHitTile(clientX, clientY);
        results.push({
          index: i,
          name: item.tile.name,
          hitIndex: hit ? hit.index : null,
          hitName: hit ? hit.name : null,
          success: !!hit && hit.index === i,
        });
      }
      return {
        total: results.length,
        successCount: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success),
      };
    };

    // 8. PHẦN 1: Khung Bàn Cờ 2 Hình Chữ Nhật & Trung Tâm Hogwarts Ma Thuật
    const boardFrame = createBoardFrame(scene);
    boardFrameRef.current = boardFrame;

    // 9. 3D Player Tokens Manager
    const tokenManager = new PlayerTokenManager(scene);
    tokenManagerRef.current = tokenManager;
    tokenManager.syncPlayers(gameState.players);

    // 10. 3D Property Buildings Manager (Cottages, Castles & Ownership Monuments)
    const buildingManager = new BoardBuildingManager(scene);
    buildingManagerRef.current = buildingManager;
    buildingManager.syncBuildings(gameState.players, gameState.propertyOwnership);

    // 11. 3D Rolling Dice Mesh & Physics
    const dice3D = new Board3DDice(scene, (center) => {
      particlesRef.current?.spawnBurst(center, '#f3d189', LOW_POWER ? 50 : 110);
      boardFrameRef.current?.flare();
      const d = prevDiceRef.current;
      if (d) setRollBadge({ id: Date.now(), total: d.die1 + d.die2, double: d.die1 === d.die2 });
    });
    dice3DRef.current = dice3D;

    // 12. 3D Magical Particle Spells System
    const particles = new BoardParticleSystem(scene);
    particlesRef.current = particles;

    // Handle Window Resize & Device Orientation Changes
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (!w || !h) return;
      const asp = w / h;
      camera.aspect = asp;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false); // size the drawing buffer only: CSS sizes the canvas, so a shrinking stage can shrink

      // Only reset to overview position on resize if user is not actively interacting
      // This prevents follow mode from snapping to overview on window resize
      if (!isUserInteracting.current && currentViewRef.current === 'overview') {
        const portScale = viewScale(asp);
        targetCamPos.current.set(0, -11.0 * portScale, 13.8 * portScale);
        targetLookAt.current.set(0, 0.0, 0.0);
      }
    };
    window.addEventListener('resize', handleResize);
    // The stage also changes size without a window resize (phone dock growing with a decision, HPVN's Floo
    // column opening, layout switch): a stale canvas cropped the board and put taps on the wrong tile.
    const stageObserver = new ResizeObserver(handleResize);
    stageObserver.observe(container);

    // Animation Loop
    let animId: number;
    let lastTime = performance.now();
    const animate = () => {
      animId = requestAnimationFrame(animate);
      const now = performance.now();
      const deltaTime = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      controls.update();

      const time = Date.now() * 0.002;

      // Pulse central light
      centerPoint.intensity = 2.8 + Math.sin(time * 2) * 0.8;

      // Update 40 Individual 3D Cards Physics & Glow
      cards.update(time, deltaTime);

      // Update Part 1 Board Frame & Center Surface Effects
      boardFrame.update(time, deltaTime);

      // Update 3D Player Tokens (accelerated in turbo mode)
      tokenManager.update(deltaTime, turboRef.current ? 2.2 : 1.0);

      // Update 3D Dice physics (accelerated in turbo mode)
      dice3D.update(deltaTime, turboRef.current ? 2.2 : 1.0);

      // Update Particle Spells
      particles.update(deltaTime);

      // Update 3D Property Buildings & Ownership Figures
      buildingManager.update(time, deltaTime);

      // FOLLOW MODE: Update camera to track animated token position in real-time
      if (currentViewRef.current === 'follow' && !isUserInteracting.current) {
        const gs = gameStateRef.current;
        const curP = gs.players[gs.currentPlayerIndex];
        if (curP) {
          // Get the ACTUAL animated position of the token (where it currently is, not where it's going)
          const animPos = tokenManager.getAnimatedTokenPosition(curP.id);
          if (animPos) {
            // Flat close-up view following token's actual position
            const followZ = 6.0;
            targetCamPos.current.set(animPos.x * 0.5, animPos.y * 0.5 - 6, followZ);
            targetLookAt.current.set(animPos.x, animPos.y, 0);
            targetUpVec.current.set(0, 1, 0);
          }
        }
      }

      // Smooth camera interpolation towards active target (only zoom, no rotation)
      if (!isUserInteracting.current) {
        if (camera.position.distanceTo(targetCamPos.current) > 0.01) {
          camera.position.lerp(targetCamPos.current, 0.06);
        }
        if (controls.target.distanceTo(targetLookAt.current) > 0.01) {
          controls.target.lerp(targetLookAt.current, 0.06);
        }
        if (camera.up.distanceTo(targetUpVec.current) > 0.01) {
          camera.up.lerp(targetUpVec.current, 0.06);
        }
      }

      // nothing to draw while HPVN's Floo panel covers the board on a phone
      if (!flooCovers()) renderer.render(scene, camera);
    };
    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      stageObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('mousemove', handleMouseMove);
      renderer.domElement.removeEventListener('click', handleClick);
      controls.dispose();
      renderer.dispose();
      cards.dispose();
      boardFrame.dispose();
      tokenManager.dispose();
      buildingManager.dispose();
      dice3D.dispose();
      particles.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Sync token, card aura, ownership & building positions whenever players or propertyOwnership change
  useEffect(() => {
    tokenManagerRef.current?.syncPlayers(gameState.players);

    // Update current player highlight (new HUD feature)
    const curPlayer = gameState.players[gameState.currentPlayerIndex];
    if (curPlayer) {
      tokenManagerRef.current?.setCurrentPlayer(curPlayer.id);
      cardMeshesRef.current?.setActivePlayerTileIndex(curPlayer.position);
    }

    buildingManagerRef.current?.syncBuildings(gameState.players, gameState.propertyOwnership, gameState.mortgagedProperties);

    // Sync card ownership visual representation on 3D deed cards (canvas textures + neon border glow + mortgaged banner)
    cardMeshesRef.current?.syncOwnership(gameState.propertyOwnership, gameState.players, gameState.mortgagedProperties);

    // Detect newly acquired properties to trigger card particle burst, audio chime & announcement toast
    const prevOwnership = prevOwnershipRef.current;
    const currentOwnership = gameState.propertyOwnership;

    for (const [tileId, ownerId] of Object.entries(currentOwnership)) {
      if (prevOwnership[tileId] !== ownerId) {
        const tile = HOGWARTS_TILES.find((t) => t.id === tileId);
        const owner = gameState.players.find((p) => p.id === ownerId);
        const prevOwnerId = prevOwnership[tileId];
        const prevOwner = prevOwnerId ? gameState.players.find((p) => p.id === prevOwnerId) : null;
        if (tile && owner) {
          const isTakeover = !!prevOwner && prevOwner.id !== owner.id && !prevOwner.isBankrupt;

          // 1. Magical spell burst directly over the purchased card!
          const coord = getCardCoord(tile.index);
          particlesRef.current?.spawnBurst(new THREE.Vector3(coord.x, coord.y, 0.25), owner.color, 90);
          if (isTakeover) {
            setTimeout(() => {
              particlesRef.current?.spawnBurst(new THREE.Vector3(coord.x, coord.y, 0.35), '#f3d189', 100);
            }, 140);
          }

          // 2. Play acquisition fanfare
          soundManager.playBuyProperty();

          // 3. Trigger Grand Announcement Banner
          setPurchaseNotice({
            id: Date.now() + Math.random(),
            tile,
            owner,
            prevOwner,
            isTakeover,
          });
        }
      }
    }
    prevOwnershipRef.current = { ...currentOwnership };

    // Track houses built
    const totalHouses = gameState.players.reduce((sum, p) => {
      const hCount = Object.values(p.houses).reduce((a, b) => a + b, 0);
      const hotCount = Object.values(p.hotels).reduce((a, b) => a + b, 0);
      return sum + hCount + hotCount * 5;
    }, 0);
    if (totalHouses > prevHouseCountRef.current) {
      soundManager.playBuyProperty();
      if (curPlayer) {
        const tilePos = getTilePosition(curPlayer.position);
        particlesRef.current?.spawnBurst(new THREE.Vector3(tilePos.x, tilePos.y, 0.3), '#f3d189', 85);
      }
    }
    prevHouseCountRef.current = totalHouses;
  }, [gameState.players, gameState.propertyOwnership, gameState.mortgagedProperties, gameState.currentPlayerIndex]);

  // Auto-dismiss purchase announcement banner (snappy timing)
  useEffect(() => {
    if (!purchaseNotice) return;
    const duration = gameState.turboMode ? 1600 : 3200;
    const timer = setTimeout(() => {
      setPurchaseNotice(null);
    }, duration);
    return () => clearTimeout(timer);
  }, [purchaseNotice?.id, gameState.turboMode]);

  // Rent / Tax Payment Trigger & 3D Audio/Particles
  useEffect(() => {
    if (gameState.lastRentPayment && gameState.lastRentPayment.timestamp !== prevRentPaymentRef.current) {
      prevRentPaymentRef.current = gameState.lastRentPayment.timestamp;
      const payment = gameState.lastRentPayment;
      const debtor = gameState.players.find((p) => p.id === payment.debtorId);
      const creditor = payment.creditorId ? gameState.players.find((p) => p.id === payment.creditorId) || null : null;
      const tile = HOGWARTS_TILES.find((t) => t.id === payment.tileId);

      if (debtor && tile) {
        // 1. Play synthesized payment chime
        soundManager.playPayRent();

        // 2. Spawn gold/crimson coin burst particles over the tile
        const tilePos = getTilePosition(tile.index);
        particlesRef.current?.spawnBurst(
          new THREE.Vector3(tilePos.x, tilePos.y, 0.35),
          payment.isTax ? '#a855f7' : '#f3d189',
          90
        );

        // 3. Show banner toast
        setRentNotice({
          id: payment.timestamp,
          debtor,
          creditor,
          amount: payment.amount,
          tile,
          isTax: payment.isTax,
        });
      }
    }
  }, [gameState.lastRentPayment, gameState.players]);

  // Auto-dismiss rent notice banner (snappy timing)
  useEffect(() => {
    if (!rentNotice) return;
    const duration = gameState.turboMode ? 1400 : 2800;
    const timer = setTimeout(() => {
      setRentNotice(null);
    }, duration);
    return () => clearTimeout(timer);
  }, [rentNotice?.id, gameState.turboMode]);

  // Roll total shown big over the plaza once the dice land
  useEffect(() => {
    if (!rollBadge) return;
    const timer = setTimeout(() => setRollBadge(null), gameState.turboMode ? 800 : 1500);
    return () => clearTimeout(timer);
  }, [rollBadge?.id, gameState.turboMode]);

  // Dice Roll 3D Trigger & Audio
  useEffect(() => {
    if (gameState.dice) {
      const isNewRoll =
        !prevDiceRef.current ||
        prevDiceRef.current.die1 !== gameState.dice.die1 ||
        prevDiceRef.current.die2 !== gameState.dice.die2;

      if (isNewRoll) {
        dice3DRef.current?.roll(gameState.dice.die1, gameState.dice.die2);
        prevDiceRef.current = { ...gameState.dice };
      }
    } else {
      prevDiceRef.current = null;
    }
  }, [gameState.dice]);

  // Spell Card Trigger Audio & Particles
  useEffect(() => {
    if (gameState.activeCard && gameState.activeCard !== prevCardRef.current) {
      soundManager.playSpellCard();
      const curPlayer = gameState.players[gameState.currentPlayerIndex];
      if (curPlayer) {
        const tilePos = getTilePosition(curPlayer.position);
        particlesRef.current?.spawnBurst(tilePos, '#a855f7', 80);
      }
    }
    prevCardRef.current = gameState.activeCard;
  }, [gameState.activeCard, gameState.currentPlayerIndex, gameState.players]);

  // Auction Hammer Audio
  useEffect(() => {
    const isAuction = !!gameState.auction?.active;
    if (isAuction && !prevAuctionRef.current) {
      soundManager.playGavel();
    }
    prevAuctionRef.current = isAuction;
  }, [gameState.auction]);

  // Game Over Fanfare Audio
  useEffect(() => {
    if (gameState.turnPhase === 'GAME_OVER') {
      soundManager.playVictory();
    }
  }, [gameState.turnPhase]);

  // Compute camera target based on view mode and active player tile
  useEffect(() => {
    const curPlayer = gameState.players[gameState.currentPlayerIndex];
    const container = mountRef.current;
    const aspect = container && container.clientHeight > 0 ? container.clientWidth / container.clientHeight : 1;
    const portraitScale = viewScale(aspect);

    if (currentView === 'overview') {
      // 2.5D Tilt full board overview: optimal ~28° angle showing all 40 cards clearly
      targetCamPos.current.set(0, -11.0 * portraitScale, 13.8 * portraitScale);
      targetLookAt.current.set(0, 0.0, 0.0);
      targetUpVec.current.set(0, 1, 0);
    } else if (currentView === 'topdown') {
      // Complete Top-Down bird's eye view
      targetCamPos.current.set(0.01, -0.01, 15.6 * portraitScale);
      targetLookAt.current.set(0, 0, 0);
      targetUpVec.current.set(0, 1, 0);
    } else if (currentView === 'follow' && curPlayer) {
      // FOLLOW MODE: Close-up zoom on token position with flat angle
      const tileIdx = ((curPlayer.position % 40) + 40) % 40;
      const tilePos = getTilePosition(tileIdx);

      // Flat close-up view: camera almost directly above token
      const followZ = 6.0 * Math.min(1.0, portraitScale);
      targetCamPos.current.set(tilePos.x * 0.5, tilePos.y * 0.5 - 6, followZ);
      targetLookAt.current.set(tilePos.x, tilePos.y, 0);
      targetUpVec.current.set(0, 1, 0);
    }
  }, [gameState.currentPlayerIndex, gameState.players, currentView]);

  // View Preset Handler
  const setCameraPreset = (view: 'follow' | 'overview' | 'topdown') => {
    setCurrentView(view);
  };

  const handleZoomStep = (direction: number) => {
    isUserInteracting.current = true;
    const factor = direction > 0 ? 1.15 : 0.85;
    const dir = new THREE.Vector3().subVectors(targetCamPos.current, targetLookAt.current);
    const newLen = THREE.MathUtils.clamp(dir.length() * factor, 5.0, 35.0);
    dir.setLength(newLen);
    targetCamPos.current.copy(targetLookAt.current).add(dir);
    setTimeout(() => {
      isUserInteracting.current = false;
    }, 500);
  };

  return (
    <div className="three-board-wrapper">
      {/* 3D Canvas Mount Point */}
      <div ref={mountRef} className="three-canvas-container" />

      {/* Floating Leaderboard Score HUD */}
      <LeaderboardHud gameState={gameState} myPlayerId={myPlayerId} />


      {rollBadge && (
        <div key={rollBadge.id} className={`hpvn-roll-badge ${rollBadge.double ? 'is-double' : ''}`} aria-live="polite">
          <strong>{rollBadge.total}</strong>
          {rollBadge.double && <span>Đôi!</span>}
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="three-loading-overlay">
          <div className="magical-spinner" />
          <p>Đang tải bàn cờ…</p>
        </div>
      )}

      {/* Event toast: one line over the board — who, what, how much. Tap to dismiss; it also hides itself. */}
      {(() => {
        const toast = rentNotice
          ? {
              id: `r${rentNotice.id}`,
              who: rentNotice.debtor,
              tone: rentNotice.isTax ? 'tax' : 'rent',
              text: rentNotice.isTax ? (
                <>nộp thuế ở <em>{rentNotice.tile.name}</em></>
              ) : (
                <>trả tiền thuê cho <strong style={{ color: rentNotice.creditor?.color }}>{rentNotice.creditor?.name}</strong></>
              ),
              amount: `−${g(rentNotice.amount)}`,
              note: gameState.rentMultiplier > 1 ? `x${gameState.rentMultiplier}` : '',
              close: () => setRentNotice(null),
            }
          : purchaseNotice
          ? {
              id: `p${purchaseNotice.id}`,
              who: purchaseNotice.owner,
              tone: purchaseNotice.isTakeover ? 'takeover' : 'buy',
              text: purchaseNotice.isTakeover ? (
                <>mua đứt <em>{purchaseNotice.tile.name}</em> của <strong style={{ color: purchaseNotice.prevOwner?.color }}>{purchaseNotice.prevOwner?.name}</strong></>
              ) : (
                <>mua <em>{purchaseNotice.tile.name}</em></>
              ),
              amount: `${g((purchaseNotice.isTakeover
                ? calculateTakeoverCost(purchaseNotice.tile, purchaseNotice.prevOwner || purchaseNotice.owner)
                : purchaseNotice.tile.price || 0))}`,
              note: '',
              close: () => setPurchaseNotice(null),
            }
          : null;
        if (!toast) return null;
        return (
          <button key={toast.id} className={`hpvn-toast is-${toast.tone}`} onClick={toast.close} aria-live="polite" title="Đóng">
            <span className="hpvn-toast-ava" style={{ borderColor: toast.who.color, background: `${toast.who.color}22` }}>{toast.who.tokenIcon}</span>
            <span className="hpvn-toast-text">
              <strong style={{ color: toast.who.color }}>{toast.who.name}</strong> {toast.text}
            </span>
            <span className="hpvn-toast-amount">{toast.amount}{toast.note && <small>{toast.note}</small>}</span>
          </button>
        );
      })()}

      {/* Hovered Tile Tooltip Badge */}
      {hoveredTileInfo && !purchaseNotice && !rentNotice && (
        <div
          className={`three-tile-tooltip ${hoveredTileInfo.owner ? 'is-owned' : ''}`}
          style={
            hoveredTileInfo.owner
              ? {
                  borderColor: hoveredTileInfo.owner.color,
                  boxShadow: `0 8px 24px rgba(0, 0, 0, 0.8), 0 0 20px ${hoveredTileInfo.owner.color}66`,
                }
              : undefined
          }
        >
                              <span className="tooltip-name">{hoveredTileInfo.tile.name}</span>
          {hoveredTileInfo.owner ? (
            <span className="tooltip-owner-status" style={{ color: hoveredTileInfo.owner.color }}>
              · Chủ: <strong>{hoveredTileInfo.owner.name}</strong> ({hoveredTileInfo.owner.house}) — Thuế:{' '}
              {g(((hoveredTileInfo.tile.baseRent || hoveredTileInfo.tile.rentTiers?.[0] || 0) * (gameState.rentMultiplier || 1)))}
            </span>
          ) : hoveredTileInfo.tile.price ? (
            <span className="tooltip-unowned-status">
              · Còn trống: <strong>{galleons(hoveredTileInfo.tile.price)}</strong>
            </span>
          ) : null}
          <span className="tooltip-hint">· nhấp để xem</span>
                  </div>
      )}

      {/* Floating 3D Camera Controls */}
      <div className="three-controls-bar">
        <button
          className={`control-pill ${currentView === 'overview' ? 'active' : ''}`}
          onClick={() => setCameraPreset('overview')}
          title="Góc nghiêng 2.5D toàn cảnh chuẩn — Nhìn rõ toàn bộ 40 lá bài"
        >
          Toàn cảnh
        </button>
        <button
          className={`control-pill ${currentView === 'follow' ? 'active' : ''}`}
          onClick={() => setCameraPreset('follow')}
          title="Tự động bám và xoay bàn cờ theo quân cờ"
        >
          Bám quân
        </button>
        <button
          className={`control-pill ${currentView === 'topdown' ? 'active' : ''}`}
          onClick={() => setCameraPreset('topdown')}
          title="Góc nhìn thẳng từ trên xuống 90°"
        >
          Nhìn từ trên
        </button>
        <span className="three-controls-divider" />
        <button
          className="control-pill icon-only"
          onClick={() => handleZoomStep(-1)}
          title="Phóng to bàn cờ (+)"
          aria-label="Phóng to"
        >
          +
        </button>
        <button
          className="control-pill icon-only"
          onClick={() => handleZoomStep(1)}
          title="Thu nhỏ bàn cờ (-)"
          aria-label="Thu nhỏ"
        >
          −
        </button>
      </div>

      {/* Interactive Helper Hint */}
      <div className="three-interaction-hint">
        <span>Nhấp lá bài để xem · Kéo để xoay · Cuộn để phóng to</span>
      </div>

      {/* 3D Card Inspection Modal */}
      <CardInspectModal
        tile={inspectedTile}
        players={gameState.players}
        gameState={gameState}
        onClose={() => setInspectedTile(null)}
      />
    </div>
  );
}

export default BoardThreeJS;
