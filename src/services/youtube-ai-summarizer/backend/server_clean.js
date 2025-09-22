const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

// Try to import required packages
let YoutubeTranscript = null;
let fetch = null;
let cheerio = null;

try {
    const ytTranscript = require('youtube-transcript');
    YoutubeTranscript = ytTranscript.YoutubeTranscript || ytTranscript;
    console.log('youtube-transcript package loaded successfully');
} catch (e) {
    console.log('youtube-transcript package not available');
}

try {
    fetch = require('node-fetch');
    cheerio = require('cheerio');
    console.log('Alternative transcript extraction tools loaded');
} catch (e) {
    console.log('Alternative packages not available');
}

const PORT = process.env.PORT || 8082;
const OLLAMA_URL = 'http://localhost:11434';

// YouTube Channel Extractor Class
class YouTubeChannelExtractor {
    constructor() {
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    }

    async extractChannelInfo(channelUrl) {
        console.log(`Starting channel extraction for: ${channelUrl}`);
        
        // Extract channel ID from URL
        const channelId = this.extractChannelId(channelUrl);
        console.log(`Extracted channel ID: ${channelId}`);
        
        // Method 1: Try to get channel info from channel page
        const channelInfo = await this.fetchChannelFromPage(channelUrl);
        if (channelInfo && channelInfo.name !== 'Unknown Channel') {
            console.log('Channel info from page:', JSON.stringify(channelInfo, null, 2));
            
            // If we got basic info but no subscriber count, try About page
            if (channelInfo.subscriberCount === 'Unknown') {
                console.log('Subscriber count still unknown, trying About page...');
                const aboutInfo = await this.fetchChannelAboutPage(channelUrl);
                if (aboutInfo && aboutInfo.subscriberCount !== 'Unknown') {
                    channelInfo.subscriberCount = aboutInfo.subscriberCount;
                    console.log('Updated subscriber count from About page:', channelInfo.subscriberCount);
                }
            }
            
            return channelInfo;
        }

        // Method 2: Try About page
        console.log('Main page failed, trying About page...');
        const aboutInfo = await this.fetchChannelAboutPage(channelUrl);
        if (aboutInfo && aboutInfo.name !== 'Unknown Channel') {
            console.log('Channel info from About page:', JSON.stringify(aboutInfo, null, 2));
            return aboutInfo;
        }

        // If all methods fail, return basic info
        return {
            id: channelId,
            name: 'Unknown Channel',
            thumbnail: null,
            subscriberCount: 'Unknown',
            url: channelUrl,
            verified: false
        };
    }

    extractChannelId(url) {
        // Handle different YouTube channel URL formats
        const patterns = [
            /youtube\.com\/@([^\/\?&]+)/,           // @username format
            /youtube\.com\/c\/([^\/\?&]+)/,         // /c/channelname format
            /youtube\.com\/channel\/([^\/\?&]+)/,   // /channel/ID format
            /youtube\.com\/user\/([^\/\?&]+)/       // /user/username format
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) {
                return match[1];
            }
        }

