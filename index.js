import puppeteer from "puppeteer";
import Jimp from "jimp";
import dotenv from "dotenv";
dotenv.config();

// === Pixel kontrol koordinatları ve renkler ===
const CHECK_REGION = { x: 1773, y: 139, width: 22, height: 25 };
const BUY_COLOR = { r: 76, g: 175, b: 80 };      // Yeşil
const SELL_COLOR = { r: 255, g: 82, b: 82 };     // Kırmızı

// === Yardımcı: Renk benzerliği kontrolü ===
function colorsAreSimilar(c1, c2, tolerance = 20) {
  return (
    Math.abs(c1.r - c2.r) <= tolerance &&
    Math.abs(c1.g - c2.g) <= tolerance &&
    Math.abs(c1.b - c2.b) <= tolerance
  );
}

// === OptimizeChart: gereksiz öğeleri gizle ===
async function optimizeChart(page) {
  await page.evaluate(() => {
    document.querySelectorAll(".price-axis").forEach(el => (el.style.display = "none"));
    document.querySelectorAll(".time-axis").forEach(el => (el.style.display = "none"));
    document.querySelectorAll(".chart-markup-table").forEach(el => (el.style.display = "none"));
    document.querySelectorAll("canvas").forEach(el => {
      if (
        el.parentElement?.className?.includes("price-axis") ||
        el.parentElement?.className?.includes("time-axis") ||
        el.parentElement?.className?.includes("chart-container")
      ) {
        el.style.display = "none";
      }
    });
    document.querySelectorAll(".drawing-toolbar, .layout__area--left")
      .forEach(el => (el.style.display = "none"));
    document.querySelectorAll(".chart-controls-bar, .header-toolbar")
      .forEach(el => (el.style.display = "none"));
  });
}

// === Pixel analizi ===
async function checkSignal(page) {
  const screenshot = await page.screenshot();
  const image = await Jimp.read(screenshot);

  let buyCount = 0;
  let sellCount = 0;

  for (let dx = 0; dx < CHECK_REGION.width; dx++) {
    for (let dy = 0; dy < CHECK_REGION.height; dy++) {
      const px = CHECK_REGION.x + dx;
      const py = CHECK_REGION.y + dy;
      const pixelColor = Jimp.intToRGBA(image.getPixelColor(px, py));

      if (colorsAreSimilar(pixelColor, BUY_COLOR)) buyCount++;
      if (colorsAreSimilar(pixelColor, SELL_COLOR)) sellCount++;
    }
  }

  if (buyCount > sellCount && buyCount > 10) {
    console.log("📗 BUY sinyali tespit edildi!");
    return "BUY";
  } else if (sellCount > buyCount && sellCount > 10) {
    console.log("📕 SELL sinyali tespit edildi!");
    return "SELL";
  }

  console.log("⏳ Sinyal yok...");
  return null;
}

// === Ana Bot ===
(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: { width: 1920, height: 1080 },
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/google-chrome-stable",
    args: ["--no-sandbox", "--disable-setuid-sandbox"] // <-- Docker root için eklendi
  });

  const page = await browser.newPage();

  console.log("📂 TradingView açılıyor...");
  await page.goto("https://www.tradingview.com/chart/", { waitUntil: "networkidle2" });

  console.log("⚡ Grafik optimize ediliyor...");
  await optimizeChart(page);

  console.log("👀 Pixel analizi başlıyor...");
  setInterval(async () => {
    try {
      await checkSignal(page);
    } catch (err) {
      console.error("Pixel analizi hatası:", err.message);
    }
  }, 5000); // her 5 saniyede bir kontrol
})();
