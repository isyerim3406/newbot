import { chromium } from 'playwright';
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
    pixelColor: null,
    loginStatus: false
};

// Browser instance için
let browserInstance = null;
let pageInstance = null;

async function getBrowserInstance() {
    if (browserInstance && pageInstance) {
        try {
            // Test et browser hala çalışıyor mu
            await pageInstance.evaluate(() => document.title);
            return { browser: browserInstance, page: pageInstance };
        } catch (error) {
            console.log('🔄 Browser yeniden başlatılıyor...');
            browserInstance = null;
            pageInstance = null;
        }
    }

    browserInstance = await chromium.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--window-size=1920,1080',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor'
        ]
    });

    pageInstance = await browserInstance.newPage();
    
    // User agent ayarla
    await pageInstance.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await pageInstance.setViewportSize({ width: 1920, height: 1080 });

    return { browser: browserInstance, page: pageInstance };
}

// Telegram'a fotoğraf gönderme (3 defa, 10 saniye arayla)
async function sendTelegramPhotos(filePath, caption) {
    const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramChatId = process.env.TELEGRAM_CHAT_ID;

    if (!telegramBotToken || !telegramChatId) {
        console.warn('⚠️ UYARI: TELEGRAM_BOT_TOKEN veya TELEGRAM_CHAT_ID ortam değişkenleri ayarlanmamış.');
        return;
    }

    // 3 defa gönder, 10 saniye arayla
    for (let i = 1; i <= 3; i++) {
        try {
            const formData = new FormData();
            formData.append('chat_id', telegramChatId);
            formData.append('caption', `${caption} (${i}/3)`);
            formData.append('photo', fs.createReadStream(filePath));

            await axios.post(`https://api.telegram.org/bot${telegramBotToken}/sendPhoto`, formData, {
                headers: formData.getHeaders()
            });
            
            console.log(`✓ Telegram fotoğraf ${i}/3 gönderildi`);
            
            // Son fotoğraf değilse 10 saniye bekle
            if (i < 3) {
                await new Promise(resolve => setTimeout(resolve, 10000));
            }
        } catch (error) {
            console.error(`❌ Telegram fotoğraf ${i}/3 gönderilirken hata:`, error.message);
        }
    }
}

// Telegram'a sinyal mesajı gönderme
async function sendTelegramMessage(message) {
    const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramChatId = process.env.TELEGRAM_CHAT_ID;

    if (!telegramBotToken || !telegramChatId) {
        return;
    }

    try {
        await axios.post(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
            chat_id: telegramChatId,
            text: message,
            parse_mode: 'HTML'
        });
        console.log('✓ Telegram mesajı gönderildi');
    } catch (error) {
        console.error('❌ Telegram mesajı gönderilirken hata:', error.message);
    }
}

// TradingView login işlemi
async function loginToTradingView(page) {
    console.log('🔐 TradingView login işlemi başlıyor...');
    
    try {
        // Method 1: Environment credentials ile login
        const email = process.env.TRADINGVIEW_EMAIL;
        const password = process.env.TRADINGVIEW_PASSWORD;
        
        if (email && password) {
            console.log('📧 Email/Password ile giriş deneniyor...');
            
            await page.goto('https://www.tradingview.com/accounts/signin/', {
                waitUntil: 'networkidle',
                timeout: 30000
            });

            try {
                await page.waitForSelector('input[name="username"]', { timeout: 15000 });
                await page.fill('input[name="username"]', email);
                await page.fill('input[name="password"]', password);
                
                const loginButton = await page.waitForSelector('button[type="submit"]', { timeout: 10000 });
                await loginButton.click();
                
                await page.waitForTimeout(5000);
                
                const isLoggedIn = await checkLoginStatus(page);
                if (isLoggedIn) {
                    console.log('✅ Email/Password ile giriş başarılı!');
                    await saveCookiesForFuture(page);
                    return true;
                }
            } catch (error) {
                console.log('❌ Email/Password giriş başarısız:', error.message);
            }
        }

        // Method 2: Base64 Cookies ile login
        const cookiesBase64 = process.env.COOKIES_BASE64;
        if (cookiesBase64) {
            console.log('🍪 Base64 cookies ile giriş deneniyor...');
            
            try {
                await page.goto('https://www.tradingview.com/', {
                    waitUntil: 'domcontentloaded',
                    timeout: 30000
                });

                const cookiesString = Buffer.from(cookiesBase64, 'base64').toString('utf-8');
                const cookies = JSON.parse(cookiesString);
                
                // Cookies format dönüşümü (Puppeteer → Playwright)
                const playwrightCookies = cookies.map(cookie => ({
                    name: cookie.name,
                    value: cookie.value,
                    domain: cookie.domain,
                    path: cookie.path || '/',
                    httpOnly: cookie.httpOnly || false,
                    secure: cookie.secure || false,
                    sameSite: cookie.sameSite || 'Lax'
                }));
                
                await page.context().addCookies(playwrightCookies);
                console.log(`✓ ${playwrightCookies.length} cookie yüklendi`);
                
                await page.reload({ waitUntil: 'networkidle' });
                
                const isLoggedIn = await checkLoginStatus(page);
                if (isLoggedIn) {
                    console.log('✅ Cookies ile giriş başarılı!');
                    return true;
                }
                
            } catch (error) {
                console.log('❌ Base64 cookies giriş başarısız:', error.message);
            }
        }

        // Method 3: JSON Cookies ile login
        const cookiesJson = process.env.TRADINGVIEW_COOKIES_JSON;
        if (cookiesJson) {
            console.log('📝 JSON cookies ile giriş deneniyor...');
            
            try {
                await page.goto('https://www.tradingview.com/', {
                    waitUntil: 'domcontentloaded',
                    timeout: 30000
                });

                const cookies = JSON.parse(cookiesJson);
                await page.context().addCookies(cookies);
                
                await page.reload({ waitUntil: 'networkidle' });
                
                const isLoggedIn = await checkLoginStatus(page);
                if (isLoggedIn) {
                    console.log('✅ JSON cookies ile giriş başarılı!');
                    return true;
                }
                
            } catch (error) {
                console.log('❌ JSON cookies giriş başarısız:', error.message);
            }
        }

        console.log('❌ Tüm login yöntemleri başarısız - cookie olmadan devam ediliyor');
        return false;

    } catch (error) {
        console.error('❌ Login işlemi genel hatası:', error.message);
        return false;
    }
}

