# Base image
FROM node:18-slim

# Çalışma dizinini ayarla
WORKDIR /app

# Gerekli sistem paketlerini kur ve Google Chrome'u yükle
RUN apt-get update && apt-get install -y \
    wget curl unzip gnupg --no-install-recommends \
    && wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

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
