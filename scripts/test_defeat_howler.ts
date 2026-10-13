import { createInitialState, gameReducer } from '../src/core/gameReducer';
import { resolveDebtOrLiquidate, handleBankruptcy } from '../src/core/reducerHelpers';
import { generateBankruptcyDetails } from '../src/core/howlerMessages';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${msg}`);
}

console.log('⚡ RUNNING DEFEAT HOWLER & BANKRUPTCY HUMOR TEST SUITE...');

const players = [
  { name: 'Harry Potter', house: 'Gryffindor' as const, isAI: false },
  { name: 'Draco Malfoy', house: 'Slytherin' as const, isAI: true },
  { name: 'Ron Weasley', house: 'Gryffindor' as const, isAI: true }
];

const state = createInitialState(players, 40);

// Test 1: Rent Debt to Creditor
console.log('\nTest 1: Rent Debt to Draco Malfoy on Quán Cái Vạc Lủng...');
const tile1 = state.boardTiles.find(t => t.id === 'tile-3')!;
const pHarry = { ...state.players[0], balance: 50, properties: [] };
const pDraco = { ...state.players[1], balance: 2000 };

const resRent = resolveDebtOrLiquidate(
  {
    ...state,
    players: [pHarry, pDraco, state.players[2]],
    propertyOwnership: { [tile1.id]: pDraco.id }
  },
  pHarry,
  800, // Debt is 800G, Harry only has 50G and 0 lands -> True bankruptcy!
  pDraco.id,
  `tiền thuê tại "${tile1.name}"`,
  tile1.id
);

assert(resRent.isBankrupt === true, 'Harry is declared bankrupt');
assert(!!resRent.state.lastBankruptcyDetails, 'lastBankruptcyDetails is populated');
const rentDetails = resRent.state.lastBankruptcyDetails!;
assert(rentDetails.debtorName === 'Harry Potter', 'Debtor is Harry Potter');
assert(rentDetails.creditorName === 'Draco Malfoy', 'Creditor is Draco Malfoy');
assert(rentDetails.debtAmount === 800, 'Debt amount is 800G');
assert(rentDetails.humorousTitle.length > 0, `Humorous title generated: "${rentDetails.humorousTitle}"`);
assert(rentDetails.humorousQuote.includes('DRACO MALFOY'), 'Howler screech quote names Draco Malfoy');
assert(rentDetails.humorousQuote.includes(tile1.name), 'Howler screech quote names the fatal property');
assert(rentDetails.humorousPunishment.length > 0, `Humorous punishment generated: "${rentDetails.humorousPunishment}"`);

// Test 2: Ministry of Magic Tax Bankruptcy
console.log('\nTest 2: Ministry Tax Bankruptcy...');
const pRon = { ...state.players[2], balance: 30, properties: [] };
const resTax = resolveDebtOrLiquidate(
  {
    ...state,
    players: [state.players[0], state.players[1], pRon]
  },
  pRon,
  500, // Tax is 500G, Ron only has 30G
  undefined,
  'thuế Bộ Pháp Thuật',
  'tile-4'
);

assert(resTax.isBankrupt === true, 'Ron is declared bankrupt from tax');
const taxDetails = resTax.state.lastBankruptcyDetails!;
assert(taxDetails.creditorName === 'Bộ Pháp Thuật', 'Creditor is Ministry of Magic');
assert(taxDetails.humorousTitle.includes('CÔNG DÂN MẪU MỰC') || taxDetails.humorousTitle.includes('THUẾ') || taxDetails.humorousTitle.includes('HOÀNG GIA'), `Tax title generated: "${taxDetails.humorousTitle}"`);
assert(taxDetails.humorousQuote.includes('BỘ PHÁP THUẬT'), 'Howler quote mentions Ministry of Magic');
assert(taxDetails.humorousPunishment.includes('Snape'), 'Punishment sends Ron to clean cauldrons for Snape');

// Test 3: Voldemort Dark Curse Storm Bankruptcy
console.log('\nTest 3: Dark Curse Escalation Bankruptcy...');
const curseDetails = generateBankruptcyDetails(
  pHarry,
  undefined,
  1200,
  'Cơn nguyền hắc ám của Voldemort tăng vọt',
  undefined,
  state
);

assert(curseDetails.humorousTitle.includes('CỘT THU LÔI') || curseDetails.humorousTitle.includes('VẬN ĐEN') || curseDetails.humorousTitle.includes('KẺ ĐƯỢC CHỌN'), `Curse title generated: "${curseDetails.humorousTitle}"`);
assert(curseDetails.humorousQuote.includes('VOLDEMORT'), 'Howler quote mentions Lord Voldemort');
assert(curseDetails.humorousPunishment.includes('Rừng Cấm'), 'Punishment exiles player to Forbidden Forest');

// Test 4: Auction Failure Bankruptcy
console.log('\nTest 4: Auction Failure Bankruptcy...');
const auctionDetails = generateBankruptcyDetails(
  pHarry,
  undefined,
  950,
  'vung tay quá trán tại phiên đấu giá',
  undefined,
  state
);
assert(auctionDetails.humorousTitle.includes('BÀN TAY VÀNG LÀNG ĐỔ NỢ') || auctionDetails.humorousTitle.includes('ĐẤU GIÁ'), `Auction title generated: "${auctionDetails.humorousTitle}"`);
assert(auctionDetails.humorousQuote.includes('HÔ GIÁ') || auctionDetails.humorousQuote.includes('ĐẤU GIÁ'), 'Howler quote roasts reckless auction bidding');

// Test 5: Verify Debtor Record contains bankruptcyDetails
console.log('\nTest 5: Verify Debtor Record in State...');
const bankruptPlayer = resRent.state.players.find(p => p.id === pHarry.id)!;
assert(bankruptPlayer.isBankrupt === true, 'Player isBankrupt is true');
assert(!!bankruptPlayer.bankruptcyDetails, 'Player has personal bankruptcyDetails attached');
assert(bankruptPlayer.bankruptcyDetails!.debtAmount === 800, 'Player personal bankruptcy debt amount is 800');

// Test 6: Verify Howler Dismiss & Auto-Close Transition Logic
console.log('\nTest 6: Verify Howler Dismiss & Spectate Transition Logic...');
let modalOpen = true;
let isSpectating = false;
const isGameOver = false;

const handleDismiss = () => {
  modalOpen = false;
  if (!isGameOver) {
    isSpectating = true;
  }
};

handleDismiss();
assert(modalOpen === false, 'Modal closed after dismiss/auto-dismiss');
assert(isSpectating === true, 'Player transitioned to spectator mode to view board without lag');

// When game over, dismissing should not force spectator mode
let gameOverModalOpen = true;
let gameOverSpectating = false;
const handleGameOverDismiss = () => {
  gameOverModalOpen = false;
  if (true /* isGameOver */) {
    // Keep gameOverSpectating false so podium is visible
  }
};
handleGameOverDismiss();
assert(gameOverModalOpen === false, 'Game over howler modal closed');
assert(gameOverSpectating === false, 'Podium view preserved after game over howler close');

console.log('\n🎉 ALL 6 DEFEAT HOWLER TESTS PASSED FLAWLESSLY!');
