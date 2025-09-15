import puppeteer from 'puppeteer';
import express from 'express';
import fs from 'fs';
import path from 'path';

// Environment değişkeninden cookie base64
const cookieBase64 = process.env.TV_COOKIE_BASE64;
if (!cookieBase64) {
  console.error("TV_COOKIE_BASE64 env değişkeni bulunamadı!");
  process.exit(1);
}

// Base64'ten JSON’a çevir
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

  // Cookie ekle
  await page.setCookie(...cookies);

  // TradingView ana sayfasına git
  try {
    await page.goto('https://www.tradingview.com/', { waitUntil: 'networkidle2', timeout: 60000 });
    console.log('==> TradingView sayfasına giriş yapıldı (cookie ile)');
  } catch (err) {
    console.error('==> Sayfaya gitmede timeout:', err.message);
  }

  return { browser, page };
}

// Botu başlat
startBrowser().then(({ browser, page }) => {
  // Buraya sinyal okuma / işlemleri ekleyeceğiz
  console.log('==> Bot hazır, sinyalleri bekliyor...');
});

// Express server (Render free plan için gerekli)
app.get('/', (req, res) => res.send('TradingView Bot Alive ✅'));
app.listen(PORT, () => console.log(`==> Server port ${PORT} üzerinde dinleniyor`));
