import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${msg}`);
}

console.log('⚡ RUNNING BANKRUPTCY THẢO MAI CONFIRMATION SUITE...\n');

// 1. Verify BankruptcyConfirmModal source file exists and contains thảo mai quotes
const modalPath = path.resolve(__dirname, '../src/ui/BankruptcyConfirmModal.tsx');
assert(fs.existsSync(modalPath), 'BankruptcyConfirmModal.tsx exists');

const modalContent = fs.readFileSync(modalPath, 'utf8');

// 2. Check for the absence of generic "Bạn có chắc chắn..." text
assert(
  !modalContent.includes('Bạn có chắc') && !modalContent.includes('Bạn chắc chứ'),
  'Modal completely avoids boring generic text ("Bạn có chắc...")'
);

// 3. Verify presence of sarcastic, hilarious thảo mai quotes
const sarcasticKeywords = [
  'buông xuôi',
  'Galleons',
  'GÓC THẢO MAI',
  'bấm nhầm',
  'gồng tiếp',
  'quê',
  'nhục nhã',
  'Muggle',
];

for (const kw of sarcasticKeywords) {
  assert(modalContent.includes(kw), `Modal includes iconic thảo mai keyword/phrase: "${kw}"`);
}

// 4. Verify integration in RightSidebar
const sidebarPath = path.resolve(__dirname, '../src/ui/RightSidebar.tsx');
const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');

assert(sidebarContent.includes('BankruptcyConfirmModal'), 'RightSidebar imports BankruptcyConfirmModal');
assert(sidebarContent.includes('setShowBankruptcyConfirm(true)'), 'Clicking "TUYÊN BỐ PHÁ SẢN" triggers setShowBankruptcyConfirm(true)');
assert(!sidebarContent.includes('onClick={() => dispatch({ type: \'DECLARE_BANKRUPTCY\' })}'), 'No direct immediate unconfirmed bankruptcy dispatch');

console.log('\n🎉 ALL BANKRUPTCY THẢO MAI CONFIRMATION TESTS PASSED FLAWLESSLY!');
