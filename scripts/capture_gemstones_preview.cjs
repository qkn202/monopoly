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

      // 2. Navigate to diamonds_showcase.html (now hosting 8 unique gemstones)
      console.log('Navigating to diamonds_showcase.html...');
      await sendCommand('Page.navigate', { url: 'http://localhost:5173/diamonds_showcase.html' });
      await new Promise(r => setTimeout(r, 2200));

      // 3. Capture All 8 Gemstones Lineup
      console.log('Capturing 8 gemstones lineup view...');
      await sendCommand('Runtime.evaluate', { expression: `window.__setCameraView('lineup_8')` });
      await new Promise(r => setTimeout(r, 800));
      const shotLineup = await sendCommand('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(ARTIFACT_DIR, 'preview_gemstones_8lineup.png'), Buffer.from(shotLineup.data, 'base64'));
      console.log('Saved preview_gemstones_8lineup.png');

      // 4. Capture Group A Closeup (Ruby Marquise, Emerald Step, Sapphire Brilliant, Topaz Briolette)
      console.log('Capturing Group A closeup...');
      await sendCommand('Runtime.evaluate', { expression: `window.__setCameraView('group_a')` });
      await new Promise(r => setTimeout(r, 800));
      const shotGroupA = await sendCommand('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(ARTIFACT_DIR, 'preview_gemstones_group_a.png'), Buffer.from(shotGroupA.data, 'base64'));
      console.log('Saved preview_gemstones_group_a.png');

      // 5. Capture Group B Closeup (Amethyst Quartz, Black Onyx Spire, Fire Opal Kite, Aquamarine Column)
      console.log('Capturing Group B closeup...');
      await sendCommand('Runtime.evaluate', { expression: `window.__setCameraView('group_b')` });
      await new Promise(r => setTimeout(r, 800));
      const shotGroupB = await sendCommand('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(ARTIFACT_DIR, 'preview_gemstones_group_b.png'), Buffer.from(shotGroupB.data, 'base64'));
      console.log('Saved preview_gemstones_group_b.png');

      // 6. Capture Macro View of Emerald Step Cut
      console.log('Capturing Emerald Step Cut macro view...');
      await sendCommand('Runtime.evaluate', { expression: `window.__setCameraView('single_emerald')` });
      await new Promise(r => setTimeout(r, 800));
      const shotEmerald = await sendCommand('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(ARTIFACT_DIR, 'preview_gemstones_emerald_macro.png'), Buffer.from(shotEmerald.data, 'base64'));
      console.log('Saved preview_gemstones_emerald_macro.png');

      // 7. Capture Macro View of Black Onyx Trilliant Spire
      console.log('Capturing Black Onyx Trilliant Spire macro view...');
      await sendCommand('Runtime.evaluate', { expression: `window.__setCameraView('single_onyx')` });
      await new Promise(r => setTimeout(r, 800));
      const shotOnyx = await sendCommand('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(ARTIFACT_DIR, 'preview_gemstones_onyx_macro.png'), Buffer.from(shotOnyx.data, 'base64'));
      console.log('Saved preview_gemstones_onyx_macro.png');

      // 8. Navigate to Main Game to show live 8 gemstone tokens on Hogwarts board
      console.log('Navigating to main game http://localhost:5173/ ...');
      await sendCommand('Page.navigate', { url: 'http://localhost:5173/' });
      await new Promise(r => setTimeout(r, 2200));

      // Inject all 8 players at different board positions for in-game showcase!
      console.log('Setting up 8 players with distinct gemstones across the board...');
      await sendCommand('Runtime.evaluate', {
        expression: `(() => {
          // If in lobby, start game first
          const launchBtn = document.querySelector('.btn-launch-game');
          if (launchBtn) launchBtn.click();
        })()`
      });
      await new Promise(r => setTimeout(r, 1200));

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

      // Switch to Overview 2.5D Camera
      await sendCommand('Runtime.evaluate', {
        expression: `(() => {
          if (window.__setCameraPreset) window.__setCameraPreset('overview');
        })()`
      });
      await new Promise(r => setTimeout(r, 1600));

      console.log('Capturing in-game 8 gemstone tokens on board (overview)...');
      const shotIngame = await sendCommand('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(ARTIFACT_DIR, 'preview_gemstones_ingame_board.png'), Buffer.from(shotIngame.data, 'base64'));
      console.log('Saved preview_gemstones_ingame_board.png');

      // Switch to Auto-Follow Camera for dramatic closeup of active token (Ruby / Harry Potter)
      await sendCommand('Runtime.evaluate', {
        expression: `(() => {
          if (window.__setCameraPreset) window.__setCameraPreset('follow');
        })()`
      });
      await new Promise(r => setTimeout(r, 1800));

      console.log('Capturing in-game gemstone token auto-follow closeup...');
      const shotFollow = await sendCommand('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(ARTIFACT_DIR, 'preview_gemstones_ingame_follow.png'), Buffer.from(shotFollow.data, 'base64'));
      console.log('Saved preview_gemstones_ingame_follow.png');

      console.log('ALL 8 GEMSTONES PREVIEWS CAPTURED SUCCESSFULLY!');
      process.exit(0);
    } catch (err) {
      console.error('Error during capture:', err);
      process.exit(1);
    }
  };
}

main();
