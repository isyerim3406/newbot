require('dotenv').config();
const { Builder, By, Key, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const fetch = require('node-fetch');

(async function main() {
    let options = new chrome.Options();
    options.addArguments(
        '--headless',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1920,1080'
    );

    let driver;
    try {
        driver = await new Builder()
            .forBrowser('chrome')
            .setChromeOptions(options)
            .build();

        console.log('==> Chrome başlatıldı');

        // --- TradingView login ---
        await driver.get('https://www.tradingview.com/#signin');
        await driver.wait(until.elementLocated(By.name('username')), 10000);
        await driver.findElement(By.name('username')).sendKeys(process.env.TV_EMAIL);
        await driver.findElement(By.name('password')).sendKeys(process.env.TV_PASSWORD, Key.RETURN);
        console.log('==> TradingView login yapıldı');

        // --- Sinyal kontrolü (örnek) ---
        // Buraya TradingView grafiği açıp sinyal çekme kodu gelecek
        await driver.sleep(5000); // sayfanın yüklenmesini bekle

        const signal = "AL"; // örnek sinyal, burada TradingView’den alınacak
        console.log('==> Sinyal:', signal);

        // --- Telegram bildirimi ---
        const telegramUrl = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
        const response = await fetch(telegramUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: process.env.TELEGRAM_CHAT_ID,
                text: `Yeni TradingView sinyali: ${signal}`
            })
        });

        const data = await response.json();
        console.log('==> Telegram yanıtı:', data);

    } catch (err) {
        console.error('==> Hata yakalandı:', err);
    } finally {
        if (driver) {
            await driver.quit();
            console.log('==> Chrome kapatıldı');
        }
    }
})();
