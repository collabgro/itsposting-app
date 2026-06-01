FROM node:20-slim

# Install Chromium and all required system dependencies for Playwright
# apt-get handles all Chromium deps automatically on Debian Bookworm
RUN apt-get update && apt-get install -y \
    chromium \
    ca-certificates \
    fonts-liberation \
    fonts-noto \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Tell playwright-chromium to skip downloading its own browser bundle
# and use the system-installed Chromium instead
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV CHROMIUM_PATH=/usr/bin/chromium

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

EXPOSE 8080
CMD ["node", "server.js"]
