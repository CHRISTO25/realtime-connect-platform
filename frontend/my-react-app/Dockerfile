# Stage 1: Build React static assets with Node.js
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency specifications and install
COPY package*.json ./
RUN npm ci

# Copy source code and build production bundle
COPY . .
RUN npm run build

# Stage 2: Serve static files with minimal Nginx Alpine
FROM nginx:1.27-alpine

# Remove default site
RUN rm -rf /usr/share/nginx/html/*

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled assets from Vite /dist
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]