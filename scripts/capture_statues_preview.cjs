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

      // 2. Navigate to statues_showcase.html
      console.log('Navigating to statues_showcase.html...');
      await sendCommand('Page.navigate', { url: 'http://localhost:5173/statues_showcase.html' });
      await new Promise(r => setTimeout(r, 2000));

      // 3. Capture Lineup View
      console.log('Capturing lineup view...');
      await sendCommand('Runtime.evaluate', { expression: `window.__setCameraView('lineup')` });
      await new Promise(r => setTimeout(r, 800));
      const shotLineup = await sendCommand('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(ARTIFACT_DIR, 'preview_statues_lineup.png'), Buffer.from(shotLineup.data, 'base64'));
      console.log('Saved preview_statues_lineup.png');

      // 4. Capture Gryffindor & Slytherin Closeup
      console.log('Capturing Gryffindor & Slytherin closeup...');
      await sendCommand('Runtime.evaluate', { expression: `window.__setCameraView('gryff_slyth')` });
      await new Promise(r => setTimeout(r, 800));
      const shotGryffSlyth = await sendCommand('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(ARTIFACT_DIR, 'preview_statues_gryff_slyth.png'), Buffer.from(shotGryffSlyth.data, 'base64'));
      console.log('Saved preview_statues_gryff_slyth.png');

      // 5. Capture Ravenclaw & Hufflepuff Closeup
      console.log('Capturing Ravenclaw & Hufflepuff closeup...');
      await sendCommand('Runtime.evaluate', { expression: `window.__setCameraView('raven_huff')` });
      await new Promise(r => setTimeout(r, 800));
      const shotRavenHuff = await sendCommand('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(ARTIFACT_DIR, 'preview_statues_raven_huff.png'), Buffer.from(shotRavenHuff.data, 'base64'));
      console.log('Saved preview_statues_raven_huff.png');

      // 6. Navigate to Main Game to capture live in-game statue tokens on board
      console.log('Navigating to main game http://localhost:5173/ ...');
      await sendCommand('Page.navigate', { url: 'http://localhost:5173/' });
      await new Promise(r => setTimeout(r, 2000));

      // Check if lobby button exists
      const checkLobby = await sendCommand('Runtime.evaluate', {
        expression: `Boolean(document.querySelector('.btn-launch-game'))`,
        returnByValue: true
      });

      if (checkLobby.result?.value) {
        console.log('Launching solo game...');
        await sendCommand('Runtime.evaluate', {
          expression: `document.querySelector('.btn-launch-game').click()`
        });
        await new Promise(r => setTimeout(r, 1500));
      }

      // Switch camera view to overview or 3D angle to get a crisp look at player tokens
      await sendCommand('Runtime.evaluate', {
        expression: `(() => {
          const btn = Array.from(document.querySelectorAll('.cam-btn')).find(b => b.textContent.includes('Toàn cảnh') || b.textContent.includes('Overview'));
          if (btn) btn.click();
        })()`
      });
      await new Promise(r => setTimeout(r, 1000));

      console.log('Capturing in-game board overview...');
      const shotIngame = await sendCommand('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(ARTIFACT_DIR, 'preview_statues_ingame_board.png'), Buffer.from(shotIngame.data, 'base64'));
      console.log('Saved preview_statues_ingame_board.png');

      console.log('ALL PREVIEW CAPTURES COMPLETED SUCCESSFULLY!');
      process.exit(0);
    } catch (err) {
      console.error('Error during capture:', err);
      process.exit(1);
    }
  };
}

main();
