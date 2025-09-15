// index.js
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { startPixelMonitor } from './pixel_monitor.js';

dotenv.config();

const RENDER_COOKIES_DIR = '/opt/render/project/.render/cookies';
const COOKIE_FILE = process.env.COOKIE_FILE || path.join(RENDER_COOKIES_DIR, 'cookies.json');
const COOKIE_B64 = process.env.COOKIE_B64 || '';

// ensure cookies dir
try { fs.mkdirSync(RENDER_COOKIES_DIR, { recursive: true }); } catch(e){}

if (COOKIE_B64) {
  try {
    const buf = Buffer.from(COOKIE_B64, 'base64');
    fs.writeFileSync(COOKIE_FILE, buf);
    console.log('Decoded COOKIE_B64 to', COOKIE_FILE);
  } catch (e) {
    console.error('Failed to decode COOKIE_B64:', e);
  }
} else {
  console.log('COOKIE_B64 not provided; expecting cookies at', COOKIE_FILE);
}

// autodetect CHROME_BIN if not set
function findChrome() {
  const env = process.env.CHROME_BIN;
  if (env && fs.existsSync(env)) return env;

  const candidates = [
    '/opt/render/project/.render/chrome/opt/google/chrome/google-chrome',
    '/opt/render/project/.render/chrome/chrome-for-testing/chrome',
    '/opt/render/project/.render/chrome/chrome-for-testing/chrome-linux/chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }

  // scan .render for "chrome" binary
  try {
    const files = fs.readdirSync('/opt/render/project/.render', { withFileTypes: true });
    for (const f of files) {
      // skip
    }
  } catch (_) {}

  return env || null;
}

const CHROME_BIN = findChrome();
if (!CHROME_BIN) {
  console.warn('CHROME binary not found. Set CHROME_BIN env or check build logs.');
} else {
  process.env.CHROME_BIN = CHROME_BIN;
  console.log('Using CHROME_BIN:', CHROME_BIN);
}

// start
startPixelMonitor({
  cookieFile: COOKIE_FILE,
  chromePath: CHROME_BIN
}).catch(err => {
  console.error('Pixel monitor failed:', err);
  process.exit(1);
});
