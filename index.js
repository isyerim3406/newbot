const puppeteer = require('puppeteer');
const fetch = require('node-fetch');
const http = require('http');

const PORT = process.env.PORT || 3000;

// Basit HTTP server (Render port check için)
http.createServer((req, res) => {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('TradingView bot çalışıyor ✅');
}).listen(PORT, () => {
    console.log(`==> Server port ${PORT} üzerinde dinleniyor`);
});

// Puppeteer bot örneği
(async () => {
    console.log('==> Chrome başlatılıyor...');
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto('https://www.tradingview.com');

    console.log('==> Sayfa açıldı:', await page.title());

    // Burada bot mantığını ekleyebilirsin
    // Örnek: veri çekme veya screenshot
    // await page.screenshot({path: 'tradingview.png'});

    // Chrome açık kalsın, Render container sürekli çalışacak
})();
