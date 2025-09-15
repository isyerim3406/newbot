# Base image
FROM node:18-slim

# Chrome ve gerekli kütüphaneler
RUN apt-get update && apt-get install -y \
    wget gnupg unzip \
    && wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list' \
    && apt-get update && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# Working directory
WORKDIR /app

# package.json ve package-lock.json
COPY package*.json ./

# npm install
RUN npm install

# Uygulama dosyalarını kopyala
COPY . .

# Port (isteğe bağlı)
EXPOSE 3000

# Başlatma komutu
CMD ["npm", "start"]
