# Use Node.js 18 LTS
FROM node:18-slim

# Install necessary packages for Puppeteer
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    procps \
    libxss1 \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Set environment variable to skip Chromium download
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Install dependencies with verbose logging
RUN npm install --verbose

# Copy application code
COPY . .

# Create screenshots directory
RUN mkdir -p screenshots

# Set executable path for Chrome
ENV CHROME_BIN=/usr/bin/google-chrome-stable

# Expose port (if needed)
EXPOSE 3000

# Run the application
CMD ["npm", "start"]
