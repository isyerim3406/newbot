# Base image
FROM node:16.20.0-bullseye-slim

# Gerekli sistem paketlerini kur ve sertifika paketlerini ekle
RUN apt-get update && apt-get install -y \
    wget curl unzip gnupg ca-certificates apt-transport-https --no-install-recommends

# Google Chrome'u kur ve paket anahtarını güncel yöntemle ekle
RUN wget -O /tmp/google.gpg https://dl.google.com/linux/linux_signing_key.pub \
    && gpg --dearmor < /tmp/google.gpg > /etc/apt/trusted.gpg.d/google-chrome.gpg \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*
    
# Çalışma dizinini ayarla
WORKDIR /app

# package.json ve package-lock.json dosyalarını kopyala
COPY package*.json ./

# npm bağımlılıklarını kur
RUN npm install

# Uygulama dosyalarını kopyala
COPY . .

# Puppeteer'ın Chrome'u doğru bulmasını sağla
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Başlangıç komutu
CMD ["/usr/bin/node", "index.js"]
