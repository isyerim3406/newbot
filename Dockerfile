# Base image
FROM node:18-slim

# Sadece temel bağımlılıklar
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Çalışma dizini
WORKDIR /app

# package.json ve package-lock.json kopyala
COPY package*.json ./

# npm install (Puppeteer'in tarayıcı indirmesini engelleyeceğiz)
RUN npm install --omit=dev

# Uygulama dosyalarını kopyala
COPY . .

# Render’da kullanılacak port
EXPOSE 3000

# Başlatma komutu
CMD ["node", "index.js"]
