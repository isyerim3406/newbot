import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import http from 'http';
import nodemailer from 'nodemailer';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Port configuration
const PORT = process.env.PORT || 10000;

// Email ve Telegram yapılandırması
const EMAIL_TO = 'cetintok@yahoo.com';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8228322013:AAFEoX5PA76AoRFWA6H5k6Zn7x34RuVOXck';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '1347185585';

// Dynamic imports with error handling
let JIMP, optimizeChart;

try {
    console.log('JIMP yükleniyor...');
    const jimpModule = await import('jimp');
    JIMP = jimpModule.default;
    console.log('✓ JIMP yüklendi');

    console.log('optimizeChart yükleniyor...');
    try {
        const optimizeModule = await import('./optimizeChart.js');
        optimizeChart = optimizeModule.default;
        console.log('✓ optimizeChart yüklendi');
    } catch (error) {
        console.log('⚠️ optimizeChart bulunamadı, devam ediliyor');
        optimizeChart = async (page) => {
            console.log('Grafik optimizasyonu atlanıyor - modül bulunamadı');
        };
    }
} catch (error) {
    console.error('Bağımlılıklar yüklenemedi:', error);
    process.exit(1);
}

// Screenshots klasörünün varlığını kontrol et ve yoksa oluştur
const screenshotsDir = path.join(__dirname, 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
    console.log('✓ Screenshots klasörü oluşturuldu');
}

// Global variables to store results
let lastResult = {
    timestamp: new Date().toISOString(),
    status: 'başlatılıyor',
    signal: 'none',
    error: null,
    pixelColor: null
};

// Telegram mesaj gönderme fonksiyonu (fetch yerine axios kullanarak)
async function sendTelegramPhoto(screenshotPath, signalType) {
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
        
        // Node.js'te FormData için form-data paketi gerekli
        // Bunun yerine basit HTTP request kullanacağız
        const imageBuffer = fs.readFileSync(screenshotPath);
        const base64Image = imageBuffer.toString('base64');
        
        // Telegram'a base64 ile gönderme
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                photo: `data:image/png;base64,${base64Image}`,
                caption: `🚨 TradingView Sinyali: ${signalType}\n📊 ETHUSDT.P\n⏰ ${new Date().toLocaleString('tr-TR')}`
            })
        });

        if (response.ok) {
            console.log('✓ Telegram fotoğraf başarıyla gönderildi');
            return true;
        } else {
            const errorData = await response.json();
            console.error('❌ Telegram gönderme hatası:', errorData);
            return false;
        }
    } catch (error) {
        console.error('❌ Telegram gönderme hatası:', error.message);
        return false;
    }
}

// Alternatif Telegram gönderme fonksiyonu (multipart/form-data ile)
async function sendTelegramPhotoMultipart(screenshotPath, signalType) {
    try {
        const { default: FormData } = await import('form-data');
        const imageStream = fs.createReadStream(screenshotPath);
        
        const form = new FormData();
        form.append('chat_id', TELEGRAM_CHAT_ID);
        form.append('photo', imageStream);
        form.append('caption', `🚨 TradingView Sinyali: ${signalType}\n📊 ETHUSDT.P\n⏰ ${new Date().toLocaleString('tr-TR')}`);

        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
        
        const response = await fetch(url, {
            method: 'POST',
            body: form,
            headers: form.getHeaders()
        });

        if (response.ok) {
            console.log('✓ Telegram fotoğraf başarıyla gönderildi (multipart)');
            return true;
        } else {
            const errorData = await response.json();
            console.error('❌ Telegram gönderme hatası:', errorData);
            return false;
        }
    } catch (error) {
        console.error('❌ Telegram multipart gönderme hatası:', error.message);
        // Fallback olarak base64 metodunu dene
        return await sendTelegramPhoto(screenshotPath, signalType);
    }
}