        return 'unknown';
    }

    async fetchChannelFromPage(channelUrl) {
        try {
            console.log('Fetching channel page...');
            console.log(`Fetching page: ${channelUrl}`);
            
            const response = await fetch(channelUrl, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'DNT': '1',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1'
                }
            });

            console.log(`Response status: ${response.status}`);
            console.log(`Response headers:`, Object.fromEntries(response.headers.entries()));

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const html = await response.text();
            console.log(`Page fetched successfully: ${html.length} characters`);

            return this.parseChannelPage(html, channelUrl);
        } catch (error) {
            console.error('Error fetching channel page:', error.message);
            return null;
        }
    }

    parseChannelPage(html, channelUrl) {
        try {
            console.log('Parsing channel page HTML...');
            console.log(`HTML length: ${html.length}`);

            // Extract ytInitialData
            const ytDataMatch = html.match(/var ytInitialData = ({.+?});/);
            if (!ytDataMatch) {
                console.log('ytInitialData not found');
                return this.parseChannelPageFallback(html, channelUrl);
            }

            console.log('Found ytInitialData');
            const ytData = JSON.parse(ytDataMatch[1]);
            
            return this.extractFromYtInitialData(ytData, channelUrl);
        } catch (error) {
            console.error('Error parsing channel page:', error.message);
            return this.parseChannelPageFallback(html, channelUrl);
        }
    }

    extractFromYtInitialData(ytData, channelUrl) {
        console.log('Analyzing ytInitialData structure...');
        
        const result = {
            id: this.extractChannelId(channelUrl),
            name: 'Unknown Channel',
            thumbnail: null,
            subscriberCount: 'Unknown',
            url: channelUrl,
            verified: false
        };

        try {
            // Check if we have metadata
            const hasMetadata = ytData.metadata && ytData.metadata.channelMetadataRenderer;
            console.log('Found metadata:', !!hasMetadata);

            // Check if we have header
            const hasHeader = ytData.header && (ytData.header.c4TabbedHeaderRenderer || ytData.header.pageHeaderRenderer);
            console.log('Found header:', !!hasHeader);

            // Check if we have microformat
            const hasMicroformat = ytData.microformat && ytData.microformat.microformatDataRenderer;
            console.log('Found microformat:', !!hasMicroformat);

            // Extract from metadata
            if (hasMetadata) {
                const metadata = ytData.metadata.channelMetadataRenderer;
                if (metadata.title) {
                    result.name = metadata.title;
                    console.log('Name from metadata:', result.name);
                }
                if (metadata.avatar && metadata.avatar.thumbnails && metadata.avatar.thumbnails.length > 0) {
                    result.thumbnail = metadata.avatar.thumbnails[metadata.avatar.thumbnails.length - 1].url;
                    console.log('Thumbnail found:', result.thumbnail);
                }
            }

            // Extract from header (where subscriber count usually is)
            if (hasHeader) {
                const header = ytData.header.c4TabbedHeaderRenderer || ytData.header.pageHeaderRenderer;
                
                // Try to find subscriber count in header
                if (header.subscriberCountText) {
                    result.subscriberCount = this.parseSubscriberCount(header.subscriberCountText);
                    console.log('Subscribers from header:', result.subscriberCount);
                }
                
                // Check for verification badge
                if (header.badges) {
                    result.verified = header.badges.some(badge => 
                        badge.metadataBadgeRenderer && 
                        badge.metadataBadgeRenderer.style === 'BADGE_STYLE_TYPE_VERIFIED'
                    );
                }
            }

            // Extract from microformat
            if (hasMicroformat) {
                const microformat = ytData.microformat.microformatDataRenderer;
                if (!result.name || result.name === 'Unknown Channel') {
                    result.name = microformat.title || result.name;
                }
                if (!result.thumbnail && microformat.thumbnail && microformat.thumbnail.thumbnails) {
                    result.thumbnail = microformat.thumbnail.thumbnails[microformat.thumbnail.thumbnails.length - 1].url;
                }
            }

            // If still not found, try to search the entire ytData object for subscriber info
            if (result.subscriberCount === 'Unknown') {
                console.log('Searching entire ytData for subscriber information...');
                
                // Let's debug what's actually in the ytData
                console.log('=== DEBUGGING YTDATA STRUCTURE ===');
                if (ytData.contents && ytData.contents.twoColumnBrowseResultsRenderer) {
                    console.log('Found twoColumnBrowseResultsRenderer');
                    const tabs = ytData.contents.twoColumnBrowseResultsRenderer.tabs;
                    if (tabs) {
                        console.log('Found tabs:', tabs.length);
                        tabs.forEach((tab, index) => {
                            if (tab.tabRenderer && tab.tabRenderer.title) {
                                console.log(`Tab ${index}: ${tab.tabRenderer.title}`);
                            }
                        });
                    }
                }
                
                // Try to find subscriber count in different locations
                const subscriberInfo = this.deepSearchForSubscribers(ytData);
                if (subscriberInfo) {
                    result.subscriberCount = subscriberInfo;
                    console.log('Subscribers from deep search:', subscriberInfo);
                } else {
                    console.log('Deep search did not find subscriber information');
                    
                    // Try alternative extraction methods
                    console.log('Trying alternative extraction methods...');
                    const altSubscribers = this.extractSubscribersAlternative(ytData);
                    if (altSubscribers) {
                        result.subscriberCount = altSubscribers;
                        console.log('Subscribers from alternative method:', altSubscribers);
                    }
                }
            }

            console.log('Final ytInitialData extraction result:', result);
            return result;

        } catch (error) {
            console.error('Error extracting from ytInitialData:', error.message);
            return result;
        }
    }

    deepSearchForSubscribers(obj, path = '') {
        if (typeof obj !== 'object' || obj === null) {
            return null;
        }

        // Check if current object has subscriber-related properties
        for (const key of Object.keys(obj)) {
            if (key.toLowerCase().includes('subscriber')) {
                const value = obj[key];
                if (typeof value === 'string' || typeof value === 'object') {
                    const parsed = this.parseSubscriberCount(value);
                    if (parsed !== 'Unknown') {
                        console.log(`Found subscribers at ${path}.${key}:`, parsed);
                        return parsed;
                    }
                }
            }
        }

        // Recursively search in nested objects and arrays
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'object' && value !== null) {
                const result = this.deepSearchForSubscribers(value, path ? `${path}.${key}` : key);
                if (result) {
                    return result;
                }
            }
        }

        return null;
    }

    extractSubscribersAlternative(ytData) {
        try {
            // Look for subscriber count in different possible locations
            const searchPaths = [
                'contents.twoColumnBrowseResultsRenderer.tabs[0].tabRenderer.content.sectionListRenderer.contents[0].itemSectionRenderer.contents[0].channelAboutFullMetadataRenderer.subscriberCountText',
                'sidebar.playlistSidebarRenderer.items[0].playlistSidebarPrimaryInfoRenderer.videoOwner.videoOwnerRenderer.subscriberCountText',
                'contents.twoColumnBrowseResultsRenderer.secondaryContents.browseSecondaryContentsRenderer.contents[0].verticalChannelSectionRenderer.items[0].channelFeaturedContentRenderer.items[0].videoRenderer.ownerText.runs[0].navigationEndpoint.browseEndpoint.canonicalBaseUrl'
            ];

            for (const path of searchPaths) {
                const value = this.getNestedValue(ytData, path);
                if (value) {
                    const parsed = this.parseSubscriberCount(value);
                    if (parsed !== 'Unknown') {
                        console.log(`Found subscribers via alternative path ${path}:`, parsed);
                        return parsed;
                    }
                }
            }

            return null;
        } catch (error) {
            console.error('Error in alternative subscriber extraction:', error.message);
            return null;
        }
    }

    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            if (key.includes('[') && key.includes(']')) {
                const [arrayKey, indexStr] = key.split('[');
                const index = parseInt(indexStr.replace(']', ''));
                return current && current[arrayKey] && current[arrayKey][index];
            }
            return current && current[key];
        }, obj);
    }

    parseSubscriberCount(subscriberData) {
        if (!subscriberData) return 'Unknown';

        let text = '';
        
        if (typeof subscriberData === 'string') {
            text = subscriberData;
        } else if (subscriberData.simpleText) {
            text = subscriberData.simpleText;
        } else if (subscriberData.runs && subscriberData.runs.length > 0) {
            text = subscriberData.runs.map(run => run.text).join('');
        } else if (typeof subscriberData === 'object') {
            // Try to find text in nested object
            const findText = (obj) => {
                if (typeof obj === 'string') return obj;
                if (obj && obj.simpleText) return obj.simpleText;
                if (obj && obj.runs) return obj.runs.map(run => run.text).join('');
                if (typeof obj === 'object') {
                    for (const value of Object.values(obj)) {
                        const result = findText(value);
                        if (result) return result;
                    }
                }
                return null;
            };
            text = findText(subscriberData) || '';
        }

        // Clean and parse the subscriber count
        text = text.toLowerCase().trim();
        
        if (!text || !text.includes('subscriber')) {
            return 'Unknown';
        }

        // Extract number and unit
        const match = text.match(/([\d.,]+)\s*([kmb]?)\s*subscriber/);
        if (!match) return 'Unknown';

        const [, numberStr, unit] = match;
        let number = parseFloat(numberStr.replace(/,/g, ''));

        switch (unit.toLowerCase()) {
            case 'k':
                number *= 1000;
                break;
            case 'm':
                number *= 1000000;
                break;
            case 'b':
                number *= 1000000000;
                break;
        }

        return this.formatSubscriberCount(Math.round(number));
    }

    formatSubscriberCount(count) {
        if (count >= 1000000000) {
            return `${(count / 1000000000).toFixed(1)}B subscribers`;
        } else if (count >= 1000000) {
            return `${(count / 1000000).toFixed(1)}M subscribers`;
        } else if (count >= 1000) {
            return `${(count / 1000).toFixed(1)}K subscribers`;
        } else {
            return `${count} subscribers`;
        }
    }

    parseChannelPageFallback(html, channelUrl) {
        console.log('Using fallback parsing method...');
        
        const result = {
            id: this.extractChannelId(channelUrl),
            name: 'Unknown Channel',
            thumbnail: null,
            subscriberCount: 'Unknown',
            url: channelUrl,
            verified: false
        };

        try {
            // Try to extract channel name from title tag
            const titleMatch = html.match(/<title>([^<]+)<\/title>/);
            if (titleMatch) {
                result.name = titleMatch[1].replace(' - YouTube', '').trim();
            }

            // Try to extract subscriber count from meta tags or visible text
            const subscriberMatches = [
                /(\d+(?:\.\d+)?[KMB]?)\s+subscribers?/gi,
                /"subscriberCountText":\s*{"simpleText":\s*"([^"]+)"/g,
                /"subscriberCountText":\s*{"runs":\s*\[{"text":\s*"([^"]+)"/g
            ];

            for (const regex of subscriberMatches) {
                const match = html.match(regex);
                if (match) {
                    result.subscriberCount = match[1];
                    break;
                }
            }

            return result;
        } catch (error) {
            console.error('Error in fallback parsing:', error.message);
            return result;
        }
    }

    async fetchChannelAboutPage(channelUrl) {
        try {
            const aboutUrl = channelUrl.endsWith('/') ? `${channelUrl}about` : `${channelUrl}/about`;
            console.log(`Fetching About page: ${aboutUrl}`);
            
            const response = await fetch(aboutUrl, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const html = await response.text();
            console.log(`About page fetched: ${html.length} characters`);

            return this.parseChannelPage(html, channelUrl);
        } catch (error) {
            console.error('Error fetching About page:', error.message);
            return null;
        }
    }
}

