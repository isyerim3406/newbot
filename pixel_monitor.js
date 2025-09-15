// pixel_monitor.js
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import { PNG } from 'pngjs';
import { sendTelegramMessage } from './telegram.js';

const TG_TOKEN = process.env.TG_TOKEN;
const TG_CHAT = process.env.TG_CHAT_ID;
const CLIP_X = Number(process.env.CLIP_X || 1000);
const CLIP_Y = Number(process.env.CLIP_Y || 300);
const CLIP_W = Number(process.env.CLIP_W || 10);
const CLIP_H = Number(process.env.CLIP_H || 10);
const POLL_MS = Number(process.env.POLL_MS || 5000);

function bufferHash(buf) {
  // simple checksum of buffer bytes
  let s = 0;
  for (let i = 0; i < buf.length; i++) s = (s + buf[i]) >>> 0;
  return s;
}

export async function startPixelMonitor({ cookieFile, chromePath }) {
  if (!chromePath) throw new Error('chromePath not set; cannot launch browser');

  console.log('Starting pixel monitor. cookieFile=', cookieFile);
  let browser = null;
  let page = null;
  let lastHash = null;

  async function launch() {
    console.log('Launching browser at', chromePath);
    browser = await puppeteer.launch({
      executablePath: chromePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      headless: true,
      defaultViewport: { width: 1920, height: 1080 }
    });
    page = await browser.newPage();
    // set user agent to reduce bot-detection
    await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36');
    if (fs.existsSync(cookieFile)) {
      try {
        const cookies = JSON.parse(fs.readFileSync(cookieFile, 'utf8'));
        if (Array.isArray(cookies) && cookies.length) {
          await page.setCookie(...cookies);
          console.log('Cookies loaded into page.');
        } else {
          console.warn('Cookie file empty or not an array.');
        }
      } catch (e) {
        console.warn('Failed to load/parse cookies:', e);
      }
    } else {
      console.warn('Cookie file does not exist:', cookieFile);
    }

    // go to TradingView chart
    console.log('Navigating to TradingView chart...');
    await page.goto('https://www.tradingview.com/chart/', { waitUntil: 'networkidle2', timeout: 60000 });
    // allow time to render chart canvas
    await page.waitForTimeout(8000);

    console.log('Page loaded, starting monitoring at', `${CLIP_X},${CLIP_Y} ${CLIP_W}x${CLIP_H}`);
  }

  async function doCheck() {
    try {
      const clip = { x: CLIP_X, y: CLIP_Y, width: CLIP_W, height: CLIP_H };
      const buf = await page.screenshot({ clip, omitBackground: true });
      const png = PNG.sync.read(buf);
      const hash = bufferHash(png.data);
      if (lastHash !== null && hash !== lastHash) {
        console.log('Pixel change detected', lastHash, '->', hash, 'at', new Date().toISOString());
        await sendTelegramMessage(TG_TOKEN, TG_CHAT, `TradingView pixel change detected at ${new Date().toISOString()}`);
      } else {
        console.log('No change. hash=', hash);
      }
      lastHash = hash;
    } catch (e) {
      console.error('Error during check:', e);
      throw e;
    }
  }

  // supervise + auto-restart loop
  while (true) {
    try {
      if (!browser) await launch();
      await doCheck();
      await new Promise(r => setTimeout(r, POLL_MS));
    } catch (err) {
      console.error('Monitor error, will restart browser in 5s:', err?.message || err);
      try { if (browser) await browser.close(); } catch(e){}
      browser = null; page = null;
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}
