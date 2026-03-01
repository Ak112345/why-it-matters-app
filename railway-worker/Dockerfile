FROM node:20-slim

# Install system dependencies for ffmpeg and build tools
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      xz-utils \
      ca-certificates \
      wget \
      python3 \
      make \
      g++ && \
    wget https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz && \
    tar xf ffmpeg-release-amd64-static.tar.xz && \
    mv ffmpeg-*-amd64-static/ffmpeg /usr/local/bin/ && \
    mv ffmpeg-*-amd64-static/ffprobe /usr/local/bin/ && \
    rm -rf ffmpeg-* && \
    apt-get remove -y wget xz-utils && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files FIRST and install all dependencies
COPY package*.json ./
RUN npm ci --include=dev

# Copy TypeScript config and source
COPY tsconfig.json ./
COPY src ./src

# Compile TypeScript
RUN npm run build

# Remove dev dependencies for production (optional, keeps image smaller)
# RUN npm ci --production

EXPOSE 3001

# Health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

CMD ["node", "dist/index.js"]
