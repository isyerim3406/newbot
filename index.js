import puppeteer from 'puppeteer';
import Jimp from 'jimp';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const TV_COOKIE_BASE64 = process.env.TV_COOKIE_BASE64;

async function decodeCookies() {
  const jsonStr = Buffer.from(TV_COOKIE_BASE64, 'base64').toString('utf-8');
  return JSON.parse(jsonStr);
}

async function getScreenshot(page) {
  // full page screenshot
  const screenshotBuffer = await page.screenshot({ fullPage: true });
  return Jimp.read(screenshotBuffer);
}

function checkSignal(image) {
  // Kontrol edilecek alan
  const startX = 1773;
  const startY = 139;
  const endX = 1795;
  const endY = 164;

  const buyColor = { r: 76, g: 175, b: 80 };
  const sellColor = { r: 255, g: 82, b: 82 };

  for (let x = startX; x <= endX; x++) {
    for (let y = startY; y <= endY; y++) {
      const pixel = Jimp.intToRGBA(image.getPixelColor(x, y));

      if (
        pixel.r === buyColor.r &&
        pixel.g === buyColor.g &&
        pixel.b === buyColor.b
      ) {
        return 'BUY';
      }

      if (
        pixel.r === sellColor.r &&
        pixel.g === sellColor.g &&
        pixel.b === sellColor.b
      ) {
        return 'SELL';
      }
    }
  }
  return null; // sinyal yok
}

async function main() {
  console.log('==> Chrome başlatılıyor...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Cookie yükleme
  const cookies = await decodeCookies();
  await page.setCookie(...cookies);

  // Grafiği aç
  await page.goto('https://www.tradingview.com/chart/?symbol=BINANCE:ETHUSDT', {
    waitUntil: 'networkidle2'
  });
  console.log('==> Grafiğe erişildi, pixel kontrolü başlıyor...');

  // Her 1 saniyede pixel kontrolü
  setInterval(async () => {
    const image = await getScreenshot(page);
    const signal = checkSignal(image);
    if (signal) {
      console.log('=== Sinyal:', signal, '==='); // burası Telegram entegrasyonu ile değiştirilebilir
    }
  }, 1000);
}

main().catch(console.error);