// Login durumu kontrolü
async function checkLoginStatus(page) {
    try {
        const loginSelectors = [
            '.tv-header__user-menu-button',
            '[data-name="header-user-menu-button"]',
            '.js-username',
            '.tv-dropdown-behavior__button--user',
            '[data-tooltip="User menu"]'
        ];

        for (const selector of loginSelectors) {
            try {
                const element = await page.$(selector);
                if (element && await element.isVisible()) {
                    console.log(`✅ Login element bulundu: ${selector}`);
                    return true;
                }
            } catch (e) {
                continue;
            }
        }

        // URL kontrolü
        const currentUrl = page.url();
        if (currentUrl.includes('/accounts/signin') || currentUrl.includes('/accounts/signup')) {
            return false;
        }

        return false;
    } catch (error) {
        return false;
    }
}

// Gelecek kullanım için cookies kaydet
async function saveCookiesForFuture(page) {
    try {
        const cookies = await page.context().cookies();
        const cookiesJson = JSON.stringify(cookies);
        const cookiesBase64 = Buffer.from(cookiesJson).toString('base64');
        
        console.log('💾 Yeni cookies environment değişkenleri:');
        console.log('COOKIES_BASE64:', cookiesBase64.substring(0, 100) + '...');
    } catch (error) {
        console.error('❌ Cookies kaydetme hatası:', error);
    }
}

