# Use Node.js LTS version
FROM node:18-alpine

# Build argument for environment
ARG ENV=local

# Set working directory
WORKDIR /app

# Install production dependencies only
COPY package.json yarn.lock ./
RUN yarn install --production --frozen-lockfile

# Copy the built application and configs
COPY dist/ ./dist/

# Copy configuration file based on environment
COPY build/${ENV}/docker-config.yaml ./

# Create directory for database (will be mounted as volume)
RUN mkdir -p /app/data

# Expose the port (default 8000, can be overridden by config)
EXPOSE 8000

# Set default environment variables
ENV CONFIG_FILE="./docker-config.yaml"
ENV NODE_ENV="production"

# Start the application
CMD ["node", "dist/server/AppServer.js"]
