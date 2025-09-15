# Node 18 slim tabanlı image
FROM node:18-slim

# Ortam değişkeni: Chromium indirmesini atla
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Chrome kurulumu
RUN apt-get update && apt-get install -y \
    wget gnupg unzip \
    && wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list' \
    && apt-get update && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# Çalışma dizini
WORKDIR /app

# package.json ve package-lock.json kopyala
COPY package*.json ./

# Node modülleri kurulumu
RUN npm install

# Uygulama dosyalarını kopyala
COPY . .

# Port ve başlatma
EXPOSE 10000
CMD ["node", "index.js"]
