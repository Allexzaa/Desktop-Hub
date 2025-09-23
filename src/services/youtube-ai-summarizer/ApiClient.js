class YouTubeAIApiClient {
    constructor(baseUrl = 'http://localhost:8082') {
        this.baseUrl = baseUrl;
    }

    async extractTranscript(videoId) {
        try {
            const response = await fetch(`${this.baseUrl}/api/transcript?videoId=${videoId}`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error extracting transcript:', error);
            throw error;
        }
    }

    async generateSummary(transcript, model = 'gemma2:9b', options = {}) {
        try {
            const response = await fetch(`${this.baseUrl}/api/summarize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    transcript,
                    model,
                    options: {
                        outputFormat: options.outputFormat || 'markdown',
                        bulletStyle: options.bulletStyle || '•',
                        includeTimestamps: options.includeTimestamps !== false,
                        includeQuotes: options.includeQuotes !== false,
                        maxTokens: options.maxTokens || 1200,
                        temperature: options.temperature || 0.4,
                        useExternalAPI: options.useExternalAPI || false,
                        externalAPIConfig: options.externalAPIConfig || null
                    }
                })
            });

            if (!response.ok) {
                // Try to get error details from response
                let errorMessage = `HTTP error! status: ${response.status}`;
                try {
                    const errorData = await response.json();
                    if (errorData.error) {
                        errorMessage = errorData.error;
                    }
                } catch (parseError) {
                    // If we can't parse the error response, use the status
                }

                // Provide specific error messages for common issues
                if (response.status === 404) {
                    errorMessage = `Model "${model}" not found. Please check if the model is installed in Ollama.`;
                } else if (response.status === 500) {
                    errorMessage = `Server error while processing with model "${model}". The model might not be available or there's an issue with the AI service.`;
                } else if (response.status === 400) {
                    errorMessage = `Invalid request. Please check your settings and try again.`;
                }

                throw new Error(errorMessage);
            }

            const data = await response.json();
            
            if (!data.summary) {
                throw new Error(`No summary generated. The model "${model}" might have failed to process the content.`);
            }
            
            return data.summary;
        } catch (error) {
            console.error('Error generating summary:', error);
            
            // Enhance error messages for network issues
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('Cannot connect to YouTube AI Service. Please ensure the backend service is running on port 8082.');
            }
            
            throw error;
        }
    }

    async getChannelInfo(channelUrl) {
        try {
            const response = await fetch(`${this.baseUrl}/api/channel?url=${encodeURIComponent(channelUrl)}`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (!data.success || !data.channelInfo) {
                throw new Error('Failed to get channel information');
            }
            
            return data.channelInfo;
        } catch (error) {
            console.error('Error fetching channel info:', error);
            throw error;
        }
    }

    // Favorite Channels Management
    async addFavoriteChannel(channelUrl) {
        try {
            const response = await fetch(`${this.baseUrl}/api/favorites/add`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ channelUrl })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to add favorite channel');
            }
            
            return data;
        } catch (error) {
            console.error('Error adding favorite channel:', error);
            throw error;
        }
    }

    async removeFavoriteChannel(channelId) {
        try {
            const response = await fetch(`${this.baseUrl}/api/favorites/remove`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ channelId })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to remove favorite channel');
            }
            
            return data;
        } catch (error) {
            console.error('Error removing favorite channel:', error);
            throw error;
        }
    }

    async getFavoriteChannels() {
        try {
            const response = await fetch(`${this.baseUrl}/api/favorites`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (!data.success) {
                throw new Error('Failed to get favorite channels');
            }
            
            return data;
        } catch (error) {
            console.error('Error fetching favorite channels:', error);
            throw error;
        }
    }

    // Video Monitoring
    async checkForNewVideos() {
        try {
            const response = await fetch(`${this.baseUrl}/api/videos/check`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to check for new videos');
            }
            
            return data;
        } catch (error) {
            console.error('Error checking for new videos:', error);
            throw error;
        }
    }





    async checkServiceHealth() {
        try {
            const response = await fetch(`${this.baseUrl}/api/health`);
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    async startService() {
        try {
            const response = await fetch(`${this.baseUrl}/api/service/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to start service: ${response.status}`);
            }

            const data = await response.json();
            return data.success;
        } catch (error) {
            console.error('Error starting service:', error);
            // Since we can't control the service from the browser,
            // we'll provide guidance to start it manually
            throw new Error('Please start the backend service manually by running: node src/services/youtube-ai-summarizer/backend/server.js');
        }
    }

    async stopService() {
        try {
            const response = await fetch(`${this.baseUrl}/api/service/stop`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to stop service: ${response.status}`);
            }

            const data = await response.json();
            return data.success;
        } catch (error) {
            console.error('Error stopping service:', error);
            // Since we can't control the service from the browser,
            // we'll provide guidance to stop it manually
            throw new Error('Please stop the backend service manually by pressing Ctrl+C in the terminal where it\'s running');
        }
    }

    extractVideoId(url) {
        if (!url) return null;



        // YouTube URL patterns
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
            /^([a-zA-Z0-9_-]{11})$/ // Direct video ID
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) {
                return match[1];
            }
        }

        return null;
    }

    isValidYouTubeUrl(url) {
        return this.extractVideoId(url) !== null;
    }
}

export default YouTubeAIApiClient;