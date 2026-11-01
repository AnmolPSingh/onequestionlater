// Browser visual QA for the real Astro site. Run with: node site/scripts/visual-qa.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve('visual-qa');
await fs.mkdir(output, { recursive: true });
const server = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1'], {
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
    if (server.exitCode !== null) throw new Error('Astro server exited before becoming ready');
    try {
      const result = await fetch('http://127.0.0.1:4321/');
      opened = result.ok;
      if (opened) break;
    } catch {}
    await sleep(400);
  }
  if (!opened) throw new Error('Astro dev server not ready');

  browser = await chromium.launch({
    headless: false,
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
    await page.goto('http://127.0.0.1:4321/', { waitUntil: 'domcontentloaded' });
    await page.screenshot({ path: path.join(output, device.name + '-hero.png') });
    await page.waitForTimeout(4000);
    await page.evaluate(() => document.documentElement.classList.remove('loading'));
    const geom = await page.locator('[data-close]').evaluate((el) => ({
      start: el.getBoundingClientRect().top + window.scrollY,
      height: window.innerHeight,
    }));
    const states = [];
    for (const percent of [0, 25, 50, 75, 98]) {
      await page.evaluate((y) => window.scrollTo(0, y), geom.start + geom.height * 3.2 * percent / 100);
      await page.waitForTimeout(850);
      states.push(await page.evaluate(() => ({
        canvasWidth: document.querySelector('[data-close-live]')?.width ?? 0,
        canvasOpacity: Number(getComputedStyle(document.querySelector('[data-close-live]')).opacity),
        leadOpacity: Number(getComputedStyle(document.querySelector('[data-close-lead]')).opacity),
        whiteOpacity: Number(getComputedStyle(document.querySelector('[data-white]')).opacity),
      })));
      await page.screenshot({ path: path.join(output, device.name + '-desert-' + percent + '.png') });
    }
    const result = { device: device.name, states, errors: runtimeErrors };
    await fs.writeFile(path.join(output, device.name + '.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
    // If WebGL is available, the new renderer must have sized its actual canvas.
    if (states[2].canvasWidth === 0) throw new Error(device.name + ': living desert canvas was not initialized');
    if (states[1].canvasOpacity < 0.8) throw new Error(device.name + ': desert did not appear during scroll');
    if (states[4].whiteOpacity < 0.6) throw new Error(device.name + ': transition to white failed');
    if (runtimeErrors.length) throw new Error(device.name + ': ' + runtimeErrors.join(' | '));
    await page.close();
  }
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
