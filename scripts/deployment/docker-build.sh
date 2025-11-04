#!/bin/bash
# BullBook Docker Build Script
# Usage: ./scripts/deployment/docker-build.sh [tag]
# Example: ./scripts/deployment/docker-build.sh v1.0.0

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"

TAG="${1:-latest}"
IMAGE_NAME="bullbook"

echo "🐳 Building BullBook Docker Image"
echo "===================================="
echo "Image: $IMAGE_NAME:$TAG"
echo ""

# Check if Dockerfile exists
if [ ! -f "Dockerfile" ]; then
  echo "⚠️  Dockerfile not found. Creating placeholder..."
  echo ""
  cat > Dockerfile << 'EOF'
# BullBook Dockerfile (placeholder)
# TODO: Implement multi-stage build when framework is chosen

FROM node:20-alpine AS base

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Build application
RUN npm run build

# Expose port
EXPOSE 3000

# Start application
CMD ["npm", "start"]
EOF
  echo "📝 Placeholder Dockerfile created"
  echo "⚠️  Update Dockerfile after choosing tech stack"
  echo ""
fi

# Build Docker image
echo "📦 Building Docker image..."
docker build -t "$IMAGE_NAME:$TAG" .

echo ""
echo "✅ Docker image built successfully"
echo "Image: $IMAGE_NAME:$TAG"
echo ""
echo "Test with:"
echo "  docker run -p 3000:3000 $IMAGE_NAME:$TAG"
echo ""
echo "Tag for registry:"
echo "  docker tag $IMAGE_NAME:$TAG registry.example.com/$IMAGE_NAME:$TAG"
