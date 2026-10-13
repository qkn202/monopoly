import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getBoardTiles, getTileAssetId } from '../src/core/boardVariants';
import { HOGWARTS_TILES } from '../src/core/boardData';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${msg}`);
}

console.log('⚡ RUNNING BOARD VARIANT ARTWORK & LOCATION NAME AUDIT...\n');

const cardsDir = path.resolve(__dirname, '../public/assets/cards');

for (const size of [20, 28, 40]) {
  console.log(`--- Testing Board Size ${size} Tiles ---`);
  const tiles = getBoardTiles(size);
  assert(tiles.length === size, `Board size ${size} has exactly ${size} tiles`);

  for (let slot = 0; slot < size; slot++) {
    const tile = tiles[slot];
    assert(tile.index === slot, `Tile at slot ${slot} has index === ${slot}`);

    const canonical = HOGWARTS_TILES.find((t) => t.id === tile.id);
    assert(!!canonical, `Tile ${tile.id} at slot ${slot} exists in master HOGWARTS_TILES`);
    assert(tile.name === canonical!.name, `Tile ${tile.id} name "${tile.name}" exactly matches canonical "${canonical!.name}"`);
    assert(tile.icon === canonical!.icon, `Tile ${tile.id} icon ${tile.icon} matches canonical ${canonical!.icon}`);
    assert(tile.type === canonical!.type, `Tile ${tile.id} type ${tile.type} matches canonical ${canonical!.type}`);
    assert(tile.colorGroup === canonical!.colorGroup, `Tile ${tile.id} colorGroup matches canonical`);

    const assetId = getTileAssetId(tile);
    const expectedNum = parseInt(tile.id.replace('tile-', ''), 10);
    assert(assetId === expectedNum, `Tile ${tile.id} resolves assetId ${assetId} === ${expectedNum}`);

    const assetFileName = `tile_${assetId}.webp`;
    const assetFilePath = path.join(cardsDir, assetFileName);
    assert(fs.existsSync(assetFilePath), `Card image ${assetFileName} exists on disk at ${assetFilePath}`);
  }
}

console.log('\n--- Specific Verification of Previously Buggy Mini-Board Tiles ---');
const tiles20 = getBoardTiles(20);
assert(tiles20[5].id === 'tile-10' && getTileAssetId(tiles20[5]) === 10, '20-tile Slot 5 (JAIL) correctly loads tile_10.webp (Azkaban Prison)');
assert(tiles20[10].id === 'tile-20' && getTileAssetId(tiles20[10]) === 20, '20-tile Slot 10 (FREE_PARKING) correctly loads tile_20.webp (Room of Requirement)');
assert(tiles20[15].id === 'tile-30' && getTileAssetId(tiles20[15]) === 30, '20-tile Slot 15 (GO_TO_JAIL) correctly loads tile_30.webp (Auror Arrest)');
assert(tiles20[2].name === 'Quán Cái Vạc Lủng' && getTileAssetId(tiles20[2]) === 3, '20-tile Slot 2 is Quán Cái Vạc Lủng with tile_3.webp (NOT potion bottle tile_2.webp)');
assert(tiles20[6].name === 'Tiệm Đũa Phép Ollivanders' && getTileAssetId(tiles20[6]) === 9, '20-tile Slot 6 is Tiệm Đũa Phép Ollivanders with tile_9.webp');
assert(tiles20[14].name === 'Cây Liễu Roi' && getTileAssetId(tiles20[14]) === 24, '20-tile Slot 14 is Cây Liễu Roi with tile_24.webp (NOT Hang Nhện Aragog)');
assert(tiles20[18].name === 'Hầm 713 Ngân Hàng Gringotts' && getTileAssetId(tiles20[18]) === 37, '20-tile Slot 18 is Hầm 713 Ngân Hàng Gringotts with tile_37.webp (NOT Hẻm Xéo Hoàng Gia)');

const tiles28 = getBoardTiles(28);
assert(tiles28[5].name === 'Tiệm Đũa Phép Ollivanders' && getTileAssetId(tiles28[5]) === 9, '28-tile Slot 5 is Tiệm Đũa Phép Ollivanders with tile_9.webp (NOT Tiệm Chổi Quidditch)');
assert(tiles28[7].id === 'tile-10' && getTileAssetId(tiles28[7]) === 10, '28-tile Slot 7 (JAIL) correctly loads tile_10.webp (Azkaban Prison)');
assert(tiles28[14].id === 'tile-20' && getTileAssetId(tiles28[14]) === 20, '28-tile Slot 14 (FREE_PARKING) correctly loads tile_20.webp (Room of Requirement)');
assert(tiles28[21].id === 'tile-30' && getTileAssetId(tiles28[21]) === 30, '28-tile Slot 21 (GO_TO_JAIL) correctly loads tile_30.webp (Auror Arrest)');
assert(tiles28[22].name === 'Phòng Bí Mật (Sở Ban Ngành)' && getTileAssetId(tiles28[22]) === 31, '28-tile Slot 22 is Phòng Bí Mật with tile_31.webp');
assert(tiles28[23].name === 'Sảnh Trung Tâm Bộ Pháp Thuật' && getTileAssetId(tiles28[23]) === 34, '28-tile Slot 23 is Sảnh Trung Tâm with tile_34.webp');
assert(tiles28[25].name === 'Hầm 713 Ngân Hàng Gringotts' && getTileAssetId(tiles28[25]) === 37, '28-tile Slot 25 is Hầm 713 with tile_37.webp');

console.log('\n🎉 ALL BOARD VARIANT ARTWORK & LOCATION NAME TESTS PASSED FLAWLESSLY!');
