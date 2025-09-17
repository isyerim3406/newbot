import puppeteer from 'puppeteer';
import Jimp from 'jimp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import axios from 'axios';
import FormData from 'form-data';
import express from 'express';

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

// Browser instance
let browserInstance = null;

async function getBrowserInstance() {
    if (browserInstance) {
        return browserInstance;
    }

    console.log('🚀 Browser başlatılıyor...');
    
    browserInstance = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--window-size=1920,1080',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--disable-extensions',
            '--disable-plugins',
            '--single-process',
            '--no-zygote'
        ],
        executablePath: process.env.CHROME_BIN || process.env.PUPPETEER_EXECUTABLE_PATH || null
    });
    
    console.log('✅ Browser başlatıldı');
    return browserInstance;
}

// Telegram'a fotoğraf gönderme (3 defa, 10 saniye arayla)
async function sendTelegramPhotos(filePath, caption) {
    const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramChatId = process.env.TELEGRAM_CHAT_ID;

    if (!telegramBotToken || !telegramChatId) {
        console.warn('⚠️ UYARI: Telegram bilgileri eksik');
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
                headers: formData.getHeaders(),
                timeout: 30000
            });
            
            console.log(`✓ Telegram fotoğraf ${i}/3 gönderildi`);
            
            if (i < 3) {
                await new Promise(resolve => setTimeout(resolve, 10000)); // 10 saniye bekle
            }
        } catch (error) {
            console.error(`❌ Telegram fotoğraf ${i}/3 hatası:`, error.message);
        }
    }
}

// Telegram mesaj gönderme
async function sendTelegramMessage(message) {
    const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramChatId = process.env.TELEGRAM_CHAT_ID;

    if (!telegramBotToken || !telegramChatId) return;

    try {
        await axios.post(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
            chat_id: telegramChatId,
            text: message,
            parse_mode: 'HTML'
        }, {
            timeout: 30000
        });
        console.log('✓ Telegram mesajı gönderildi');
    } catch (error) {
        console.error('❌ Telegram mesajı hatası:', error.message);
    }
}

// TradingView login kontrolü
async function checkLoginStatus(page) {
    try {
        const loginSelectors = [
            '.tv-header__user-menu-button',
            '[data-name="header-user-menu-button"]',
            '.js-username',
            '.tv-dropdown-behavior__button--user'
        ];

        for (const selector of loginSelectors) {
            try {
                const element = await page.$(selector);
                if (element) {
                    const isVisible = await element.boundingBox();
                    if (isVisible) {
                        console.log(`✅ Login element bulundu: ${selector}`);
                        return true;
                    }
                }
            } catch (e) {
                continue;
            }
        }

        const currentUrl = page.url();
        if (currentUrl.includes('/accounts/signin') || currentUrl.includes('/accounts/signup')) {
            console.log('❌ Login sayfasında');
            return false;
        }

        console.log('❌ Login elementleri bulunamadı');
        return false;
        
    } catch (error) {
        console.error('Login kontrolü hatası:', error.message);
        return false;
    }
}

