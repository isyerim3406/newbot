import puppeteer from 'puppeteer';
import Jimp from 'jimp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import axios from 'axios';
import FormData from 'form-data';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const screenshotsDir = path.join(__dirname, 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir);
}

let lastResult = {
    timestamp: new Date().toISOString(),
    status: 'bekliyor',
    signal: 'yok',
    error: null,
    pixelColor: null
};

// Tarayıcı örneğini yeniden kullanmak için
let browserInstance = null;
async function getBrowserInstance() {
    if (browserInstance) {
        return browserInstance;
    }
    browserInstance = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--window-size=1920,1080',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
            '--blink-settings=imagesEnabled=false' // Gerekirse resim yüklemesini kapatabiliriz
        ],
        executablePath: process.env.CHROME_BIN || null
    });
    return browserInstance;
}

// Telegram'a fotoğraf gönderme fonksiyonu
async function sendTelegramPhoto(filePath, caption) {
    const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramChatId = process.env.TELEGRAM_CHAT_ID;

    if (!telegramBotToken || !telegramChatId) {
        console.warn('⚠️ UYARI: TELEGRAM_BOT_TOKEN veya TELEGRAM_CHAT_ID ortam değişkenleri ayarlanmamış. Bildirimler çalışmayacak.');
        return;
    }

    try {
        const formData = new FormData();
        formData.append('chat_id', telegramChatId);
        formData.append('caption', caption);
        formData.append('photo', fs.createReadStream(filePath));

        await axios.post(`https://api.telegram.org/bot${telegramBotToken}/sendPhoto`, formData, {
            headers: formData.getHeaders()
        });
        console.log('✓ Telegram bildirimi gönderildi.');
    } catch (error) {
        console.error('❌ Telegram bildirimi gönderilirken hata oluştu:', error.message);
    }
}

