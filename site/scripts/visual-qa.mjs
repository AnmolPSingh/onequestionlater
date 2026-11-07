// Browser visual QA for the real Astro site. Run with: node site/scripts/visual-qa.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve('visual-qa');
await fs.mkdir(output, { recursive: true });
const SITE = process.env.QA_SITE || 'http://127.0.0.1:4329/'; // astro allows one preview server, so reuse a running one
// Astro itself, not through npx: killing npx leaves the server running, and the job then waits forever.
const server = spawn(process.execPath, process.env.QA_SITE ? ['--version'] : ['node_modules/astro/bin/astro.mjs', 'preview', '--host', '127.0.0.1', '--port', '4329', '--ignore-lock'], { // the real build, not a dev server
  cwd: 'site',
  env: { ...process.env, CI: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
server.stdout.on('data', (d) => process.stdout.write(d));
server.stderr.on('data', (d) => process.stderr.write(d));
let browser;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
try {
  let opened = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    if (server.exitCode !== null && !process.env.QA_SITE) throw new Error('Astro server exited before becoming ready');
    try {
      const result = await fetch(SITE);
      opened = result.ok;
      if (opened) break;
    } catch {}
    await sleep(400);
  }
  if (!opened) throw new Error('Astro preview server not ready');

  browser = await chromium.launch({
    headless: !process.env.DISPLAY, // headed under Xvfb in CI; a Mac has its own GPU
    channel: process.env.CI ? undefined : 'chrome',
    args: ['--no-sandbox', '--enable-webgl', '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=swiftshader'],
  });

  for (const device of [{ name: 'desktop', width: 1440, height: 900 },
                        { name: 'mobile', width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport: device, deviceScaleFactor: 1 });
    page.setDefaultTimeout(12000);
    const runtimeErrors = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    await page.goto(SITE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000); // wait for the loader and the portrait's 2.8s formation
    await page.screenshot({ path: path.join(output, device.name + '-hero.png') });
    await page.waitForTimeout(4000);
    await page.evaluate(() => document.documentElement.classList.remove('loading'));
    const geom = await page.locator('[data-close]').evaluate((el) => ({
      start: el.getBoundingClientRect().top + window.scrollY,
      height: window.innerHeight,
    }));
    const states = [];
    for (const percent of [0, 25, 50, 75, 100]) {
      await page.evaluate((y) => window.scrollTo(0, y), geom.start + geom.height * 2.9 * percent / 100);
      await page.waitForTimeout(850);
      states.push(await page.evaluate(() => ({
        canvasWidth: document.querySelector('canvas.scene')?.width ?? 0,
        leadOpacity: Number(getComputedStyle(document.querySelector('[data-close-lead]')).opacity),
        whiteOpacity: Number(getComputedStyle(document.querySelector('[data-white]')).opacity),
      })));
      await page.screenshot({ path: path.join(output, device.name + '-desert-' + percent + '.png') });
    }
    const result = { device: device.name, states, errors: runtimeErrors };
    await fs.writeFile(path.join(output, device.name + '.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
    // If WebGL is available, the new renderer must have sized its actual canvas.
    if (states[2].canvasWidth === 0) throw new Error(device.name + ': particle scene was not initialized');
    if (states[1].leadOpacity < 0.4) throw new Error(device.name + ': footer lead missing while the desert holds');
    if (states[4].whiteOpacity < 0.6) throw new Error(device.name + ': transition to white failed');
    if (runtimeErrors.length) throw new Error(device.name + ': ' + runtimeErrors.join(' | '));
    await page.close();
  }
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
process.exit(0); // a failure above has already exited with an error
