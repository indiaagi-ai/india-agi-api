# Use the official Node.js image as the base image
FROM node:slim

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install the application dependencies
RUN npm install

# Install PM2 globally and application dependencies
RUN npm install pm2 -g && npm install

# Copy the rest of the application files
COPY . .

# Build the NestJS application
RUN npm run build

# Expose the application port
EXPOSE 4001

# Command to run the application
CMD ["pm2-runtime", "start", "dist/main.js", "--name", "india-agi-api"]