// Grafik arayüzünü optimize eden fonksiyon
async function optimizeChart(page) {
    try {
        // Sol menü panelini daralt
        await page.evaluate(() => {
            const panel = document.querySelector('.chart-controls');
            if (panel) panel.style.display = 'none';
        });

        // Sağ menü panelini kapat
        await page.evaluate(() => {
            const panel = document.querySelector('.right-toolbar');
            if (panel) panel.style.display = 'none';
        });
        
    } catch (e) {
        console.error('Grafik arayüzü optimizasyonu sırasında hata:', e.message);
    }
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

        // <<< DEĞİŞİKLİK: Oturum açmak için Base64 kodlu çerezleri ortam değişkeninden yükle
        const cookiesBase64 = process.env.COOKIES_BASE64;
        if (cookiesBase64) {
            console.log('🍪 Ortam değişkeninden Base64 çerezleri okunuyor...');
            try {
                const cookiesString = Buffer.from(cookiesBase64, 'base64').toString('utf-8');
                const cookies = JSON.parse(cookiesString);
                await page.setCookie(...cookies);
                console.log('✓ Çerezler tarayıcıya başarıyla yüklendi.');
            } catch (e) {
                console.error('❌ HATA: Base64 çerezleri çözümlenemedi veya geçersiz:', e.message);
            }
        } else {
            console.warn('⚠️ UYARI: COOKIES_BASE64 ortam değişkeni bulunamadı. Giriş yapılmamış bir oturumla devam edilecek.');
        }

        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const resourceType = req.resourceType();
            const url = req.url();
            if (['document', 'script', 'xhr', 'fetch'].includes(resourceType)) {
                if (url.includes('google') || url.includes('facebook') || url.includes('bing')) {
                    req.abort();
                } else {
                    req.continue();
                }
            } else {
                req.abort();
            }
        });
        
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        const chartUrl = 'https://www.tradingview.com/chart/?symbol=BINANCE:ETHUSDT.P&interval=1';
        console.log(`Grafik sayfasına gidiliyor: ${chartUrl}`);
        
        await page.goto(chartUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 240000 
        });
        console.log('✓ Sayfa DOM yüklendi.');

        console.log('Pop-up ve çerez bildirimleri kontrol ediliyor...');
        try {
            const acceptButtonSelector = 'button[data-name="accept-recommended-settings"]';
            await page.waitForSelector(acceptButtonSelector, { timeout: 5000, visible: true }); 
            await page.click(acceptButtonSelector);
            console.log('✓ Çerez bildirimi kapatıldı.');
        } catch (e) {
            console.log('ℹ️ Çerez bildirimi bulunamadı veya zaten kapalı.');
        }

        console.log('Grafik elementi bekleniyor...');
        const chartWrapperSelector = '.chart-gui-wrapper';
        await page.waitForSelector(chartWrapperSelector, { timeout: 60000 });
        const chartElement = await page.$(chartWrapperSelector);
        console.log('✓ Grafik elementi bulundu.');
        
        console.log('Grafik arayüzü optimize ediliyor...');
        await optimizeChart(page);
        console.log('✓ Optimizasyon tamamlandı.');
        
        console.log('Grafiğin çizilmesi (render) bekleniyor...');
        await page.waitForFunction(
            (selector) => {
                const elem = document.querySelector(selector);
                return elem && elem.getBoundingClientRect().width > 50 && elem.querySelector('canvas');
            },
            { timeout: 60000 },
            chartWrapperSelector
        );
        console.log('✓ Grafik başarıyla render edildi.');
        
        console.log('Özel indikatörlerin yüklenmesi için 5 saniye bekleniyor...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        await chartElement.screenshot({ path: debugImagePath });
        console.log(`✓ Ekran görüntüsü kaydedildi: ${debugImagePath}`);

        // Bu kısım piksel analizi ve sinyal gönderme işlemlerini içerir.
        // Orijinal kodunuzda olduğu gibi kalmıştır.
        const image = await Jimp.read(debugImagePath);
        const pixelColor = image.getPixelColor(100, 100);
        const { r, g, b } = Jimp.intToRGBA(pixelColor);
        console.log(`Piksel Rengi: R:${r}, G:${g}, B:${b}`);

        let signal = 'yok';
        if (r > 200 && g < 50 && b < 50) {
            signal = 'al';
        } else if (g > 200 && r < 50 && b < 50) {
            signal = 'sat';
        }

        lastResult = {
            timestamp: new Date().toISOString(),
            status: 'başarılı',
            signal: signal,
            error: null,
            pixelColor: { r, g, b }
        };

        const signalMessage = `TradingView Sinyali: ${signal.toUpperCase()}`;
        if (signal !== 'yok') {
            await sendTelegramPhoto(debugImagePath, signalMessage);
        }

        console.log(`Güncel sonuç: ${JSON.stringify(lastResult, null, 2)}`);

    } catch (error) {
        console.error('❌ Tarama sırasında bir hata oluştu:', error.message);
        lastResult = {
            timestamp: new Date().toISOString(),
            status: 'hata',
            signal: 'yok',
            error: error.message,
            pixelColor: null
        };
        
        if (page) {
            try {
                const errorImagePath = path.join(screenshotsDir, `error_screenshot_${timestamp}.png`);
                await page.screenshot({ path: errorImagePath, fullPage: true });
                console.log(`📸 Hata ekran görüntüsü kaydedildi: ${errorImagePath}`);
                const caption = `⚠️ HATA OLUŞTU ⚠️\n\nMesaj: ${error.message.substring(0, 500)}\n\nTarih: ${new Date().toLocaleString('tr-TR')}`;
                await sendTelegramPhoto(errorImagePath, caption);
            } catch (screenshotError) {
                console.error('❌ Hata ekran görüntüsü alınamadı veya gönderilemedi:', screenshotError.message);
            }
        }
        throw error;
    } finally {
        if (page) {
            console.log('Sayfa kapatılıyor...');
            await page.close();
        }
    }
}


const checkAndRun = async () => {
    try {
        await takeChartScreenshot();
    } catch (e) {
        console.log(`❌ İlk tarama başarısız oldu.\n\n${e.message}\n`);
    }

    setInterval(async () => {
        try {
            console.log('\n🔄 Periyodik tarama başlıyor...');
            await takeChartScreenshot();
        } catch (e) {
            console.log(`❌ Periyodik tarama başarısız oldu.\n\n${e.message}\n`);
        }
    }, 10 * 60 * 1000); // 10 dakika
};

checkAndRun();
