const { spawn } = require('child_process');
const path = require('path');

class YouTubeAIServiceManager {
    constructor() {
        this.serverProcess = null;
        this.isRunning = false;
        this.port = 8082;
        this.serviceUrl = `http://localhost:${this.port}`;
    }

    async startService() {
        return new Promise((resolve, reject) => {
            if (this.isRunning) {
                console.log('YouTube AI Service is already running');
                resolve(true);
                return;
            }

            try {
                const backendPath = path.join(__dirname, 'backend');

                // Start the Node.js server
                this.serverProcess = spawn('node', ['server.js'], {
                    cwd: backendPath,
                    stdio: 'pipe',
                    detached: false
                });

                this.serverProcess.stdout.on('data', (data) => {
                    console.log(`YouTube AI Service: ${data}`);
                });

                this.serverProcess.stderr.on('data', (data) => {
                    console.error(`YouTube AI Service Error: ${data}`);
                });

                this.serverProcess.on('close', (code) => {
                    console.log(`YouTube AI Service stopped with code ${code}`);
                    this.isRunning = false;
                    this.serverProcess = null;
                });

                this.serverProcess.on('error', (error) => {
                    console.error('Failed to start YouTube AI Service:', error);
                    this.isRunning = false;
                    reject(error);
                });

                // Give the server time to start
                setTimeout(() => {
                    this.isRunning = true;
                    console.log(`YouTube AI Service started on port ${this.port}`);
                    resolve(true);
                }, 2000);

            } catch (error) {
                console.error('Error starting YouTube AI Service:', error);
                reject(error);
            }
        });
    }

    stopService() {
        if (this.serverProcess && this.isRunning) {
            this.serverProcess.kill();
            this.isRunning = false;
            console.log('YouTube AI Service stopped');
        }
    }

    async checkServiceHealth() {
        try {
            const response = await fetch(`${this.serviceUrl}/api/health`);
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    getServiceUrl() {
        return this.serviceUrl;
    }

    isServiceRunning() {
        return this.isRunning;
    }
}

module.exports = YouTubeAIServiceManager;