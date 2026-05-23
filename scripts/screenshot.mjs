// One-off README screenshot helper.
// Drives a headless Chrome via the DevTools Protocol — no extra npm deps.
// Not part of the build. Invoke manually when README screenshots need a refresh:
//   npm run dev    # in a separate terminal
//   node scripts/screenshot.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';
import { connect } from 'node:net';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public', 'images');
mkdirSync(outDir, { recursive: true });

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9222;
const BASE = 'http://localhost:5173/';

function waitForPort(port, timeoutMs = 10000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const s = connect(port, '127.0.0.1');
      s.once('connect', () => { s.end(); resolve(); });
      s.once('error', () => {
        s.destroy();
        if (Date.now() - start > timeoutMs) reject(new Error('chrome devtools port never opened'));
        else setTimeout(tick, 200);
      });
    };
    tick();
  });
}

const userDataDir = `/tmp/dice-chat-screenshot-${Date.now()}`;
const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${userDataDir}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-features=Translate',
  '--hide-scrollbars',
  'about:blank',
], { stdio: 'ignore' });

process.on('exit', () => chrome.kill());
process.on('SIGINT', () => { chrome.kill(); process.exit(1); });

await waitForPort(PORT);

const listResp = await fetch(`http://127.0.0.1:${PORT}/json/list`);
const tabs = await listResp.json();
const tab = tabs.find((t) => t.type === 'page');

const ws = new WebSocket(tab.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
ws.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  }
});
await new Promise((r) => ws.addEventListener('open', r, { once: true }));

const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function evalJS(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ': ' + (r.result?.description ?? ''));
  return r.result?.value;
}

async function go(url) {
  await send('Page.enable');
  await send('Page.navigate', { url });
  await wait(900);
}

async function setViewport(width, height, deviceScaleFactor = 2, mobile = false) {
  await send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor, mobile,
    screenWidth: width, screenHeight: height,
  });
}

async function shoot(file) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  const path = join(outDir, file);
  writeFileSync(path, Buffer.from(r.data, 'base64'));
  console.log('wrote', path);
}

// ---------- Scene 1: empty lobby (mobile) ----------
await setViewport(390, 844, 2, true);
await go(BASE);
await evalJS(`(() => {
  localStorage.clear(); sessionStorage.clear();
  indexedDB.deleteDatabase('trpg-dice');
  localStorage.setItem('trpg-dice.lang', 'en');
  localStorage.setItem('trpg-dice.tutorial', 'seen');
  localStorage.setItem('trpg-dice.tutorialSeen', '1');
  localStorage.setItem('trpg-dice.playerName', 'Mira');
})()`);
await go(BASE);
await wait(800);
await shoot('lobby-mobile.png');

// ---------- Scene 2: feed with rolls + chat (desktop) ----------
await setViewport(960, 720, 2, false);

// Seed a character so the dialog flow is short and predictable.
await evalJS(`(() => {
  const character = {
    id: 'chr-screenshot',
    name: 'Lyra Brightblade',
    background: 'Half-elf paladin · Sworn to the Dawn Order',
    memo: '',
    patterns: [
      { id: 'p1', name: 'Perception', diceCount: 1, diceType: 'D20', modifier: 3, kind: 'judgment' },
      { id: 'p2', name: 'Longsword slash', diceCount: 1, diceType: 'D8', modifier: 2, kind: 'damage' },
      { id: 'p3', name: 'Fireball', diceCount: 6, diceType: 'D6', modifier: 0, kind: 'damage' }
    ],
    lang: 'en',
    exportMemo: false,
  };
  localStorage.setItem('trpg-dice.characters', JSON.stringify([character]));
  localStorage.setItem('trpg-dice.activeCharacterId', character.id);
})()`);
await go(BASE);
await wait(900);

async function clickNav(text) {
  await evalJS(`(() => {
    const b = Array.from(document.querySelectorAll('nav button')).find(b => b.textContent.trim() === ${JSON.stringify(text)});
    b && b.click();
    return !!b;
  })()`);
  await wait(250);
}

