const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = '/Users/khang/.gemini/antigravity-ide/brain/1307aeb3-dc2d-426b-8ce5-4ea171a9922d';

async function main() {
  const targetsRes = await fetch('http://localhost:9222/json');
  const targets = await targetsRes.json();
  const pageTarget = targets.find(t => t.url.includes('localhost:5173') || t.url.includes('hogwarts-monopoly'));

  if (!pageTarget) {
    console.error('Target page not found! Available targets:', targets);
    process.exit(1);
  }

  console.log('Connecting to target:', pageTarget.url, pageTarget.webSocketDebuggerUrl);
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

  let idCounter = 1;
  const pendingRequests = new Map();

  function sendCommand(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = idCounter++;
      pendingRequests.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pendingRequests.has(msg.id)) {
      const { resolve, reject } = pendingRequests.get(msg.id);
      pendingRequests.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    }
  };

  ws.onopen = async () => {
    console.log('Connected to Chrome CDP!');

    try {
      // 1. Set viewport to high quality 1440x900
      await sendCommand('Emulation.setDeviceMetricsOverride', {
        width: 1440,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false
      });

      // 2. Navigate to diamonds_showcase.html
      console.log('Navigating to diamonds_showcase.html...');
      await sendCommand('Page.navigate', { url: 'http://localhost:5173/diamonds_showcase.html' });
      await new Promise(r => setTimeout(r, 2200));

      // 3. Capture All 8 Diamonds Lineup
      console.log('Capturing 8 diamonds lineup view...');
      await sendCommand('Runtime.evaluate', { expression: `window.__setCameraView('lineup_8')` });
      await new Promise(r => setTimeout(r, 800));
      const shotLineup = await sendCommand('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(ARTIFACT_DIR, 'preview_diamonds_lineup8.png'), Buffer.from(shotLineup.data, 'base64'));
      console.log('Saved preview_diamonds_lineup8.png');

      // 4. Capture Group A Closeup (Ruby, Emerald, Sapphire, Topaz)
      console.log('Capturing Group A closeup...');
      await sendCommand('Runtime.evaluate', { expression: `window.__setCameraView('group_a')` });
      await new Promise(r => setTimeout(r, 800));
      const shotGroupA = await sendCommand('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(ARTIFACT_DIR, 'preview_diamonds_group_a.png'), Buffer.from(shotGroupA.data, 'base64'));
      console.log('Saved preview_diamonds_group_a.png');

      // 5. Capture Group B Closeup (Amethyst, Black Onyx, Fire Opal, Aquamarine)
      console.log('Capturing Group B closeup...');
      await sendCommand('Runtime.evaluate', { expression: `window.__setCameraView('group_b')` });
      await new Promise(r => setTimeout(r, 800));
      const shotGroupB = await sendCommand('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(ARTIFACT_DIR, 'preview_diamonds_group_b.png'), Buffer.from(shotGroupB.data, 'base64'));
      console.log('Saved preview_diamonds_group_b.png');

      // 6. Capture Macro View of Ruby Diamond (Facets, claws, core, shards)
      console.log('Capturing Ruby Diamond macro view...');
      await sendCommand('Runtime.evaluate', { expression: `window.__setCameraView('single_ruby')` });
      await new Promise(r => setTimeout(r, 800));
      const shotRuby = await sendCommand('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(ARTIFACT_DIR, 'preview_diamonds_ruby_macro.png'), Buffer.from(shotRuby.data, 'base64'));
      console.log('Saved preview_diamonds_ruby_macro.png');

      // 7. Navigate to Main Game to show live 8 diamond tokens on Hogwarts board
      console.log('Navigating to main game http://localhost:5173/ ...');
      await sendCommand('Page.navigate', { url: 'http://localhost:5173/' });
      await new Promise(r => setTimeout(r, 2200));

      // Check if lobby is open, select 7 bots to have full 8 players!
      await sendCommand('Runtime.evaluate', {
        expression: `(() => {
          // Select 7 bots if in solo mode
          const botBtns = Array.from(document.querySelectorAll('.tab-btn'));
          const btn7 = botBtns.find(b => b.textContent.includes('7 Bot'));
          if (btn7) btn7.click();

          // Click launch game
          const launchBtn = document.querySelector('.btn-launch-game');
          if (launchBtn) launchBtn.click();
        })()`
      });
      await new Promise(r => setTimeout(r, 1800));

      // If already ingame, inject all 8 players at different board positions for glorious showcase!
      console.log('Setting up 8 players across the board...');
      await sendCommand('Runtime.evaluate', {
        expression: `(() => {
          if (!window.__gameState || !window.__setGameState) return 'no state';
          const HOUSES = ['Gryffindor', 'Slytherin', 'Ravenclaw', 'Hufflepuff', 'Auror', 'DeathEater', 'OrderOfPhoenix', 'Ministry'];
          const COLORS = ['#ef4444', '#10b981', '#3b82f6', '#f59e0b', '#a855f7', '#475569', '#f97316', '#06b6d4'];
          const NAMES = ['Harry Potter', 'Draco Malfoy', 'Luna Lovegood', 'Cedric Diggory', 'Severus Snape', 'Bellatrix', 'Sirius Black', 'Alastor Moody'];
          const POS = [0, 5, 10, 15, 20, 25, 30, 35];

          window.__setGameState(prev => {
            if (!prev) return prev;
            const newPlayers = HOUSES.map((h, i) => ({
              id: 'p-' + i,
              name: NAMES[i],
              house: h,
              color: COLORS[i],
              tokenIcon: '💎',
              balance: 5000,
              position: POS[i],
              properties: [],
              inJail: false,
              jailTurnsRemaining: 0,
              getOutOfJailCards: 0,
              isBankrupt: false,
              isAI: i > 0,
              houses: {},
              hotels: {},
              netWorth: 5000,
            }));
            return {
              ...prev,
              players: newPlayers
            };
          });
        })()`
      });
      await new Promise(r => setTimeout(r, 1500));

      // Click "Toàn Cảnh" camera
      await sendCommand('Runtime.evaluate', {
        expression: `(() => {
          const btn = Array.from(document.querySelectorAll('.cam-btn')).find(b => b.textContent.includes('Toàn cảnh') || b.textContent.includes('Overview'));
          if (btn) btn.click();
        })()`
      });
      await new Promise(r => setTimeout(r, 1000));

      console.log('Capturing in-game 8 diamond tokens on board (overview)...');
      const shotIngame = await sendCommand('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(ARTIFACT_DIR, 'preview_diamonds_ingame_board.png'), Buffer.from(shotIngame.data, 'base64'));
      console.log('Saved preview_diamonds_ingame_board.png');

      // Click "Bám Quân Cờ (Auto-Follow)" camera for dramatic closeup
      await sendCommand('Runtime.evaluate', {
        expression: `(() => {
          const btn = Array.from(document.querySelectorAll('.cam-btn')).find(b => b.textContent.includes('Bám') || b.textContent.includes('Follow'));
          if (btn) btn.click();
        })()`
      });
      await new Promise(r => setTimeout(r, 1200));

      console.log('Capturing in-game diamond token auto-follow closeup...');
      const shotFollow = await sendCommand('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(ARTIFACT_DIR, 'preview_diamonds_ingame_follow.png'), Buffer.from(shotFollow.data, 'base64'));
      console.log('Saved preview_diamonds_ingame_follow.png');

      console.log('ALL 8 DIAMOND PREVIEWS CAPTURED SUCCESSFULLY!');
      process.exit(0);
    } catch (err) {
      console.error('Error during capture:', err);
      process.exit(1);
    }
  };
}

main();
