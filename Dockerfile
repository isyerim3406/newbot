# Node 18 + Debian tabanlı image
FROM node:18-bullseye

# Chrome ve bağımlılıkları
RUN apt-get update && apt-get install -y \
    wget curl gnupg --no-install-recommends \
    && wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update && apt-get install -y google-chrome-stable --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Çalışma dizini
WORKDIR /app

# Paketleri kopyala ve yükle
COPY package*.json ./
RUN npm install

# Uygulama dosyalarını kopyala
COPY . .

# ChromeDriver artık npm paketi ile node_modules/.bin içinde olacak
ENV PATH="/app/node_modules/.bin:$PATH"

# Uygulama başlatma
CMD ["npm", "start"]
