FROM node:18-slim

# Sistem Chrome kur
RUN apt-get update && apt-get install -y \
    wget gnupg unzip \
    && wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list' \
    && apt-get update && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

# Puppeteer-core ile hızlı kurulum
RUN npm install --omit=dev

COPY . .

EXPOSE 10000
CMD ["node", "index.js"]
