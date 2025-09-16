// index.js (Email ve Telegram Bildirimleri ile Düzeltilmiş Versiyon)

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import http from 'http';
import nodemailer from 'nodemailer';
import axios from 'axios';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Port configuration
const PORT = process.env.PORT || 10000;

// Email ve Telegram yapılandırması
const EMAIL_TO = 'cetintok@yahoo.com';
const TELEGRAM_BOT_TOKEN = '8228322013:AAFEoX5PA76AoRFWA6H5k6Zn7x34RuVOXck';
const TELEGRAM_CHAT_ID = '1347185585';

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

// Email gönderme fonksiyonu
async function sendEmail(screenshotPath, signalType) {
    try {
        // Gmail için nodemailer yapılandırması (app password gerekli)
        const transporter = nodemailer.createTransporter({
            service: 'gmail',
            auth: {
                user: 'your-email@gmail.com', // Buraya kendi Gmail adresinizi yazın
                pass: 'your-app-password'      // Gmail App Password gerekli
            }
        });

        const mailOptions = {
            from: 'your-email@gmail.com',
            to: EMAIL_TO,
            subject: `TradingView Bot Sinyali: ${signalType}`,
            text: `Sinyal tespit edildi: ${signalType}\nTarih: ${new Date().toLocaleString('tr-TR')}`,
            attachments: [
                {
                    filename: 'chart-screenshot.png',
                    path: screenshotPath
                }
            ]
        };

        await transporter.sendMail(mailOptions);
        console.log('✓ Email başarıyla gönderildi');
        return true;
    } catch (error) {
        console.error('❌ Email gönderme hatası:', error.message);
        return false;
    }
}

// Telegram mesaj gönderme fonksiyonu
async function sendTelegramPhoto(screenshotPath, signalType) {
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
        
        const formData = new FormData();
        const imageBuffer = fs.readFileSync(screenshotPath);
        const blob = new Blob([imageBuffer], { type: 'image/png' });
        
        formData.append('chat_id', TELEGRAM_CHAT_ID);
        formData.append('photo', blob, 'chart-screenshot.png');
        formData.append('caption', `🚨 TradingView Sinyali: ${signalType}\n📊 ETHUSDT.P\n⏰ ${new Date().toLocaleString('tr-TR')}`);

        const response = await fetch(url, {
            method: 'POST',
            body: formData
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

// 3 defa bildirim gönderme fonksiyonu
async function sendNotifications(screenshotPath, signalType) {
    console.log(`📧 ${signalType} sinyali için bildirimler gönderiliyor...`);
    
    for (let i = 1; i <= 3; i++) {
        console.log(`📨 ${i}/3 bildirim gönderiliyor...`);
        
        // Telegram gönder
        await sendTelegramPhoto(screenshotPath, signalType);
        
        // Email gönder (opsiyonel - Gmail yapılandırması gerekli)
        // await sendEmail(screenshotPath, signalType);
        
        if (i < 3) {
            console.log('⏳ 10 saniye bekleniyor...');
            await new Promise(resolve => setTimeout(resolve, 10000)); // 10 saniye bekle
        }
    }
    
    console.log('✅ Tüm bildirimler gönderildi');
}

async function takeChartScreenshot() {
    let browser;
    console.log('Tarayıcı başlatılıyor...');
    
    // Durumu güncelle
    lastResult.status = 'çalışıyor';
    lastResult.timestamp = new Date().toISOString();

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
        
        // Stealth teknikleri manuel olarak ekle
        await page.evaluateOnNewDocument(() => {
            // Webdriver özelliğini kaldır
            delete Object.getPrototypeOf(navigator).webdriver;
            
            // Dil ve eklentileri taklit et
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en']
            });
            
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5]
            });
            
            // İzinleri taklit et
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
            waitUntil: 'networkidle0', // Tüm network istekleri bitene kadar bekle
            timeout: 120000
        });

        console.log('Sayfa yüklendi, grafik elementi bekleniyor...');
        
        // Daha güvenli element bekleme
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
            // Tam sayfa screenshot'ı al
            console.log('⚠️ Grafik elementi bulunamadı, tam sayfa screenshot alınıyor...');
            const fullPagePath = path.join(screenshotsDir, `full-page-${Date.now()}.png`);
            await page.screenshot({ 
                path: fullPagePath, 
                fullPage: true 
            });
            console.log(`📸 Tam sayfa screenshot: ${fullPagePath}`);
            
            throw new Error('Grafik elementi sayfada bulunamadı!');
        }

        // Pop-up ve çerez bildirimlerini kapatmaya çalış
        try {
            console.log('Çerez veya pop-up bildirimi aranıyor...');
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

        // Grafik arayüzünü optimize et
        console.log('Grafik arayüzü optimize ediliyor...');
        await optimizeChart(page);
        console.log('Optimizasyon tamamlandı.');

        // İndikatörlerin çizilmesi için bekleme
        console.log('İndikatörlerin çizilmesi için 8 saniye bekleniyor...');
        await new Promise(resolve => setTimeout(resolve, 8000));

        // Elementin görünür olduğunu kontrol et
        const isVisible = await chartElement.evaluate(el => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && 
                   rect.top >= 0 && rect.left >= 0;
        });

        if (!isVisible) {
            console.log('⚠️ Element görünür değil, tam sayfa screenshot alınıyor...');
            const timestamp = Date.now();
            const fullPagePath = path.join(screenshotsDir, `backup-screenshot-${timestamp}.png`);
            await page.screenshot({ 
                path: fullPagePath, 
                fullPage: true 
            });
            console.log(`📸 Yedek screenshot: ${fullPagePath}`);
        }

        // Debug için ekran görüntüsü al
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
            console.log('Screenshot alma hatası, tam sayfa deneniyor...');
            await page.screenshot({ path: debugImagePath, fullPage: true });
        }

        // Piksel analizi
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

        // Bu koordinatları debug ekran görüntüsünü inceleyerek bulmalısınız!
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
            // Bildirim gönder
            await sendNotifications(debugImagePath, 'YEŞİL');
        } else if (isRed) {
            console.log('Sinyal: Kırmızı bulundu! 🔴');
            signal = 'KIRMIZI';
            // Bildirim gönder
            await sendNotifications(debugImagePath, 'KIRMIZI');
        } else {
            console.log('⏳ Sinyal yok...');
        }

        // Sonucu güncelle
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
    // CORS headers ayarla
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
}, 5 * 60 * 1000); // 5 dakika

// Sunucuyu başlat
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Bot sunucusu ${PORT} portunda başlatıldı`);
    console.log(`Mevcut endpoint'ler:`);
    console.log(`  - GET /health - Sağlık kontrolü`);
    console.log(`  - GET /scan - Manuel tarama`);
    console.log(`  - GET /status - Son tarama sonucu`);
    
    // İlk taramayı başlat
    setTimeout(async () => {
        try {
            console.log('🚀 İlk tarama başlıyor...');
            await takeChartScreenshot();
            console.log('✓ İlk tarama tamamlandı');
        } catch (error) {
            console.error('❌ İlk tarama başarısız:', error);
        }
    }, 5000); // Sunucu başladıktan 5 saniye sonra
});
