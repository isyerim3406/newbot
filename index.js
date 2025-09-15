// index.js (Tüm dosyanın güncel hali)

// puppeteer yerine puppeteer-extra'yı içe aktar
import puppeteer from 'puppeteer-extra';
// Stealth eklentisini içe aktar
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

import fs from 'fs';
import path from 'path';
import optimizeChart from './optimizeChart.js';

// Stealth eklentisini puppeteer'a tanıt
puppeteer.use(StealthPlugin());

// ... (geri kalan kodunuz aynı kalabilir) ...

async function takeChartScreenshot() {
  let browser;
  console.log('Tarayıcı başlatılıyor...');

  try {
    browser = await puppeteer.launch({ // puppeteer.launch() olarak kalacak
      executablePath: '/usr/bin/google-chrome-stable',
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process', // Bu özellikle düşük RAM'li ortamlarda yardımcı olabilir
        '--disable-gpu',
        '--window-size=1920,1080'
      ]
    });
    
    // ...

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    const chartUrl = 'https://www.tradingview.com/chart/?symbol=NASDAQ:AAPL';
    console.log(`Grafik sayfasına gidiliyor: ${chartUrl}`);
    
    // 1. ADIMDAKİ GÜNCELLEME BURADA
    await page.goto(chartUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 120000
    });
    
    console.log('Sayfa yüklendi, grafik elementi bekleniyor...');
    await page.waitForSelector('.chart-gui-wrapper', { timeout: 120000 });
    console.log('Grafik elementi bulundu.');

    // ... (kodun geri kalanı - optimizeChart, screenshot vs.)
    
    console.log('Grafik arayüzü optimize ediliyor...');
    await optimizeChart(page);
    console.log('Optimizasyon tamamlandı.');

    const chartElement = await page.$('.chart-gui-wrapper');
    if (!chartElement) {
        throw new Error('Grafik elementi sayfada bulunamadı!');
    }
    
    // ... ekran görüntüsü alma ve diğer işlemleriniz ...

  } catch (error) {
    console.error('Bir hata oluştu:', error);
  } finally {
    if (browser) {
      console.log('Tarayıcı kapatılıyor...');
      await browser.close();
    }
  }
}

takeChartScreenshot();
