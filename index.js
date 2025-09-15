import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/usr/bin/google-chrome-stable', // sistem Chrome kullan
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // TradingView login ve cookie yükleme
  await page.goto('https://www.tradingview.com');
  // Burada cookie yüklemesini yap
  // await page.setCookie(...cookies);

  console.log('Chrome başlatıldı, sayfa açıldı.');

  // Örnek ekran yakalama (Buy/Sell pixel alanı)
  const screenshot = await page.screenshot({ fullPage: true });
  console.log('Screenshot alındı, byte length:', screenshot.length);

  await browser.close();
})();
