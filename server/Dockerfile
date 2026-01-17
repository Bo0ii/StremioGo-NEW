FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package.json ./

# Install production dependencies only
RUN npm install --omit=dev

# Copy source files
COPY . .

# Set environment variables
ENV PORT=7860
ENV SERVER_PREFIX=S

# Expose port (HuggingFace Spaces uses 7860)
EXPOSE 7860

# Start the server
CMD ["node", "index.js"]
