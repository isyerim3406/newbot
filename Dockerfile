# Use Node.js 18 LTS
FROM node:18-slim

# Install necessary packages for Puppeteer and Google Chrome
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    procps \
    libxss1 \
    --no-install-recommends \
    && wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Set environment variable to skip Chromium download by Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Create screenshots directory (gerçi kodda da oluşturuluyor ama garanti olsun)
RUN mkdir -p screenshots

# Set executable path for Chrome for Puppeteer to find it
ENV CHROME_BIN=/usr/bin/google-chrome-stable

# <<< DEĞİŞİKLİK: Uygulamanın dinlediği port ile eşleştirildi
EXPOSE 10000

# Run the application
CMD ["npm", "start"]
