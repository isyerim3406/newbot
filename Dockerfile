FROM node:18-slim

# Chrome dependencies
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    procps \
    libxss1 \
    && wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create screenshots directory
RUN mkdir -p screenshots

# Set Chrome path
ENV CHROME_BIN=/usr/bin/google-chrome-stable
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Expose port
EXPOSE 10000

# Start the application
CMD ["npm", "start"]
```

## 5. `optimizeChart.js` (Eksik dosya)

```javascript
// optimizeChart.js
export default async function optimizeChart(page) {
    try {
        console.log('Grafik optimizasyonu başlıyor...');
        
        // Yan panelleri gizle
        await page.evaluate(() => {
            // Sağ panel
            const rightPanel = document.querySelector('.layout__area--right');
            if (rightPanel) rightPanel.style.display = 'none';
            
            // Sol panel
            const leftPanel = document.querySelector('.layout__area--left');
            if (leftPanel) leftPanel.style.display = 'none';
            
            // Üst toolbar
            const toolbar = document.querySelector('.js-header');
            if (toolbar) toolbar.style.display = 'none';
            
            // Alt panel
            const bottomPanel = document.querySelector('.layout__area--bottom');
            if (bottomPanel) bottomPanel.style.display = 'none';
            
            // Reklam alanları
            const ads = document.querySelectorAll('[class*="ad"], [id*="ad"]');
            ads.forEach(ad => ad.style.display = 'none');
        });
        
        console.log('✓ Grafik optimizasyonu tamamlandı');
    } catch (error) {
        console.log('⚠️ Grafik optimizasyonu sırasında hata:', error.message);
    }
}