// 3 defa bildirim gönderme fonksiyonu
async function sendNotifications(screenshotPath, signalType) {
    console.log(`📧 ${signalType} sinyali için bildirimler gönderiliyor...`);
    
    for (let i = 1; i <= 3; i++) {
        console.log(`📨 ${i}/3 bildirim gönderiliyor...`);
        
        // Önce multipart, sonra base64 dene
        let success = await sendTelegramPhotoMultipart(screenshotPath, signalType);
        
        if (!success) {
            console.log('Multipart başarısız, base64 deneniyor...');
            success = await sendTelegramPhoto(screenshotPath, signalType);
        }
        
        if (i < 3) {
            console.log('⏳ 10 saniye bekleniyor...');
            await new Promise(resolve => setTimeout(resolve, 10000));
        }
    }
    
    console.log('✅ Tüm bildirimler gönderildi');
}

async function takeChartScreenshot() {
    let browser;
    console.log('Tarayıcı başlatılıyor...');
    
    lastResult.status = 'çalışıyor';
    lastResult.timestamp = new Date().toISOString();

    try {
        // Chrome executable paths
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
                console.log(`✓ Chrome bulundu: ${chromePath}`);
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
        console.log('✓ Tarayıcı başarıyla başlatıldı');

        const page = await browser.newPage();
        
        await page.evaluateOnNewDocument(() => {
            delete Object.getPrototypeOf(navigator).webdriver;
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en']
            });
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5]
            });
        });

        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        const chartUrl = 'https://www.tradingview.com/chart/?symbol=BINANCE:ETHUSDT.P&interval=1';
        console.log(`Grafik sayfasına gidiliyor: ${chartUrl}`);

        await page.goto(chartUrl, {
            waitUntil: 'networkidle0',
            timeout: 120000
        });

        console.log('Sayfa yüklendi, grafik elementi bekleniyor...');
        
        let chartElement;
        const selectors = [
            '.chart-gui-wrapper',
            '.chart-container', 
            '#chart-container',
            '.tv-chart-container',
            '.chart'
        ];
        
        for (const selector of selectors) {
            try {
                await page.waitForSelector(selector, { timeout: 30000, visible: true });
                chartElement = await page.$(selector);
                if (chartElement) {
                    console.log(`✓ Grafik elementi bulundu: ${selector}`);
                    break;
                }
            } catch (e) {
                console.log(`⚠️ ${selector} bulunamadı, diğeri deneniyor...`);
            }
        }

        if (!chartElement) {
            const fullPagePath = path.join(screenshotsDir, `full-page-${Date.now()}.png`);
            await page.screenshot({ 
                path: fullPagePath, 
                fullPage: true 
            });
            console.log(`📸 Tam sayfa screenshot: ${fullPagePath}`);
            throw new Error('Grafik elementi sayfada bulunamadı!');
        }

        // Pop-up kapatma
        try {
            const popupSelectors = [
                'button[data-name="accept-recommended-settings"]',
                'button[data-name="close"]',
                '.close-button',
                '.modal-close',
                '[aria-label="Close"]'
            ];
            
            for (const selector of popupSelectors) {
                try {
                    const button = await page.$(selector);
                    if (button) {
                        console.log(`Pop-up kapatılıyor: ${selector}`);
                        await button.click();
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                } catch (e) {
                    // Devam et
                }
            }
        } catch (error) {
            console.log('Pop-up kontrolü tamamlandı');
        }

        console.log('Grafik arayüzü optimize ediliyor...');
        await optimizeChart(page);

        console.log('İndikatörlerin çizilmesi için 8 saniye bekleniyor...');
        await new Promise(resolve => setTimeout(resolve, 8000));

        const isVisible = await chartElement.evaluate(el => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && 
                   rect.top >= 0 && rect.left >= 0;
        });

        const timestamp = Date.now();
        const debugImagePath = path.join(screenshotsDir, `debug_screenshot_${timestamp}.png`);
        
        try {
            if (isVisible) {
                await chartElement.screenshot({ path: debugImagePath });
            } else {
                await page.screenshot({ path: debugImagePath, fullPage: true });
            }
            console.log(`Debug ekran görüntüsü kaydedildi: ${debugImagePath}`);
        } catch (screenshotError) {
            await page.screenshot({ path: debugImagePath, fullPage: true });
        }

        console.log('👀 Pixel analizi başlıyor...');
        let imageBuffer;
        
        try {
            if (isVisible) {
                imageBuffer = await chartElement.screenshot();
            } else {
                imageBuffer = await page.screenshot({ fullPage: true });
            }
        } catch (e) {
            imageBuffer = await page.screenshot({ fullPage: true });
        }
        
        const jimpImage = await JIMP.read(imageBuffer);

        const pixelX = 500;
        const pixelY = 500;

        const pixelColor = jimpImage.getPixelColor(pixelX, pixelY);
        const { r, g, b } = JIMP.intToRGBA(pixelColor);
        console.log(`Pikselin rengi: R=${r}, G=${g}, B=${b}`);

        const isGreen = g > r + 50 && g > b + 50;
        const isRed = r > g + 50 && r > b + 50;

        let signal = 'yok';
        if (isGreen) {
            console.log('Sinyal: Yeşil bulundu! 🟢');
            signal = 'YEŞİL';
            await sendNotifications(debugImagePath, 'YEŞİL');
        } else if (isRed) {
            console.log('Sinyal: Kırmızı bulundu! 🔴');
            signal = 'KIRMIZI';
            await sendNotifications(debugImagePath, 'KIRMIZI');
        } else {
            console.log('⏳ Sinyal yok...');
        }

        lastResult = {
            timestamp: new Date().toISOString(),
            status: 'tamamlandı',
            signal: signal,
            error: null,
            pixelColor: { r, g, b }
        };

        return lastResult;

    } catch (error) {
        console.error('Bir hata oluştu:', error);
        lastResult = {
            timestamp: new Date().toISOString(),
            status: 'hata',
            signal: 'yok',
            error: error.message,
            pixelColor: null
        };
        throw error;
    } finally {
        if (browser) {
            console.log('Tarayıcı kapatılıyor...');
            await browser.close();
        }
    }
}

