# Use Node.js LTS version
FROM node:18-alpine

# Build argument for environment
ARG ENV=local

# Set working directory
WORKDIR /app

# Install dependencies
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Copy the built application and configs
COPY dist/ ./dist/

# Copy configuration files
COPY build/${ENV}/config.yaml ./

# Create directory for database (will be mounted as volume)
RUN mkdir -p /app/data

# Expose the port (default 8000, can be overridden by config)
EXPOSE 8000
# Expose debug port for Node.js debugging
EXPOSE 9229

# Set default environment variables
ENV CONFIG_FILE="./config.yaml"
ENV NODE_ENV="production"

# Use a script to handle both debug and non-debug modes
COPY build/docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Start the application
CMD ["./docker-entrypoint.sh"]
