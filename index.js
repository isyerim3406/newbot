// index.js (Modern Version without puppeteer-extra)

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Dynamic imports with error handling
let JIMP, optimizeChart;

try {
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
        for (const chromePath of chromePaths) {
            if (fs.existsSync(chromePath)) {
                executablePath = chromePath;
                console.log(`✓ Chrome found at: ${chromePath}`);
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
                '--disable-features=VizDisplayCompositor',
                '--disable-blink-features=AutomationControlled',
                '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            ]
        };

        if (executablePath) {
            launchOptions.executablePath = executablePath;
        }

        browser = await puppeteer.launch(launchOptions);
        console.log('✓ Browser launched successfully');

        const page = await browser.newPage();
        
        // Add stealth techniques manually
        await page.evaluateOnNewDocument(() => {
            // Remove webdriver property
            delete Object.getPrototypeOf(navigator).webdriver;
            
            // Mock languages and plugins
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en']
            });
            
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5]
            });
            
            // Mock permissions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );
        });

        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

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

        // Additional popup handling
        try {
            const closeButtons = await page.$$('button[aria-label="Close"], button[data-name="close"], .close-button, .modal-close');
            for (const button of closeButtons) {
                try {
                    await button.click();
                    console.log('Pop-up kapatıldı');
                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch (e) {
                    // Ignore if button is not clickable
                }
            }
        } catch (error) {
            console.log('Ek pop-up kontrolü tamamlandı');
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
