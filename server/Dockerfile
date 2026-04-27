# -------------------------------
# Production Dockerfile
# Blogging Platform Backend
# -------------------------------

FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files first (better caching)
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy all project files
COPY . .

# Remove unnecessary folders/files
RUN rm -rf tests

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose backend port
EXPOSE 3000

# Health check 
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Start backend server
CMD ["node", "server.js"]