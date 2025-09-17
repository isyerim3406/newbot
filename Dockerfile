# TradingView Bot için Render Dockerfile
FROM node:18-slim

# Sistem bağımlılıklarını yükle (Playwright için gerekli)
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    procps \
    libxss1 \
    libgconf-2-4 \
    libxtst6 \
    libxrandr2 \
    libasound2 \
    libpangocairo-1.0-0 \
    libatk1.0-0 \
    libcairo-gobject2 \
    libgtk-3-0 \
    libgdk-pixbuf2.0-0 \
    fonts-liberation \
    libappindicator3-1 \
    libnss3 \
    lsb-release \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Çalışma dizini
WORKDIR /app

# Package dosyalarını kopyala
COPY package*.json ./

# Node dependencies yükle
RUN npm ci --only=production

# Playwright Chromium browser'ı yükle (ÖNEMLİ ADIM!)
RUN npx playwright install chromium
RUN npx playwright install-deps chromium

# Uygulama dosyalarını kopyala
COPY . .

# Screenshots dizini oluştur
RUN mkdir -p /app/screenshots && chmod 777 /app/screenshots

# Environment variables
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/app/node_modules/.cache/ms-playwright

# Port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Uygulamayı başlat
CMD ["node", "index.js"]
