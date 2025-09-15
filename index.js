// index.js (Fixed Version with Better Error Handling)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Dynamic imports with error handling
let puppeteer, StealthPlugin, JIMP, optimizeChart;

try {
    console.log('Loading puppeteer-extra...');
    const puppeteerExtraModule = await import('puppeteer-extra');
    puppeteer = puppeteerExtraModule.default;
    console.log('✓ puppeteer-extra loaded');

    console.log('Loading stealth plugin...');
    const stealthModule = await import('puppeteer-extra-plugin-stealth');
    StealthPlugin = stealthModule.default;
    console.log('✓ stealth plugin loaded');

    console.log('Loading JIMP...');
    const jimpModule = await import('jimp');
    JIMP = jimpModule.default;
    console.log('✓ JIMP loaded');

    console.log('Loading optimizeChart...');
    try {
        const optimizeModule = await import('./optimizeChart.js');
        optimizeChart = optimizeModule.default;
        console.log('✓ optimizeChart loaded');
    } catch (error) {
        console.log('⚠️ optimizeChart not found, continuing without it');
        optimizeChart = async (page) => {
            console.log('Skipping chart optimization - module not available');
        };
    }

    // Use Stealth plugin
    puppeteer.use(StealthPlugin());
    console.log('✓ Stealth plugin registered');

} catch (error) {
    console.error('Failed to load dependencies:', error);
    process.exit(1);
}

// Screenshots klasörünün varlığını kontrol et ve yoksa oluştur
const screenshotsDir = path.join(__dirname, 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
    console.log('✓ Screenshots directory created');
}

async function takeChartScreenshot() {
    let browser;
    console.log('Tarayıcı başlatılıyor...');

    try {
        // Chrome executable paths to try
        const chromePaths = [
            '/usr/bin/google-chrome-stable',
            '/usr/bin/google-chrome',
            '/usr/bin/chromium-browser',
            '/usr/bin/chromium',
            process.env.CHROME_BIN
        ].filter(Boolean);

        let executablePath;
        for (const path of chromePaths) {
            if (fs.existsSync(path)) {
                executablePath = path;
                console.log(`✓ Chrome found at: ${path}`);
                break;
            }
        }

        const launchOptions = {
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
                '--window-size=1920,1080',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor'
            ]
        };

        if (executablePath) {
            launchOptions.executablePath = executablePath;
        }

        browser = await puppeteer.launch(launchOptions);
        console.log('✓ Browser launched successfully');

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

        // Pop-up ve çerez bildirimlerini kapatmaya çalış
        try {
            console.log('Çerez veya pop-up bildirimi aranıyor...');
            const acceptButton = await page.waitForSelector('button[data-name="accept-recommended-settings"]', { timeout: 5000 });
            if (acceptButton) {
                console.log('Çerez bildirimi kapatılıyor.');
                await acceptButton.click();
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } catch (error) {
            console.log('Kapatılacak bir pop-up bulunamadı, devam ediliyor.');
        }

        // Grafik arayüzünü optimize et
        console.log('Grafik arayüzü optimize ediliyor...');
        await optimizeChart(page);
        console.log('Optimizasyon tamamlandı.');

        // İndikatörlerin çizilmesi için bekleme
        console.log('İndikatörlerin çizilmesi için 5 saniye bekleniyor...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Hata ayıklama (debug) için ekran görüntüsü al
        const chartElement = await page.$('.chart-gui-wrapper');
        if (!chartElement) {
            throw new Error('Grafik elementi sayfada bulunamadı!');
        }

        const debugImagePath = path.join(screenshotsDir, 'debug_screenshot.png');
        await chartElement.screenshot({ path: debugImagePath });
        console.log(`Debug ekran görüntüsü şuraya kaydedildi: ${debugImagePath}`);

        // Piksel analizi
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
            console.log('Sinyal: Yeşil bulundu! 🟢');
        } else if (isRed) {
            console.log('Sinyal: Kırmızı bulundu! 🔴');
        } else {
            console.log('⏳ Sinyal yok...');
        }

    } catch (error) {
        console.error('Bir hata oluştu:', error);
        throw error;
    } finally {
        if (browser) {
            console.log('Tarayıcı kapatılıyor...');
            await browser.close();
        }
    }
}

// Ana fonksiyonu çalıştır
console.log('🚀 Bot başlatılıyor...');
takeChartScreenshot()
    .then(() => {
        console.log('✓ İşlem başarıyla tamamlandı!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ İşlem başarısız:', error);
        process.exit(1);
    });
