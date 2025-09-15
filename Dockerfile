# 1️⃣ Base image olarak Node 18 kullanıyoruz
FROM node:18

# 2️⃣ Çalışma dizini
WORKDIR /app

# 3️⃣ package.json ve package-lock.json'u kopyala
COPY package*.json ./

# 4️⃣ Gerekli paketleri yükle
RUN npm install

# 5️⃣ Tüm proje dosyalarını kopyala
COPY . .

# 6️⃣ Puppeteer için gerekli kütüphaneler
RUN apt-get update && apt-get install -y \
    wget \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# 7️⃣ Port ayarı
EXPOSE 10000

# 8️⃣ Start komutu
CMD ["node", "index.js"]
