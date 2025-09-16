// index.js (Düzeltilmiş ve İyileştirilmiş Versiyon)

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import http from 'http';
import nodemailer from 'nodemailer';
import axios from 'axios';
import FormData from 'form-data'; // <<< DEĞİŞİKLİK: Telegram için form-data ekledik

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Port configuration
const PORT = process.env.PORT || 10000;

// <<< DEĞİŞİKLİK: Yapılandırmayı ortam değişkenlerinden (environment variables) alıyoruz
const EMAIL_TO = process.env.EMAIL_TO || 'cetintok@yahoo.com';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Dynamic imports with error handling
let JIMP, optimizeChart;

try {
    console.log('JIMP yükleniyor...');
    const jimpModule = await import('jimp');
    JIMP = jimpModule.default;
    console.log('✓ JIMP yüklendi');

    console.log('optimizeChart yükleniyor...');
    const optimizeModule = await import('./optimizeChart.js');
    optimizeChart = optimizeModule.default;
    console.log('✓ optimizeChart yüklendi');
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

// <<< DEĞİŞİKLİK: Tek ve kalıcı bir tarayıcı örneği için global değişken
let browserInstance = null;

// Email gönderme fonksiyonu (Değişiklik yok, ancak App Password gerektirir)
async function sendEmail(screenshotPath, signalType) {
    // ... (Mevcut kodunuzda değişiklik yok)
}

// Telegram mesaj gönderme fonksiyonu
async function sendTelegramPhoto(screenshotPath, caption) {
    // <<< DEĞİŞİKLİK: Hata ayıklama mesajları için caption parametresi eklendi
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        console.warn('❌ Telegram Bot Token veya Chat ID ayarlanmamış. Mesaj gönderilemiyor.');
        return false;
    }
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
        const formData = new FormData();
        
        formData.append('chat_id', TELEGRAM_CHAT_ID);
        formData.append('photo', fs.createReadStream(screenshotPath));
        formData.append('caption', caption);

        const response = await axios.post(url, formData, {
            headers: formData.getHeaders()
        });

        if (response.data.ok) {
            console.log('✓ Telegram fotoğraf başarıyla gönderildi');
            return true;
        } else {
            console.error('❌ Telegram gönderme hatası:', response.data);
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
    const caption = `🚨 TradingView Sinyali: ${signalType}\n📊 ETHUSDT.P\n⏰ ${new Date().toLocaleString('tr-TR')}`;

    for (let i = 1; i <= 3; i++) {
        console.log(`📨 ${i}/3 bildirim gönderiliyor...`);
        await sendTelegramPhoto(screenshotPath, caption);
        if (i < 3) {
            console.log('⏳ 10 saniye bekleniyor...');
            await new Promise(resolve => setTimeout(resolve, 10000)); // 10 saniye bekle
        }
    }
    console.log('✅ Tüm bildirimler gönderildi');
}

// <<< DEĞİŞİKLİK: Tarayıcıyı başlatan ve yeniden kullanan fonksiyon
async function getBrowserInstance() {
    if (browserInstance && browserInstance.isConnected()) {
        console.log('✓ Mevcut tarayıcı örneği kullanılıyor.');
        return browserInstance;
    }

    console.log('Yeni tarayıcı örneği başlatılıyor...');
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
        ]
    };

    // Render ortamında Google Chrome'un yolunu otomatik bulmaya gerek yok, CHROME_BIN yeterli.
    if (process.env.CHROME_BIN && fs.existsSync(process.env.CHROME_BIN)) {
        console.log(`✓ Chrome yolu kullanılıyor: ${process.env.CHROME_BIN}`);
        launchOptions.executablePath = process.env.CHROME_BIN;
    }

    browserInstance = await puppeteer.launch(launchOptions);
    
    browserInstance.on('disconnected', () => {
        console.error('❌ Tarayıcı bağlantısı koptu! Tarayıcı örneği temizleniyor.');
        browserInstance = null;
    });

    console.log('✓ Tarayıcı başarıyla başlatıldı.');
    return browserInstance;
}

