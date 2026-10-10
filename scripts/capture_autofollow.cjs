const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = '/Users/khang/.gemini/antigravity-ide/brain/1307aeb3-dc2d-426b-8ce5-4ea171a9922d';

async function main() {
  const targetsRes = await fetch('http://localhost:9222/json');
  const targets = await targetsRes.json();
  const pageTarget = targets.find(t => t.url.includes('localhost:5173') || t.url.includes('hogwarts-monopoly'));

  if (!pageTarget) {
    console.error('Target page not found!');
    process.exit(1);
  }

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
    try {
      await sendCommand('Emulation.setDeviceMetricsOverride', {
        width: 1440,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false
      });

      console.log('Navigating to http://localhost:5173/ ...');
      await sendCommand('Page.navigate', { url: 'http://localhost:5173/' });
      await new Promise(r => setTimeout(r, 2000));

      // Click launch game if in lobby
      await sendCommand('Runtime.evaluate', {
        expression: `(() => {
          const btn = document.querySelector('.btn-launch-game');
          if (btn) btn.click();
        })()`
      });
      await new Promise(r => setTimeout(r, 1500));

      // Click "Bám Quân Cờ (Auto-Follow)"
      console.log('Clicking Auto-Follow button...');
      await sendCommand('Runtime.evaluate', {
        expression: `(() => {
          const pills = Array.from(document.querySelectorAll('.control-pill'));
          const followBtn = pills.find(b => b.textContent.includes('Auto-Follow') || b.textContent.includes('Bám'));
          if (followBtn) followBtn.click();
        })()`
      });
      await new Promise(r => setTimeout(r, 2500));

      console.log('Capturing auto-follow closeup...');
      const shotFollow = await sendCommand('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(ARTIFACT_DIR, 'preview_diamonds_ingame_follow.png'), Buffer.from(shotFollow.data, 'base64'));
      console.log('Saved preview_diamonds_ingame_follow.png');

      process.exit(0);
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  };
}

main();
