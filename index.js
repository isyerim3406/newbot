// index.js (Güncellenmiş Tam Kod)

// puppeteer yerine puppeteer-extra'yı içe aktar
import puppeteer from 'puppeteer-extra';
// Stealth eklentisini içe aktar
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

import fs from 'fs';
import path from 'path';
import optimizeChart from './optimizeChart.js';
import JIMP from 'jimp';

// Stealth eklentisini puppeteer'a tanıt
puppeteer.use(StealthPlugin());

// Screenshots klasörünün varlığını kontrol et ve yoksa oluştur
const screenshotsDir = path.join(__dirname, 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir);
}

async function takeChartScreenshot() {
    let browser;
    console.log('Tarayıcı başlatılıyor...');

    try {
        browser = await puppeteer.launch({
            executablePath: '/usr/bin/google-chrome-stable',
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu',
                '--window-size=1920,1080'
            ]
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        const chartUrl = 'https://www.tradingview.com/chart/?symbol=BINANCE:ETHUSDT.P&interval=1';
        console.log(`Grafik sayfasına gidiliyor: ${chartUrl}`);

        await page.goto(chartUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 120000
        });

        console.log('Sayfa yüklendi, grafik elementi bekleniyor...');
        await page.waitForSelector('.chart-gui-wrapper', { timeout: 120000 });
        console.log('Grafik elementi bulundu.');

        // --- YENİ EKLENEN KOD BAŞLANGICI ---

        // 1. Pop-up ve çerez bildirimlerini kapatmaya çalışın
        try {
            console.log('Çerez veya pop-up bildirimi aranıyor...');
            const acceptButton = await page.waitForSelector('button[data-name="accept-recommended-settings"]', { timeout: 5000 });
            if (acceptButton) {
                console.log('Çerez bildirimi kapatılıyor.');
                await acceptButton.click();
                await new Promise(resolve => setTimeout(resolve, 1000)); // Kapanması için 1sn bekle
            }
        } catch (error) {
            console.log('Kapatılacak bir pop-up bulunamadı, devam ediliyor.');
        }

        // 2. Grafik arayüzünü optimize edin
        console.log('Grafik arayüzü optimize ediliyor...');
        await optimizeChart(page);
        console.log('Optimizasyon tamamlandı.');

        // 3. İndikatörlerin çizilmesi için bekleme
        console.log('İndikatörlerin çizilmesi için 5 saniye bekleniyor...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        // 4. Hata ayıklama (debug) için ekran görüntüsü al
        const chartElement = await page.$('.chart-gui-wrapper');
        if (!chartElement) {
            throw new Error('Grafik elementi sayfada bulunamadı!');
        }

        const debugImagePath = path.join(screenshotsDir, 'debug_screenshot.png');
        await chartElement.screenshot({ path: debugImagePath });
        console.log(`Debug ekran görüntüsü şuraya kaydedildi: ${debugImagePath}`);

        // 5. Piksel analizi
        console.log('👀 Pixel analizi başlıyor...');
        const imageBuffer = await chartElement.screenshot();
        const jimpImage = await JIMP.read(imageBuffer);

        // Bu koordinatları debug ekran görüntüsünü inceleyerek bulmalısınız!
        const pixelX = 500;
        const pixelY = 500;

        const pixelColor = jimpImage.getPixelColor(pixelX, pixelY);
        const { r, g, b } = JIMP.intToRGBA(pixelColor);
        console.log(`Pikselin rengi: R=${r}, G=${g}, B=${b}`);

        const isGreen = g > r + 50 && g > b + 50;
        const isRed = r > g + 50 && r > b + 50;

        if (isGreen) {
            console.log('Sinyal: Yeşil bulundu!');
        } else if (isRed) {
            console.log('Sinyal: Kırmızı bulundu!');
        } else {
            console.log('⏳ Sinyal yok...');
        }

        // --- YENİ EKLENEN KOD BİTİŞİ ---

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
