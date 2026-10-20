// Headless-Edge driver over the DevTools protocol (no npm installs; needs Node 22+ for global WebSocket).
// Usage: node tests/browser/drive.mjs tests/browser/<steps>.mjs
// A steps file exports `async function ({ ev, shot, sleep, send })`. Screenshots land in tests/browser/shots/.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const HERE = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1');
const SCR = path.join(HERE, 'shots'); fs.mkdirSync(SCR, { recursive: true });
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
// Set PAGE_URL=https://npc6388.github.io/firewall/ to test the live site instead of the local file.
const PAGE = process.env.PAGE_URL || 'file:///' + path.resolve(HERE, '..', '..', 'index.html').replace(/\\/g, '/');
const port = 9333;
const proc = spawn(EDGE, ['--headless=new', '--remote-debugging-port=' + port, '--user-data-dir=' + path.join(os.tmpdir(), 'firewall-edge-profile'),
  '--window-size=1500,950', '--no-first-run', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let tabs;
for (let i = 0; i < 50; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (tabs.length) break; } catch { } await sleep(200); }
const tab = tabs.find((t) => t.type === 'page');
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pend = new Map(); const errors = [];
ws.addEventListener('message', (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); }
  if (d.method === 'Runtime.exceptionThrown') {
    const x = d.params.exceptionDetails, fr = x.stackTrace?.callFrames?.[0];
    errors.push((x.exception?.description || x.text).split(/\r?\n/)[0] + (fr ? ` @ ${fr.url.split('/').pop()}:${fr.lineNumber + 1}:${fr.columnNumber + 1} (${fr.functionName || 'anon'})` : ''));
  }
  if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push(d.params.args.map((a) => a.value || a.description).join(' '));
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return r.result?.exceptionDetails ? 'EXC: ' + JSON.stringify(r.result.exceptionDetails.exception?.description) : r.result?.result?.value; };
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(SCR, name + '.png'), Buffer.from(r.result.data, 'base64')); console.log('shot', name); };

await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1500, height: 950, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: PAGE }); await sleep(1500);

const steps = (await import('file:///' + path.resolve(process.argv[2] || path.join(HERE, 'playthrough.mjs')).replace(/\\/g, '/'))).default;
try { await steps({ ev, shot, sleep, send }); } catch (e) { console.log('STEP ERROR', e); }
console.log('page errors:', errors.length ? errors : 'none');
ws.close(); proc.kill(); process.exit(0);