// Ana screenshot ve analiz fonksiyonu
async function takeChartScreenshot() {
    lastResult.status = 'çalışıyor';
    lastResult.timestamp = new Date().toISOString();

    const timestamp = Date.now();
    const screenshotPath = path.join(screenshotsDir, `screenshot_${timestamp}.png`);

    try {
        const { browser, page } = await getBrowserInstance();
        
        // Login kontrolü ve işlemi
        console.log('🔍 Login durumu kontrol ediliyor...');
        let loginStatus = await checkLoginStatus(page);
        
        if (!loginStatus) {
            console.log('🔐 Login gerekli, giriş yapılıyor...');
            loginStatus = await loginToTradingView(page);
        } else {
            console.log('✅ Zaten giriş yapılmış');
        }
        
        lastResult.loginStatus = loginStatus;

        // Chart sayfasına git
        const chartUrl = 'https://www.tradingview.com/chart/?symbol=BINANCE:ETHUSDT.P&interval=1';
        console.log(`📊 Chart sayfasına gidiliyor: ${chartUrl}`);
        
        await page.goto(chartUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 60000 
        });

        // Pop-up kapatma
        try {
            await page.waitForSelector('button[data-name="accept-recommended-settings"]', { timeout: 5000 });
            await page.click('button[data-name="accept-recommended-settings"]');
            console.log('✓ Cookie pop-up kapatıldı');
        } catch (e) {
            console.log('ℹ️ Cookie pop-up bulunamadı');
        }

        // Chart elementini bekle
        console.log('📈 Chart elementi bekleniyor...');
        await page.waitForSelector('.chart-gui-wrapper', { timeout: 30000 });
        
        // İndikatörlerin yüklenmesi için 5 saniye bekle
        console.log('⏱️ İndikatörlerin çizilmesi için 5 saniye bekleniyor...');
        await page.waitForTimeout(5000);

        // TAM EKRAN Screenshot al
        console.log('📸 Tam ekran screenshot alınıyor...');
        await page.screenshot({ 
            path: screenshotPath,
            fullPage: true
        });
        
        console.log(`✅ Screenshot kaydedildi: ${screenshotPath}`);

        // Önce screenshot'ları gönder (3 defa, 10 saniye arayla)
        await sendTelegramPhotos(screenshotPath, `📊 TradingView Screenshot\n🕐 ${new Date().toLocaleString('tr-TR')}`);

        // Piksel analizi (koordinat bazlı sinyal tespiti)
        console.log('🔍 Sinyal analizi yapılıyor...');
        const image = await Jimp.read(screenshotPath);
        
        // Örnek koordinatlar - bot kurulumunuza göre ayarlayın
        const signalCoords = { x: 100, y: 100 }; // Bu koordinatları ayarlayın
        const pixelColor = image.getPixelColor(signalCoords.x, signalCoords.y);
        const { r, g, b } = Jimp.intToRGBA(pixelColor);
        
        console.log(`🎨 Piksel Rengi (${signalCoords.x}, ${signalCoords.y}): R:${r}, G:${g}, B:${b}`);

        // Sinyal belirleme
        let signal = 'sinyal yok';
        let signalEmoji = '⚪';
        
        if (r > 200 && g < 100 && b < 100) {
            signal = 'kırmızı';
            signalEmoji = '🔴';
        } else if (g > 200 && r < 100 && b < 100) {
            signal = 'yeşil';
            signalEmoji = '🟢';
        }

        // Sinyal mesajı gönder
        const signalMessage = `
${signalEmoji} <b>SİNYAL TESPİTİ</b> ${signalEmoji}

📊 <b>Sembol:</b> BINANCE:ETHUSDT.P
🎯 <b>Sinyal:</b> ${signal.toUpperCase()}
🎨 <b>Renk:</b> R:${r}, G:${g}, B:${b}
📍 <b>Koordinat:</b> ${signalCoords.x}, ${signalCoords.y}
🕐 <b>Tarih:</b> ${new Date().toLocaleString('tr-TR')}
🔐 <b>Login:</b> ${loginStatus ? 'Başarılı' : 'Başarısız'}
        `;

        await sendTelegramMessage(signalMessage);

        lastResult = {
            timestamp: new Date().toISOString(),
            status: 'başarılı',
            signal: signal,
            error: null,
            pixelColor: { r, g, b },
            loginStatus: loginStatus
        };

        console.log(`✅ Tarama tamamlandı: ${signal}`);

    } catch (error) {
        console.error('❌ Tarama sırasında hata:', error.message);
        
        lastResult = {
            timestamp: new Date().toISOString(),
            status: 'hata',
            signal: 'yok',
            error: error.message,
            pixelColor: null,
            loginStatus: false
        };

        // Hata durumunda screenshot al ve gönder
        try {
            const { page } = await getBrowserInstance();
            const errorScreenshot = path.join(screenshotsDir, `error_${timestamp}.png`);
            await page.screenshot({ path: errorScreenshot, fullPage: true });
            
            const errorMessage = `
❌ <b>HATA OLUŞTU</b> ❌

🚨 <b>Hata:</b> ${error.message.substring(0, 200)}
🕐 <b>Tarih:</b> ${new Date().toLocaleString('tr-TR')}
            `;
            
            await sendTelegramMessage(errorMessage);
            
        } catch (screenshotError) {
            console.error('❌ Hata screenshot alınamadı:', screenshotError.message);
        }

        throw error;
    }
}

// Health check endpoint (Render için)
import express from 'express';
const app = express();

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        message: 'TradingView Bot is running',
        timestamp: new Date().toISOString(),
        lastResult: lastResult
    });
});

app.get('/status', (req, res) => {
    res.json(lastResult);
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`🌐 Health server çalışıyor: http://localhost:${PORT}`);
    console.log(`📊 Status: http://localhost:${PORT}/status`);
});

// Ana fonksiyon
const startBot = async () => {
    console.log('🚀 TradingView Bot başlatılıyor...');
    console.log('💾 Environment değişkenleri kontrol ediliyor...');
    
    const requiredVars = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
        console.error(`❌ Eksik environment değişkenleri: ${missingVars.join(', ')}`);
        return;
    }

    console.log('✅ Environment değişkenleri OK');
    
    try {
        // İlk tarama
        console.log('🎯 İlk tarama başlıyor...');
        await takeChartScreenshot();
    } catch (e) {
        console.log(`❌ İlk tarama başarısız: ${e.message}`);
    }

    // Periyodik tarama (10 dakika)
    setInterval(async () => {
        try {
            console.log('\n🔄 Periyodik tarama başlıyor...');
            await takeChartScreenshot();
        } catch (e) {
            console.log(`❌ Periyodik tarama başarısız: ${e.message}`);
        }
    }, 10 * 60 * 1000); // 10 dakika

    console.log('✅ Bot başarıyla başlatıldı - 10 dakikada bir tarama yapılacak');
};

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🛑 Bot kapatılıyor...');
    if (browserInstance) {
        await browserInstance.close();
    }
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('🛑 Bot durduruldu...');
    if (browserInstance) {
        await browserInstance.close();
    }
    process.exit(0);
});

// Bot'u başlat
startBot();
