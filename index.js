// Runtime'da browser kurulum fonksiyonu
async function ensureBrowserInstalled() {
    console.log('🔍 Browser kurulum durumu kontrol ediliyor...');
    
    try {
        // Önce browser var mı test et
        const testBrowser = await chromium.launch({ 
            headless: true,
            args: ['--no-sandbox'] 
        });
        await testBrowser.close();
        console.log('✅ Browser zaten kurulu');
        return true;
    } catch (error) {
        console.log('❌ Browser bulunamadı, kurulum yapılıyor...');
        
        try {
            // Runtime'da browser kurulumu
            const { execSync } = await import('child_process');
            
            console.log('📦 Playwright Chromium kuruluyor...');
            execSync('npx playwright install chromium', { 
                stdio: 'inherit',
                timeout: 120000 // 2 dakika timeout
            });
            
            console.log('🔧 System dependencies kuruluyor...');
            execSync('npx playwright install-deps chromium', { 
                stdio: 'inherit',
                timeout: 120000
            });
            
            console.log('✅ Browser kurulumu tamamlandı');
            return true;
            
        } catch (installError) {
            console.error('❌ Browser kurulum hatası:', installError.message);
            return false;
        }
    }
}

// Güncellenmiş getBrowserInstance fonksiyonu
async function getBrowserInstance() {
    if (browserInstance && pageInstance) {
        try {
            await pageInstance.evaluate(() => document.title);
            return { browser: browserInstance, page: pageInstance };
        } catch (error) {
            console.log('🔄 Browser yeniden başlatılıyor...');
            browserInstance = null;
            pageInstance = null;
        }
    }

    // Browser kurulumunu garantile
    const browserReady = await ensureBrowserInstalled();
    if (!browserReady) {
        throw new Error('Browser kurulumu başarısız!');
    }

    // Browser launch options
    const launchOptions = {
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
        ]
    };

    try {
        console.log('🚀 Browser başlatılıyor...');
        browserInstance = await chromium.launch(launchOptions);
        console.log('✅ Browser başlatıldı');
    } catch (error) {
        console.error('❌ Browser başlatma hatası:', error.message);
        throw new Error('Browser başlatılamadı: ' + error.message);
    }

    pageInstance = await browserInstance.newPage();
    
    // User agent ayarla
    await pageInstance.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await pageInstance.setViewportSize({ width: 1920, height: 1080 });

    console.log('✅ Browser ve page hazır');
    return { browser: browserInstance, page: pageInstance };
}

// Ana başlatma fonksiyonunu güncelle
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
    
    // Browser kurulumunu başlangıçta yap
    console.log('🔧 Browser hazırlık işlemleri...');
    try {
        await ensureBrowserInstalled();
    } catch (error) {
        console.error('❌ Browser hazırlık hatası:', error.message);
    }
    
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
