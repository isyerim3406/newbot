// index.js
import puppeteer from 'puppeteer';
import fs from 'fs';

// Environment variable'dan cookie base64 al
const b64_cookie = process.env.TV_COOKIE_BASE64;

if (!b64_cookie) {
  console.error("TV_COOKIE_BASE64 env variable bulunamadı!");
  process.exit(1);
}

// Base64'ten JSON'a decode et
let cookies;
try {
  cookies = JSON.parse(Buffer.from(b64_cookie, 'base64').toString());
} catch (err) {
  console.error("Cookie decode hatası:", err);
  process.exit(1);
}

(async () => {
  console.log("==> Chrome başlatılıyor...");

  const browser = await puppeteer.launch({
    headless: true, // Render'da headless olmalı
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  // Cookies'i sayfaya uygula
  try {
    await page.setCookie(...cookies);
    console.log("==> Cookies yüklendi.");
  } catch (err) {
    console.error("Cookie setleme hatası:", err);
    await browser.close();
    process.exit(1);
  }

  // TradingView ana sayfasına git
  try {
    await page.goto('https://www.tradingview.com/', { waitUntil: 'networkidle2', timeout: 60000 });
    console.log("==> TradingView sayfası açıldı.");
  } catch (err) {
    console.error("Sayfa açılırken timeout:", err);
    await browser.close();
    process.exit(1);
  }

  // Buradan sonra sayfada oturum açık, sinyal yakalama veya başka işlemler yapılabilir
  console.log("==> Login başarılı, sinyal bekleme aşamasına geçilebilir.");

  // Örnek: screenshot al
  await page.screenshot({ path: 'tv_home.png' });

  // Browser kapat
  await browser.close();
})();