// HTTP Server
const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    const url = new URL(req.url, `http://${req.headers.host}`);
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    try {
        switch (url.pathname) {
            case '/':
            case '/health':
                res.writeHead(200);
                res.end(JSON.stringify({
                    status: 'sağlıklı',
                    message: 'TradingView Bot çalışıyor',
                    timestamp: new Date().toISOString(),
                    lastResult: lastResult
                }));
                break;

            case '/scan':
                console.log('🚀 Manuel tarama isteği alındı');
                try {
                    const result = await takeChartScreenshot();
                    res.writeHead(200);
                    res.end(JSON.stringify({
                        success: true,
                        ...result
                    }));
                } catch (error) {
                    res.writeHead(500);
                    res.end(JSON.stringify({
                        success: false,
                        error: error.message,
                        timestamp: new Date().toISOString()
                    }));
                }
                break;

            case '/status':
                res.writeHead(200);
                res.end(JSON.stringify(lastResult));
                break;

            default:
                res.writeHead(404);
                res.end(JSON.stringify({
                    error: 'Endpoint bulunamadı',
                    availableEndpoints: ['/', '/health', '/scan', '/status']
                }));
        }
    } catch (error) {
        console.error('Server hatası:', error);
        res.writeHead(500);
        res.end(JSON.stringify({
            error: 'İç server hatası',
            message: error.message
        }));
    }
});

// Periyodik tarama (her 5 dakikada bir)
setInterval(async () => {
    try {
        console.log('🔄 Periyodik tarama başlıyor...');
        await takeChartScreenshot();
        console.log('✓ Periyodik tarama tamamlandı');
    } catch (error) {
        console.error('❌ Periyodik tarama başarısız:', error);
    }
}, 5 * 60 * 1000);

// Sunucuyu başlat
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Bot sunucusu ${PORT} portunda başlatıldı`);
    console.log(`Mevcut endpoint'ler:`);
    console.log(`  - GET /health - Sağlık kontrolü`);
    console.log(`  - GET /scan - Manuel tarama`);
    console.log(`  - GET /status - Son tarama sonucu`);
    
    setTimeout(async () => {
        try {
            console.log('🚀 İlk tarama başlıyor...');
            await takeChartScreenshot();
            console.log('✓ İlk tarama tamamlandı');
        } catch (error) {
            console.error('❌ İlk tarama başarısız:', error);
        }
    }, 5000);
});
