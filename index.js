import puppeteer from 'puppeteer-core';

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.goto('https://www.tradingview.com');
  console.log('Chrome başlatıldı.');

  await browser.close();
})();