async function takeChartScreenshot() {
    let page;
    lastResult.status = 'çalışıyor';
    lastResult.timestamp = new Date().toISOString();

    const timestamp = Date.now();
    const debugImagePath = path.join(screenshotsDir, `debug_screenshot_${timestamp}.png`);

    try {
        const browser = await getBrowserInstance();
        page = await browser.newPage();
        
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        const chartUrl = 'https://www.tradingview.com/chart/?symbol=BINANCE:ETHUSDT.P&interval=1';
        console.log(`Grafik sayfasına gidiliyor: ${chartUrl}`);
        await page.goto(chartUrl, { waitUntil: 'networkidle2', timeout: 120000 });
        console.log('✓ Sayfa yüklendi.');

        // <<< DEĞİŞİKLİK: Pop-up'ları kapatmak için daha agresif bir bekleme
        console.log('Pop-up ve çerez bildirimleri kontrol ediliyor...');
        try {
            const acceptButtonSelector = 'button[data-name="accept-recommended-settings"]';
            await page.waitForSelector(acceptButtonSelector, { timeout: 10000, visible: true });
            await page.click(acceptButtonSelector);
            console.log('✓ Çerez bildirimi kapatıldı.');
            await new Promise(resolve => setTimeout(resolve, 2000)); // Kapanma animasyonu için bekle
        } catch (e) {
            console.log('ℹ️ Çerez bildirimi bulunamadı veya zaten kapalı.');
        }

        console.log('Grafik elementi bekleniyor...');
        const chartWrapperSelector = '.chart-gui-wrapper';
        await page.waitForSelector(chartWrapperSelector, { timeout: 30000, visible: true });
        const chartElement = await page.$(chartWrapperSelector);
        console.log('✓ Grafik elementi bulundu.');

        // <<< DEĞİŞİKLİK: Grafik optimizasyonu pop-up'tan sonra yapılıyor
        console.log('Grafik arayüzü optimize ediliyor...');
        await optimizeChart(page);
        console.log('✓ Optimizasyon tamamlandı.');

        // <<< DEĞİŞİKLİK: Sabit bekleme yerine, grafiğin içinin dolmasını bekliyoruz
        console.log('Grafiğin çizilmesi (render) bekleniyor...');
        await page.waitForFunction(
            (selector) => {
                const elem = document.querySelector(selector);
                // Elementin ve içindeki canvas'ın boyutlarının sıfırdan büyük olmasını bekle
                return elem && elem.getBoundingClientRect().width > 0 && elem.querySelector('canvas');
            },
            { timeout: 30000 },
            chartWrapperSelector
        );
        console.log('✓ Grafik başarıyla render edildi.');
        
        await chartElement.screenshot({ path: debugImagePath });
        console.log(`✓ Ekran görüntüsü kaydedildi: ${debugImagePath}`);

        console.log('👀 Piksel analizi başlıyor...');
        const jimpImage = await JIMP.read(debugImagePath);
        const pixelX = 500;
        const pixelY = 500;
        const pixelColor = jimpImage.getPixelColor(pixelX, pixelY);
        const { r, g, b } = JIMP.intToRGBA(pixelColor);
        console.log(`Pikselin rengi: R=${r}, G=${g}, B=${b}`);

        const isGreen = g > r + 50 && g > b + 50;
        const isRed = r > g + 50 && r > b + 50;
        let signal = 'yok';

        if (isGreen) {
            signal = 'YEŞİL';
            console.log('Sinyal: Yeşil bulundu! 🟢');
            await sendNotifications(debugImagePath, signal);
        } else if (isRed) {
            signal = 'KIRMIZI';
            console.log('Sinyal: Kırmızı bulundu! 🔴');
            await sendNotifications(debugImagePath, signal);
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

    } catch (error) {
        console.error('❌ Tarama sırasında bir hata oluştu:', error.message);
        lastResult = {
            timestamp: new Date().toISOString(),
            status: 'hata',
            signal: 'yok',
            error: error.message,
            pixelColor: null
        };
        
        // <<< DEĞİŞİKLİK: Hata durumunda ekran görüntüsünü Telegram'a gönder
        if (page) {
            try {
                const errorImagePath = path.join(screenshotsDir, `error_screenshot_${timestamp}.png`);
                await page.screenshot({ path: errorImagePath, fullPage: true });
                console.log(`📸 Hata ekran görüntüsü kaydedildi: ${errorImagePath}`);
                const caption = `⚠️ HATA OLUŞTU ⚠️\n\nMesaj: ${error.message.substring(0, 500)}\n\nTarih: ${new Date().toLocaleString('tr-TR')}`;
                await sendTelegramPhoto(errorImagePath, caption);
            } catch (screenshotError) {
                console.error('❌ Hata ekran görüntüsü alınamadı veya gönderilemedi:', screenshotError);
            }
        }
        // Hatanın tekrar fırlatılması, periyodik tarama döngüsünün bunu yakalamasını sağlar.
        throw error;
    } finally {
        if (page) {
            console.log('Sayfa kapatılıyor...');
            await page.close();
        }
        // <<< DEĞİŞİKLİK: Tarayıcı artık burada kapatılmıyor.
    }
}

// HTTP Server (Değişiklik yok)
const server = http.createServer(async (req, res) => {
    // ... (Mevcut kodunuzda değişiklik yok)
});

// Periyodik tarama (her 5 dakikada bir)
setInterval(async () => {
    try {
        console.log('🔄 Periyodik tarama başlıyor...');
        await takeChartScreenshot();
        console.log('✓ Periyodik tarama tamamlandı.');
    } catch (error) {
        console.error('❌ Periyodik tarama başarısız oldu. Bir sonraki deneme bekleniyor.');
    }
}, 5 * 60 * 1000);

// Sunucuyu başlat
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Bot sunucusu ${PORT} portunda başlatıldı`);
    
    // <<< DEĞİŞİKLİK: Ortam değişkenleri kontrolü
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        console.warn('⚠️ UYARI: TELEGRAM_BOT_TOKEN veya TELEGRAM_CHAT_ID ortam değişkenleri ayarlanmamış. Bildirimler çalışmayacak.');
    }

    // İlk taramayı başlat
    setTimeout(async () => {
        try {
            console.log('🚀 İlk tarama başlıyor...');
            await takeChartScreenshot();
            console.log('✓ İlk tarama tamamlandı.');
        } catch (error) {
            console.error('❌ İlk tarama başarısız oldu.');
        }
    }, 5000);
});
