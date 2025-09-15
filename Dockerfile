# Node 18 + Debian tabanlı image
FROM node:18-bullseye

# Chrome ve bağımlılıkları
RUN apt-get update && apt-get install -y \
    wget curl unzip gnupg --no-install-recommends \
    && wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update && apt-get install -y google-chrome-stable --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# ChromeDriver kurulumu (Chrome sürümüne uyumlu)
RUN CHROME_VERSION=$(google-chrome --version | awk '{print $3}') \
    && CHROME_MAJOR=$(echo $CHROME_VERSION | cut -d'.' -f1) \
    && DRIVER_VERSION=$(curl -s "https://googlechromelabs.github.io/chrome-for-testing/LATEST_RELEASE_${CHROME_MAJOR}") \
    && wget -O /tmp/chromedriver.zip https://storage.googleapis.com/chrome-for-testing/${DRIVER_VERSION}/linux64/chromedriver-linux64.zip \
    && unzip /tmp/chromedriver.zip -d /tmp/ \
    && mv /tmp/chromedriver-linux64/chromedriver /usr/local/bin/ \
    && chmod +x /usr/local/bin/chromedriver \
    && rm -rf /tmp/chromedriver*

# Çalışma dizini
WORKDIR /app

# Paketleri kopyala ve yükle
COPY package*.json ./
RUN npm install

# Uygulama dosyalarını kopyala
COPY . .

# Uygulama başlatma
CMD ["npm", "start"]
