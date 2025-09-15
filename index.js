import puppeteer from 'puppeteer';
import express from 'express';

// Env değişkeninden cookie base64
const cookieBase64 = process.env.TV_COOKIE_BASE64;
if (!cookieBase64) {
  console.error("TV_COOKIE_BASE64 env değişkeni bulunamadı!");
  process.exit(1);
}
const cookies = JSON.parse(Buffer.from(cookieBase64, 'base64').toString('utf-8'));

const app = express();
const PORT = process.env.PORT || 10000;

async function startBrowser() {
  console.log('==> Chrome başlatılıyor...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setCookie(...cookies);

  try {
    // Timeout 120 saniyeye çıkarıldı
    await page.goto('https://www.tradingview.com/', { waitUntil: 'networkidle2', timeout: 120000 });
    console.log('==> TradingView sayfasına giriş yapıldı (cookie ile)');
  } catch (err) {
    console.error('==> Sayfaya gitmede timeout:', err.message);
  }

  return { browser, page };
}

startBrowser().then(({ browser, page }) => {
  console.log('==> Bot hazır, sinyalleri bekliyor...');
});

app.get('/', (req, res) => res.send('TradingView Bot Alive ✅'));
app.listen(PORT, () => console.log(`==> Server port ${PORT} üzerinde dinleniyor`));