// MIME types for different file extensions
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// Create HTTP server
const server = http.createServer(async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const pathname = parsedUrl.pathname;

    // API Routes
    if (pathname === '/api/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
        return;
    }

    if (pathname === '/api/channel') {
        try {
            const channelUrl = parsedUrl.searchParams.get('url');

            if (!channelUrl) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Channel URL is required' }));
                return;
            }

            console.log(`\n=== EXTRACTING CHANNEL INFO ===`);
            console.log(`URL: ${channelUrl}`);

            const channelExtractor = new YouTubeChannelExtractor();
            const channelInfo = await channelExtractor.extractChannelInfo(channelUrl);

            console.log(`=== EXTRACTION COMPLETE ===`);
            console.log(`Name: ${channelInfo.name}`);
            console.log(`Subscribers: ${channelInfo.subscriberCount}`);
            console.log(`Thumbnail: ${channelInfo.thumbnail ? 'Found' : 'Not found'}`);
            console.log(`Verified: ${channelInfo.verified}`);
            console.log(`===============================\n`);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                channelInfo: channelInfo
            }));

        } catch (error) {
            console.error('Channel extraction error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: `Failed to extract channel info: ${error.message}`
            }));
        }
        return;
    }

    // Serve static files
    let filePath = path.join(__dirname, pathname === '/' ? '/index.html' : pathname);

    // Security check - prevent directory traversal
    if (!filePath.startsWith(__dirname)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    const extname = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[extname] || 'text/plain';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 - File Not Found</h1>');
            } else {
                res.writeHead(500);
                res.end(`Server Error: ${err.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

server.listen(PORT, () => {
    console.log(`YouTube Transcript Summarizer Server running at http://localhost:${PORT}`);
    console.log('Open your browser and navigate to the above URL to use the application.');
});