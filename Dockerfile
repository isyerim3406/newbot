# Base image
FROM node:18-slim

# Çalışma dizini
WORKDIR /app

# package.json ve package-lock.json kopyala
COPY package*.json ./

# Uygulama dosyalarını kopyala
COPY . .

# Render’da kullanılacak port
EXPOSE 3000

# Başlatma komutu
CMD ["node", "index.js"]