// Login işlemi
async function attemptLogin(page) {
    console.log('🔐 Login işlemi başlıyor...');
    
    try {
        // Method 1: Email/Password
        const email = process.env.TRADINGVIEW_EMAIL;
        const password = process.env.TRADINGVIEW_PASSWORD;
        
        if (email && password) {
            console.log('📧 Email/Password ile giriş deneniyor...');
            
            await page.goto('https://www.tradingview.com/accounts/signin/', {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            try {
                await page.waitForSelector('input[name="username"]', { timeout: 15000 });
                await page.type('input[name="username"]', email);
                await page.type('input[name="password"]', password);
                
                await page.click('button[type="submit"]');
                await page.waitForTimeout(5000);
                
                const isLoggedIn = await checkLoginStatus(page);
                if (isLoggedIn) {
                    console.log('✅ Email/Password ile giriş başarılı!');
                    return true;
                }
            } catch (error) {
                console.log('❌ Email/Password giriş başarısız:', error.message);
            }
        }

        // Method 2: Cookies
        const cookiesBase64 = process.env.COOKIES_BASE64;
        if (cookiesBase64) {
            console.log('🍪 Cookies ile giriş deneniyor...');
            
            try {
                await page.goto('https://www.tradingview.com/', {
                    waitUntil: 'networkidle2',
                    timeout: 30000
                });

                const cookiesString = Buffer.from(cookiesBase64, 'base64').toString('utf-8');
                const cookies = JSON.parse(cookiesString);
                
                await page.setCookie(...cookies);
                console.log(`✓ ${cookies.length} cookie yüklendi`);
                
                await page.reload({ waitUntil: 'networkidle2' });
                
                const isLoggedIn = await checkLoginStatus(page);
                if (isLoggedIn) {
                    console.log('✅ Cookies ile giriş başarılı!');
                    return true;
                }
            } catch (error) {
                console.log('❌ Cookies giriş başarısız:', error.message);
            }
        }

        console.log('❌ Login başarısız - cookie olmadan devam ediliyor');
        return false;

    } catch (error) {
        console.error('❌ Login genel hatası:', error.message);
        return false;
    }
}

// Ana screenshot fonksiyonu
async function takeChartScreenshot() {
    lastResult.status = 'çalışıyor';
    lastResult.timestamp = new Date().toISOString();

    const timestamp = Date.now();
    const screenshotPath = path.join(screenshotsDir, `screenshot_${timestamp}.png`);

    let page;
    
    try {
        const browser = await getBrowserInstance();
        page = await browser.newPage();

        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Request interception (optional - hızlandırma için)
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const resourceType = req.resourceType();
            if (['image', 'stylesheet', 'font'].includes(resourceType)) {
                req.abort();
            } else {
                req.continue();
            }
        });

        // Login kontrolü
        console.log('🔍 Login kontrolü yapılıyor...');
        let loginStatus = false;
        
        try {
            loginStatus = await attemptLogin(page);
            lastResult.loginStatus = loginStatus;
        } catch (loginError) {
            console.log('❌ Login hatası:', loginError.message);
        }

        // Chart sayfasına git
        const chartUrl = 'https://www.tradingview.com/chart/?symbol=BINANCE:ETHUSDT.P&interval=1';
        console.log(`📊 Chart sayfasına gidiyor: ${chartUrl}`);
        
        await page.goto(chartUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 60000 
        });

        // Pop-up kapat
        try {
            await page.waitForSelector('button[data-name="accept-recommended-settings"]', { timeout: 5000 });
            await page.click('button[data-name="accept-recommended-settings"]');
            console.log('✓ Pop-up kapatıldı');
        } catch (e) {
            console.log('ℹ️ Pop-up bulunamadı');
        }

        // Chart bekle
        console.log('📈 Chart elementi bekleniyor...');
        await page.waitForSelector('.chart-gui-wrapper', { timeout: 30000 });
        
        // İndikatörler için bekle
        console.log('⏱️ İndikatörlerin çizilmesi için 5 saniye bekleniyor...');
        await page.waitForTimeout(5000);

        // TAM EKRAN screenshot
        console.log('📸 Tam ekran screenshot alınıyor...');
        await page.screenshot({ 
            path: screenshotPath,
            fullPage: true
        });
        
        console.log(`✅ Screenshot kaydedildi: ${screenshotPath}`);

        // Screenshot gönder (3 defa)
        await sendTelegramPhotos(screenshotPath, `📊 TradingView Screenshot\n🕐 ${new Date().toLocaleString('tr-TR')}`);

        // Piksel analizi
        console.log('🔍 Sinyal analizi yapılıyor...');
        const image = await Jimp.read(screenshotPath);
        
        const signalCoords = { x: 100, y: 100 };
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

        // Sinyal mesajı
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
        console.error('❌ Tarama hatası:', error.message);
        
        lastResult = {
            timestamp: new Date().toISOString(),
            status: 'hata',
            signal: 'yok',
            error: error.message,
            pixelColor: null,
            loginStatus: false
        };

        // Hata mesajı gönder
        const errorMessage = `❌ <b>HATA OLUŞTU</b>\n\n🚨 ${error.message.substring(0, 200)}\n🕐 ${new Date().toLocaleString('tr-TR')}`;
        await sendTelegramMessage(errorMessage);

        throw error;
    } finally {
        if (page) {
            await page.close();
        }
    }
}

// Health check server
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
    console.log(`🌐 Health server çalışıyor: port ${PORT}`);
});

// Bot başlatma
const startBot = async () => {
    console.log('🚀 TradingView Bot başlatılıyor...');
    
    const requiredVars = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
        console.error(`❌ Eksik environment: ${missingVars.join(', ')}`);
        return;
    }

    console.log('✅ Environment değişkenleri OK');
    
    try {
        await takeChartScreenshot();
    } catch (e) {
        console.log(`❌ İlk tarama başarısız: ${e.message}`);
    }

    setInterval(async () => {
        try {
            console.log('\n🔄 Periyodik tarama...');
            await takeChartScreenshot();
        } catch (e) {
            console.log(`❌ Periyodik tarama başarısız: ${e.message}`);
        }
    }, 10 * 60 * 1000);

    console.log('✅ Bot başlatıldı - 10 dakikada bir tarama');
};

// Graceful shutdown
process.on('SIGTERM', async () => {
    if (browserInstance) await browserInstance.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    if (browserInstance) await browserInstance.close();
    process.exit(0);
});

startBot();