async function clickByText(text) {
  await evalJS(`(() => {
    const b = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === ${JSON.stringify(text)});
    b && b.click();
    return !!b;
  })()`);
  await wait(200);
}

async function rollPattern(name) {
  await clickNav('Patterns');
  await wait(300);
  const rolled = await evalJS(`(() => {
    const items = Array.from(document.querySelectorAll('[role="listitem"], li'));
    for (const item of items) {
      if (item.textContent.includes(${JSON.stringify(name)})) {
        const btn = item.querySelector('button');
        if (btn) { btn.click(); return 'rolled'; }
      }
    }
    return 'not-found';
  })()`);
  console.log('rollPattern', name, '->', rolled);
  await wait(400);
  await clickByText('Close');
  await wait(200);
}

// Fallback: roll via the dice dialog if patterns aren't browsable for some reason
async function rollDiceManually({ name, count, type, mod, kind = 'Damage' }) {
  await clickNav('Dice');
  await wait(400);
  await evalJS(`(() => {
    const inp = document.querySelector('input[placeholder^="Name this roll"]');
    if (inp) { const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; setter.call(inp, ${JSON.stringify(name)}); inp.dispatchEvent(new Event('input', { bubbles: true })); }
    const sel = document.querySelector('select');
    if (sel) { const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set; setter.call(sel, ${JSON.stringify(type)}); sel.dispatchEvent(new Event('change', { bubbles: true })); }
    const incCount = Array.from(document.querySelectorAll('button')).find(b => b.getAttribute('aria-label') === 'Increase count');
    const decCount = Array.from(document.querySelectorAll('button')).find(b => b.getAttribute('aria-label') === 'Decrease count');
    let cur = 1, target = ${count};
    while (cur < target && incCount) { incCount.click(); cur++; }
    while (cur > target && decCount) { decCount.click(); cur--; }
    const incMod = Array.from(document.querySelectorAll('button')).find(b => b.getAttribute('aria-label') === 'Increase modifier');
    const decMod = Array.from(document.querySelectorAll('button')).find(b => b.getAttribute('aria-label') === 'Decrease modifier');
    let m = 0, tm = ${mod};
    while (m < tm && incMod) { incMod.click(); m++; }
    while (m > tm && decMod) { decMod.click(); m--; }
    const k = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === ${JSON.stringify(kind)});
    k && k.click();
  })()`);
  await wait(150);
  await evalJS(`(() => {
    const r = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Roll the dice');
    r && r.click();
  })()`);
  await wait(350);
  await clickByText('Close');
  await wait(250);
}

await rollDiceManually({ name: 'Perception', count: 1, type: 'D20', mod: 3, kind: 'Judgment' });
await rollDiceManually({ name: 'Longsword slash', count: 1, type: 'D8', mod: 2, kind: 'Damage' });
await rollDiceManually({ name: 'Fireball', count: 6, type: 'D6', mod: 0, kind: 'Damage' });

await evalJS(`(() => {
  const inp = document.querySelector('input[placeholder="Type a message"]');
  if (inp) {
    inp.focus();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(inp, "I draw my sword and step between the goblin and our cleric.");
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  }
})()`);
await wait(200);
await evalJS(`(() => {
  const send = Array.from(document.querySelectorAll('button')).find(b => b.getAttribute('aria-label') === 'Send');
  if (send) {
    send.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    send.click();
  }
})()`);
await wait(600);

const feedCount = await evalJS(`document.querySelectorAll('main [role="list"] > [role="listitem"]').length`);
console.log('feed items:', feedCount);

await shoot('feed-desktop.png');

// ---------- Scene 3: feed (mobile) ----------
await setViewport(390, 844, 2, true);
await wait(400);
await shoot('feed-mobile.png');

ws.close();
chrome.kill();
process.exit(0);
