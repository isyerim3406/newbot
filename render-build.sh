#!/usr/bin/env bash
set -e

echo ">>> Chrome ve ChromeDriver kurulumu başlıyor..."

apt-get update
apt-get install -y wget curl unzip gnupg --no-install-recommends

# Google Chrome indir ve kur
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list
apt-get update
apt-get install -y google-chrome-stable --no-install-recommends

# Chrome sürümünü al
CHROME_VERSION=$(google-chrome --version | awk '{print $3}')
CHROME_MAJOR=$(echo $CHROME_VERSION | cut -d'.' -f1)
echo ">>> Yüklü Chrome sürümü: $CHROME_VERSION (major: $CHROME_MAJOR)"

# ChromeDriver versiyonunu bul
DRIVER_VERSION=$(curl -s "https://googlechromelabs.github.io/chrome-for-testing/LATEST_RELEASE_${CHROME_MAJOR}")
echo ">>> ChromeDriver versiyonu bulundu: $DRIVER_VERSION"

# ChromeDriver indir
DRIVER_URL="https://storage.googleapis.com/chrome-for-testing/${DRIVER_VERSION}/linux64/chromedriver-linux64.zip"
echo ">>> ChromeDriver indiriliyor: $DRIVER_URL"
wget -O /tmp/chromedriver.zip $DRIVER_URL

# Çıkart ve kur
unzip /tmp/chromedriver.zip -d /usr/local/bin/
chmod +x /usr/local/bin/chromedriver
rm /tmp/chromedriver.zip

echo ">>> ChromeDriver kurulumu tamamlandı."

# Proje build
npm install
npm run build || echo "npm run build yok, atlandı."
