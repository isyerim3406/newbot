import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import optimizeChart from './optimizeChart.js'; // Yerel modülü içe aktar

// Ekran görüntülerinin kaydedileceği klasör
const screenshotsDir = path.join(process.cwd(), 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// Ana fonksiyon
async function takeChartScreenshot() {
  let browser;
  console.log('Tarayıcı başlatılıyor...');

  try {
    // Tarayıcıyı Render.com ortamı için önerilen ayarlarla başlat
    browser = await puppeteer.launch({
      executablePath: '/usr/bin/google-chrome-stable', // render-build.sh ile kurulan Chrome'un yolu
      headless: 'new', // Yeni headless modu önerilir
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // Paylaşılan bellek sorunlarını önler
        '--single-process',
        '--window-size=1920,1080' // Pencere boyutunu belirle
      ]
    });

    console.log('Tarayıcı başarıyla başlatıldı.');
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Örnek bir TradingView URL'si (Bunu istediğinizle değiştirebilirsiniz)
    const chartUrl = 'https://www.tradingview.com/chart/?symbol=NASDAQ:AAPL';
    console.log(`Grafik sayfasına gidiliyor: ${chartUrl}`);
    
    // Sayfaya git ve tamamen yüklenmesini bekle
    await page.goto(chartUrl, { waitUntil: 'networkidle0', timeout: 60000 });
    console.log('Sayfa yüklendi.');

    // Grafiğin arayüzünü temizlemek için harici fonksiyonu çağır
    console.log('Grafik arayüzü optimize ediliyor...');
    await optimizeChart(page); //
    console.log('Optimizasyon tamamlandı.');

    // Grafiğin bulunduğu ana elementi hedef al
    const chartElement = await page.$('.chart-gui-wrapper');
    if (!chartElement) {
        throw new Error('Grafik elementi sayfada bulunamadı!');
    }

    const screenshotPath = path.join(screenshotsDir, 'tradingview-chart.png');
    console.log(`Ekran görüntüsü alınıyor ve şuraya kaydediliyor: ${screenshotPath}`);

    // Sadece grafik elementinin ekran görüntüsünü al
    await chartElement.screenshot({
      path: screenshotPath,
      omitBackground: true
    });

    console.log('Ekran görüntüsü başarıyla alındı.');

  } catch (error) {
    console.error('Bir hata oluştu:', error);
  } finally {
    if (browser) {
      console.log('Tarayıcı kapatılıyor...');
      await browser.close();
    }
  }
}

// Ana fonksiyonu çalıştır
takeChartScreenshot();
