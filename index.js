import puppeteer from 'puppeteer';
import Jimp from 'jimp';  // pixel okuma için

const cookieB64 = process.env.TV_COOKIE_BASE64;
if (!cookieB64) {
  console.error("TV_COOKIE_BASE64 env değişkeni tanımlı değil!");
  process.exit(1);
}

const cookies = JSON.parse(Buffer.from(cookieB64, 'base64').toString('utf-8'));

// Pixel kontrol alanı
const AREA = { x1: 1773, y1: 139, x2: 1795, y2: 164 };
const BUY_RGB = { r: 76, g: 175, b: 80 };
const SELL_RGB = { r: 255, g: 82, b: 82 };

// Renk karşılaştırma toleransı
const TOL = 10;

function colorsMatch(c1, c2) {
  return Math.abs(c1.r - c2.r) <= TOL &&
         Math.abs(c1.g - c2.g) <= TOL &&
         Math.abs(c1.b - c2.b) <= TOL;
}

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: { width: 1920, height: 1080 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setCookie(...cookies);

  const url = 'https://www.tradingview.com/chart/?symbol=BINANCE:ETHUSDT&interval=1';
  console.log("Grafik açılıyor...");
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  console.log("Grafik açıldı, pixel kontrol ediliyor...");

  // Belirtilen alanın screenshot'unu al
  const clip = {
    x: AREA.x1,
    y: AREA.y1,
    width: AREA.x2 - AREA.x1,
    height: AREA.y2 - AREA.y1
  };
  const screenshotBuffer = await page.screenshot({ clip });

  // Jimp ile oku
  const image = await Jimp.read(screenshotBuffer);

  let signal = null;
  for (let x = 0; x < clip.width; x++) {
    for (let y = 0; y < clip.height; y++) {
      const { r, g, b } = Jimp.intToRGBA(image.getPixelColor(x, y));
      if (colorsMatch({ r, g, b }, BUY_RGB)) signal = 'BUY';
      if (colorsMatch({ r, g, b }, SELL_RGB)) signal = 'SELL';
      if (signal) break;
    }
    if (signal) break;
  }

  console.log("Sinyal:", signal || "Yok");

  await browser.close();
})();
