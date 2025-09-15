import puppeteer from 'puppeteer';
import fs from 'fs';
import http from 'http';

// ENV üzerinden base64 cookie alıyoruz
const base64Cookie = process.env.TV_COOKIE_BASE64;
const cookieJson = JSON.parse(Buffer.from(base64Cookie, 'base64').toString('utf-8'));

async function startBot() {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Cookie ile login
    await page.setCookie(...cookieJson);
    await page.goto('https://www.tradingview.com', { waitUntil: 'networkidle2' });

    try {
        await page.waitForSelector('.tv-header__user-menu', { timeout: 5000 });
        console.log('==> TradingView login başarılı!');

        // Buraya bot fonksiyonlarını ekleyebilirsin
        // Örn: await checkSignals(page);

    } catch (err) {
        console.log('==> Login başarısız veya cookie geçersiz.', err);
    }

    return { browser, page };
}

// Basit HTTP server (Render’da free user için gerekli)
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('TradingView Bot çalışıyor!\n');
}).listen(PORT, () => {
    console.log(`==> Server port ${PORT} üzerinde dinleniyor`);
});

// Botu başlat
startBot().then(() => console.log('==> Bot başlatıldı 🎉'))
    .catch(err => console.error('==> Bot başlatılamadı', err));
