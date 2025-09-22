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

// Data storage paths
const DATA_DIR = path.join(__dirname, 'data');
const CHANNELS_FILE = path.join(DATA_DIR, 'favorite_channels.json');
const VIDEOS_FILE = path.join(DATA_DIR, 'recent_videos.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'monitor_settings.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Default monitoring settings
const DEFAULT_SETTINGS = {
    checkIntervalMinutes: 60, // Check every hour
    videoLookbackHours: 24,   // Look for videos from last 24 hours (fixed)
    maxVideosPerChannel: 5    // Keep last 5 videos per channel
};

// YouTube Channel Video Monitor Class
class YouTubeChannelVideoMonitor {
    constructor() {
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        this.monitorInterval = null;
        this.settings = this.loadSettings();
        this.favoriteChannels = this.loadFavoriteChannels();
        this.recentVideos = this.loadRecentVideos();
    }

    loadSettings() {
        try {
            if (fs.existsSync(SETTINGS_FILE)) {
                const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
                return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
            }
        } catch (error) {
            console.error('Error loading settings:', error.message);
        }
        return DEFAULT_SETTINGS;
    }

    saveSettings() {
        try {
            fs.writeFileSync(SETTINGS_FILE, JSON.stringify(this.settings, null, 2));
        } catch (error) {
            console.error('Error saving settings:', error.message);
        }
    }

    loadFavoriteChannels() {
        try {
            if (fs.existsSync(CHANNELS_FILE)) {
                const data = fs.readFileSync(CHANNELS_FILE, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('Error loading favorite channels:', error.message);
        }
        return [];
    }

    saveFavoriteChannels() {
        try {
            fs.writeFileSync(CHANNELS_FILE, JSON.stringify(this.favoriteChannels, null, 2));
        } catch (error) {
            console.error('Error saving favorite channels:', error.message);
        }
    }

    loadRecentVideos() {
        try {
            if (fs.existsSync(VIDEOS_FILE)) {
                const data = fs.readFileSync(VIDEOS_FILE, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('Error loading recent videos:', error.message);
        }
        return {};
    }

    saveRecentVideos() {
        try {
            fs.writeFileSync(VIDEOS_FILE, JSON.stringify(this.recentVideos, null, 2));
        } catch (error) {
            console.error('Error saving recent videos:', error.message);
        }
    }

    addFavoriteChannel(channelInfo) {
        // Check if channel already exists
        const existingIndex = this.favoriteChannels.findIndex(ch => ch.id === channelInfo.id);

        if (existingIndex >= 0) {
            // Update existing channel info
            this.favoriteChannels[existingIndex] = {
                ...this.favoriteChannels[existingIndex],
                ...channelInfo,
                addedAt: this.favoriteChannels[existingIndex].addedAt // Keep original add time
            };
        } else {
            // Add new channel
            this.favoriteChannels.push({
                ...channelInfo,
                addedAt: new Date().toISOString()
            });
        }

        this.saveFavoriteChannels();

        // Initialize empty video list for new channel
        if (!this.recentVideos[channelInfo.id]) {
            this.recentVideos[channelInfo.id] = [];
            this.saveRecentVideos();
        }

        return true;
    }

    removeFavoriteChannel(channelId) {
        this.favoriteChannels = this.favoriteChannels.filter(ch => ch.id !== channelId);
        delete this.recentVideos[channelId];

        this.saveFavoriteChannels();
        this.saveRecentVideos();

        return true;
    }

    async fetchChannelVideos(channelUrl) {
        try {
            console.log(`Fetching videos for channel: ${channelUrl}`);
            
            // Ensure the URL ends with /videos
            let videosUrl = channelUrl;
            if (!videosUrl.endsWith('/videos')) {
                videosUrl = videosUrl.replace(/\/$/, '') + '/videos';
            }
            
            console.log(`Videos URL: ${videosUrl}`);
            
            const response = await fetch(videosUrl, {
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
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const html = await response.text();
            console.log(`HTML length: ${html.length}`);
            
            const videos = this.parseChannelVideos(html);
            console.log(`Parsed ${videos.length} videos`);
            
            return videos;
        } catch (error) {
            console.error(`Error fetching videos for ${channelUrl}:`, error.message);
            return [];
        }
    }

    parseChannelVideos(html) {
        try {
            const videos = [];
            
            console.log('Parsing channel videos HTML...');

            // Extract ytInitialData
            const ytDataMatch = html.match(/var ytInitialData = ({.+?});/);
            if (!ytDataMatch) {
                console.log('ytInitialData not found in videos page');
                return videos;
            }

            console.log('Found ytInitialData, parsing...');
            const ytData = JSON.parse(ytDataMatch[1]);

            // Navigate to videos section
            const tabs = ytData?.contents?.twoColumnBrowseResultsRenderer?.tabs;
            console.log(`Found ${tabs?.length || 0} tabs`);
            
            if (!tabs) {
                console.log('No tabs found in ytData');
                return videos;
            }

            // Debug: log all tab titles
            tabs.forEach((tab, index) => {
                const title = tab.tabRenderer?.title;
                const selected = tab.tabRenderer?.selected;
                console.log(`Tab ${index}: ${title} (selected: ${selected})`);
            });

            // Find the Videos tab
            const videosTab = tabs.find(tab =>
                tab.tabRenderer?.title === 'Videos' ||
                tab.tabRenderer?.selected === true
            );

            if (!videosTab) {
                console.log('Videos tab not found');
                return videos;
            }

            console.log('Found Videos tab, extracting content...');

            // Extract video items
            const videoItems = videosTab?.tabRenderer?.content?.richGridRenderer?.contents || [];
            console.log(`Found ${videoItems.length} video items`);

            for (const item of videoItems) {
                const videoRenderer = item?.richItemRenderer?.content?.videoRenderer;
                if (!videoRenderer) {
                    console.log('No videoRenderer found in item');
                    continue;
                }

                const videoId = videoRenderer.videoId;
                const title = videoRenderer.title?.runs?.[0]?.text || videoRenderer.title?.simpleText;
                const publishedText = videoRenderer.publishedTimeText?.simpleText;

                console.log(`Video: ${title} (${videoId}) - ${publishedText}`);

                if (videoId && title && publishedText) {
                    const publishedTime = this.parsePublishedTime(publishedText);

                    videos.push({
                        id: videoId,
                        title: title,
                        url: `https://www.youtube.com/watch?v=${videoId}`,
                        publishedText: publishedText,
                        publishedTime: publishedTime,
                        thumbnail: videoRenderer.thumbnail?.thumbnails?.[0]?.url
                    });
                } else {
                    console.log(`Skipping video - missing data: videoId=${!!videoId}, title=${!!title}, publishedText=${!!publishedText}`);
                }
            }

            console.log(`Successfully parsed ${videos.length} videos`);
            return videos;
        } catch (error) {
            console.error('Error parsing channel videos:', error.message);
            console.error('Stack trace:', error.stack);
            return [];
        }
    }

    parsePublishedTime(publishedText) {
        try {
            const now = new Date();
            const text = publishedText.toLowerCase();

            if (text.includes('minute')) {
                const minutes = parseInt(text.match(/(\d+)/)?.[1] || '0');
                return new Date(now.getTime() - minutes * 60 * 1000);
            } else if (text.includes('hour')) {
                const hours = parseInt(text.match(/(\d+)/)?.[1] || '0');
                return new Date(now.getTime() - hours * 60 * 60 * 1000);
            } else if (text.includes('day')) {
                const days = parseInt(text.match(/(\d+)/)?.[1] || '0');
                return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
            } else if (text.includes('week')) {
                const weeks = parseInt(text.match(/(\d+)/)?.[1] || '0');
                return new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);
            } else if (text.includes('month')) {
                const months = parseInt(text.match(/(\d+)/)?.[1] || '0');
                return new Date(now.getTime() - months * 30 * 24 * 60 * 60 * 1000);
            }

            return now; // Default to now if can't parse
        } catch (error) {
            return new Date();
        }
    }

    async checkForNewVideos() {
        console.log('Checking for new videos...');
        const cutoffTime = new Date(Date.now() - this.settings.videoLookbackHours * 60 * 60 * 1000);
        let newVideosFound = 0;

        for (const channel of this.favoriteChannels) {
            try {
                console.log(`Checking channel: ${channel.name}`);
                const videos = await this.fetchChannelVideos(channel.url);

                // Filter for new videos within the lookback period
                const newVideos = videos.filter(video => {
                    const isNew = video.publishedTime > cutoffTime;
                    const notAlreadyStored = !this.recentVideos[channel.id]?.some(stored => stored.id === video.id);
                    return isNew && notAlreadyStored;
                });

                if (newVideos.length > 0) {
                    console.log(`Found ${newVideos.length} new videos for ${channel.name}`);
                    newVideosFound += newVideos.length;

                    // Add new videos to the beginning of the array
                    if (!this.recentVideos[channel.id]) {
                        this.recentVideos[channel.id] = [];
                    }

                    this.recentVideos[channel.id] = [
                        ...newVideos,
                        ...this.recentVideos[channel.id]
                    ].slice(0, this.settings.maxVideosPerChannel); // Keep only the latest N videos
                }

                // Always update with latest videos (even if not "new")
                const allRecentVideos = videos.slice(0, this.settings.maxVideosPerChannel);
                this.recentVideos[channel.id] = allRecentVideos;

            } catch (error) {
                console.error(`Error checking videos for ${channel.name}:`, error.message);
            }
        }

        this.saveRecentVideos();
        console.log(`Video check complete. Found ${newVideosFound} new videos total.`);
        return newVideosFound;
    }

    startMonitoring() {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
        }

        console.log(`Starting video monitoring every ${this.settings.checkIntervalMinutes} minutes`);

        // Run initial check
        this.checkForNewVideos();

        // Set up recurring checks
        this.monitorInterval = setInterval(() => {
            this.checkForNewVideos();
        }, this.settings.checkIntervalMinutes * 60 * 1000);
    }

    stopMonitoring() {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
            console.log('Video monitoring stopped');
        }
    }

    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        this.saveSettings();

        // Restart monitoring with new settings
        if (this.monitorInterval) {
            this.startMonitoring();
        }
    }

    getFavoriteChannels() {
        return this.favoriteChannels;
    }

    getRecentVideos() {
        return this.recentVideos;
    }

    getSettings() {
        return this.settings;
    }

    updateChannelSettings(channelId, settings) {
        // Find the channel in favorite channels
        const channelIndex = this.favoriteChannels.findIndex(ch => ch.id === channelId);
        
        if (channelIndex === -1) {
            console.log(`Channel with ID ${channelId} not found`);
            return false;
        }

        // Update the channel settings
        this.favoriteChannels[channelIndex] = {
            ...this.favoriteChannels[channelIndex],
            settings: {
                ...this.favoriteChannels[channelIndex].settings,
                ...settings
            }
        };

        // Save the updated channels
        this.saveFavoriteChannels();
        
        console.log(`Updated settings for channel: ${this.favoriteChannels[channelIndex].name}`);
        return true;
    }
}

// Initialize the video monitor
const videoMonitor = new YouTubeChannelVideoMonitor();

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

    // Add favorite channel
    if (pathname === '/api/favorites/add' && req.method === 'POST') {
        try {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });

            req.on('end', async () => {
                try {
                    const { channelUrl } = JSON.parse(body);

                    if (!channelUrl) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Channel URL is required' }));
                        return;
                    }

                    // First extract channel info
                    const channelExtractor = new YouTubeChannelExtractor();
                    const channelInfo = await channelExtractor.extractChannelInfo(channelUrl);

                    if (channelInfo.name === 'Unknown Channel') {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Could not extract channel information' }));
                        return;
                    }

                    // Add to favorites
                    videoMonitor.addFavoriteChannel(channelInfo);

                    // Start monitoring if not already started
                    if (!videoMonitor.monitorInterval) {
                        videoMonitor.startMonitoring();
                    }

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        message: 'Channel added to favorites',
                        channelInfo: channelInfo
                    }));

                } catch (parseError) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid JSON: ' + parseError.message }));
                }
            });
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
        return;
    }

    // Remove favorite channel
    if (pathname === '/api/favorites/remove' && req.method === 'POST') {
        try {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });

            req.on('end', () => {
                try {
                    const { channelId } = JSON.parse(body);

                    if (!channelId) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Channel ID is required' }));
                        return;
                    }

                    videoMonitor.removeFavoriteChannel(channelId);

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        message: 'Channel removed from favorites'
                    }));

                } catch (parseError) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid JSON: ' + parseError.message }));
                }
            });
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
        return;
    }

    // Get favorite channels
    if (pathname === '/api/favorites') {
        try {
            const favorites = videoMonitor.getFavoriteChannels();
            const recentVideos = videoMonitor.getRecentVideos();

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                favorites: favorites,
                recentVideos: recentVideos
            }));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
        return;
    }

    // Manual check for new videos
    if (pathname === '/api/videos/check' && req.method === 'POST') {
        try {
            const newVideosCount = await videoMonitor.checkForNewVideos();

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                message: `Check complete. Found ${newVideosCount} new videos.`,
                newVideosCount: newVideosCount
            }));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
        return;
    }

    // Get monitoring settings
    if (pathname === '/api/monitor/settings') {
        try {
            const settings = videoMonitor.getSettings();

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                settings: settings
            }));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
        return;
    }

    // Update monitoring settings
    if (pathname === '/api/monitor/settings' && req.method === 'POST') {
        try {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });

            req.on('end', () => {
                try {
                    const newSettings = JSON.parse(body);
                    videoMonitor.updateSettings(newSettings);

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        message: 'Settings updated successfully',
                        settings: videoMonitor.getSettings()
                    }));

                } catch (parseError) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid JSON: ' + parseError.message }));
                }
            });
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
        return;
    }

    // Start monitoring
    if (pathname === '/api/monitor/start' && req.method === 'POST') {
        try {
            videoMonitor.startMonitoring();

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                message: 'Video monitoring started'
            }));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
        return;
    }

    // Stop monitoring
    if (pathname === '/api/monitor/stop' && req.method === 'POST') {
        try {
            videoMonitor.stopMonitoring();

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                message: 'Video monitoring stopped'
            }));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
        return;
    }

    // Update channel settings
    if (pathname === '/api/channel/settings' && req.method === 'POST') {
        try {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });

            req.on('end', () => {
                try {
                    const { channelId, settings } = JSON.parse(body);

                    if (!channelId) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ 
                            success: false, 
                            error: 'Channel ID is required' 
                        }));
                        return;
                    }

                    // Update channel settings in the video monitor
                    const success = videoMonitor.updateChannelSettings(channelId, settings);

                    if (success) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: true,
                            message: 'Channel settings updated successfully'
                        }));
                    } else {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            success: false,
                            error: 'Channel not found'
                        }));
                    }
                } catch (parseError) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ 
                        success: false, 
                        error: 'Invalid JSON data' 
                    }));
                }
            });
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                success: false, 
                error: error.message 
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

    // Start video monitoring if there are favorite channels
    if (videoMonitor.getFavoriteChannels().length > 0) {
        console.log('Starting video monitoring for favorite channels...');
        videoMonitor.startMonitoring();
    }
});