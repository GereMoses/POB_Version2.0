# Multi-stage build for React application
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files first for better caching
COPY package.json package-lock.json* ./

# Set npm registry for faster downloads
RUN npm config set registry https://registry.npmjs.org/

# Clean npm cache and install with verbose output
RUN npm cache clean --force && \
    npm install --verbose --no-audit --no-fund

# Copy source code
COPY . .

# Set environment variables for build
ENV NODE_ENV=production
ENV GENERATE_SOURCEMAP=false
ENV REACT_APP_API_BASE_URL=/api/v1

# Build the application (CI=false so warnings don't fail the build)
RUN CI=false npm run build || CI=false npx react-scripts build

# Production stage
FROM nginx:alpine AS production

# Install wget for health check
RUN apk add --no-cache wget

# Copy built application
COPY --from=builder /app/build /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
