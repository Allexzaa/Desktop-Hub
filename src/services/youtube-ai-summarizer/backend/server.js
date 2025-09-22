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

// Ollama AI Summary Function
async function generateOllamaSummary(transcript, model = 'gemma2:9b', options = {}) {
    try {
        console.log(`Generating summary with Ollama model: ${model}`);
        console.log('Summary options:', options);

        // Extract options with defaults
        const {
            outputFormat = 'markdown',
            bulletStyle = '•',
            includeTimestamps = true,
            includeQuotes = true,
            maxTokens = 1200,
            temperature = 0.4
        } = options;

        // Build dynamic prompt based on user preferences
        let prompt = '';

        if (outputFormat === 'markdown') {
            prompt = buildMarkdownPrompt(bulletStyle, includeTimestamps, includeQuotes);
        } else {
            prompt = buildPlainTextPrompt(bulletStyle, includeTimestamps, includeQuotes);
        }

        prompt += `\n\nTranscript to summarize:\n${transcript}\n\nSummary:`;

        console.log(`Using ${outputFormat} format with ${bulletStyle} bullets, timestamps: ${includeTimestamps}, quotes: ${includeQuotes}`);

        const response = await fetch(`${OLLAMA_URL}/api/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: model,
                prompt: prompt,
                stream: false,
                options: {
                    num_ctx: 16384,
                    temperature: temperature,
                    top_p: 0.8,
                    num_predict: maxTokens,
                    repeat_penalty: 1.1
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.status}`);
        }

        const data = await response.json();
        console.log('Ollama summary generated successfully');

        return data.response || 'Summary generation failed';
    } catch (error) {
        console.error('Ollama summary error:', error.message);
        throw new Error(`Failed to generate summary: ${error.message}`);
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

// YouTube transcript extractor for server-side processing
class ServerYouTubeTranscriptExtractor {
    constructor() {
        this.https = require('https');
    }

    async fetchYouTubePage(videoId) {
        return new Promise((resolve, reject) => {
            const url = `https://www.youtube.com/watch?v=${videoId}`;

            this.https.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            }, (res) => {
                let data = '';

                res.on('data', chunk => {
                    data += chunk;
                });

                res.on('end', () => {
                    resolve(data);
                });
            }).on('error', (err) => {
                reject(err);
            });
        });
    }

    async extractTranscript(videoId) {
        console.log(`Starting transcript extraction for video: ${videoId}`);

        // Method 1: Try youtube-transcript package
        if (YoutubeTranscript) {
            console.log('Trying youtube-transcript package...');
            const result = await this.tryYoutubeTranscriptPackage(videoId);
            if (result && result.transcript) {
                return result;
            }
        }

        // Method 2: Try YouTube internal API approach  
        console.log('Trying YouTube internal API approach...');
        const apiResult = await this.tryYouTubeInternalAPI(videoId);
        if (apiResult && apiResult.transcript) {
            return apiResult;
        }

        // Method 3: Try alternative caption extraction
        if (fetch && cheerio) {
            console.log('Trying alternative caption extraction...');
            const result = await this.tryAlternativeCaptionExtraction(videoId);
            if (result && result.transcript) {
                return result;
            }
        }

        // Method 4: Try direct YouTube page parsing
        console.log('Trying direct YouTube page parsing...');
        const result = await this.tryDirectPageParsing(videoId);
        if (result && result.transcript) {
            return result;
        }

        // Method 4: Generate transcript from video title/description for demo purposes
        console.log('All methods failed, generating sample transcript based on video info...');
        return await this.generateSampleTranscript(videoId);
    }

    async tryYoutubeTranscriptPackage(videoId) {
        try {
            console.log('Attempting YouTube Transcript package extraction...');

            // Add delay between attempts to avoid rate limiting
            const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

            // Try multiple approaches with the transcript package
            const approaches = [
                { func: () => YoutubeTranscript.fetchTranscript(videoId), desc: 'default' },
                { func: () => YoutubeTranscript.fetchTranscript(videoId, { lang: 'en' }), desc: 'English' },
                { func: () => YoutubeTranscript.fetchTranscript(videoId, { lang: 'en', country: 'EN' }), desc: 'English-EN' },
                { func: () => YoutubeTranscript.fetchTranscript(videoId, { lang: 'en', country: 'US' }), desc: 'English-US' },
                { func: () => YoutubeTranscript.fetchTranscript(videoId, { lang: 'auto' }), desc: 'auto-detect' },
                { func: () => YoutubeTranscript.fetchTranscript(`https://www.youtube.com/watch?v=${videoId}`), desc: 'full URL' }
            ];

            for (let i = 0; i < approaches.length; i++) {
                try {
                    console.log(`Trying approach ${i + 1} (${approaches[i].desc})...`);
                    const transcriptArray = await approaches[i].func();

                    if (transcriptArray && Array.isArray(transcriptArray) && transcriptArray.length > 0) {
                        const transcript = transcriptArray.map(item => item.text || item).join(' ').trim();
                        if (transcript && transcript.length > 10) {
                            console.log(`SUCCESS! YouTube Transcript package worked with approach ${i + 1}: ${transcript.length} characters`);

                            return {
                                transcript: transcript,
                                language: transcriptArray[0]?.lang || 'en',
                                isAutoGenerated: transcriptArray[0]?.duration !== undefined
                            };
                        }
                    }
                } catch (approachError) {
                    console.log(`Approach ${i + 1} (${approaches[i].desc}) failed: ${approachError.message}`);
                    // Add delay before next attempt
                    await delay(1000);
                }
            }

        } catch (error) {
            console.log('All YouTube Transcript package approaches failed:', error.message);
        }
        return null;
    }

    async tryYouTubeInternalAPI(videoId) {
        try {
            console.log('Attempting YouTube Internal API approach...');

            // Try to get video info from YouTube's internal API
            const infoUrl = `https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8`;

            const requestBody = {
                context: {
                    client: {
                        clientName: "WEB",
                        clientVersion: "2.20231219.04.00"
                    }
                },
                videoId: videoId
            };

            const response = await fetch(infoUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'X-YouTube-Client-Name': '1',
                    'X-YouTube-Client-Version': '2.20231219.04.00',
                    'Origin': 'https://www.youtube.com',
                    'Referer': `https://www.youtube.com/watch?v=${videoId}`
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error(`API HTTP ${response.status}`);
            }

            const data = await response.json();
            console.log('Got YouTube API response');

            // Extract caption tracks from API response
            const captionTracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

            if (captionTracks && captionTracks.length > 0) {
                console.log(`Found ${captionTracks.length} caption tracks via API`);

                // Prefer English manual captions, then auto-generated
                const track = captionTracks.find(t => t.languageCode === 'en' && t.kind !== 'asr') ||
                    captionTracks.find(t => t.languageCode === 'en') ||
                    captionTracks[0];

                const transcript = await this.fetchCaptionContent(track.baseUrl);
                if (transcript && transcript.length > 10) {
                    console.log(`YouTube Internal API success: ${transcript.length} characters`);
                    return {
                        transcript: transcript,
                        language: track.languageCode || 'en',
                        isAutoGenerated: track.kind === 'asr'
                    };
                }
            } else {
                console.log('No caption tracks found in API response');
            }

        } catch (error) {
            console.log('YouTube Internal API failed:', error.message);
        }
        return null;
    }

    async tryAlternativeCaptionExtraction(videoId) {
        try {
            console.log('Attempting alternative caption extraction method...');

            // Try to fetch captions via alternative method with better headers
            const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
            const response = await fetch(videoUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                    'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                    'Sec-Ch-Ua-Mobile': '?0',
                    'Sec-Ch-Ua-Platform': '"Windows"',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'none',
                    'Sec-Fetch-User': '?1',
                    'Upgrade-Insecure-Requests': '1'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const html = await response.text();
            console.log(`Got page HTML: ${html.length} characters`);

            // Multiple extraction approaches
            const extractionMethods = [
                this.extractFromYtInitialPlayerResponse.bind(this),
                this.extractFromCaptionTracks.bind(this),
                this.extractFromPlayerConfig.bind(this)
            ];

            for (let i = 0; i < extractionMethods.length; i++) {
                try {
                    console.log(`Trying extraction method ${i + 1}...`);
                    const result = await extractionMethods[i](html, videoId);
                    if (result && result.transcript && result.transcript.length > 10) {
                        console.log(`Alternative extraction method ${i + 1} success: ${result.transcript.length} characters`);
                        return result;
                    }
                } catch (methodError) {
                    console.log(`Extraction method ${i + 1} failed: ${methodError.message}`);
                }
            }

        } catch (error) {
            console.log('Alternative caption extraction failed:', error.message);
        }
        return null;
    }

    async extractFromYtInitialPlayerResponse(html, videoId) {
        const match = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
        if (match) {
            const playerResponse = JSON.parse(match[1]);
            const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

            if (captionTracks && captionTracks.length > 0) {
                // Prefer English manual captions, then auto-generated
                const track = captionTracks.find(t => t.languageCode === 'en' && t.kind !== 'asr') ||
                    captionTracks.find(t => t.languageCode === 'en') ||
                    captionTracks[0];

                const transcript = await this.fetchCaptionContent(track.baseUrl);
                if (transcript) {
                    return {
                        transcript: transcript,
                        language: track.languageCode || 'en',
                        isAutoGenerated: track.kind === 'asr'
                    };
                }
            }
        }
        throw new Error('No ytInitialPlayerResponse captions found');
    }

    async extractFromCaptionTracks(html, videoId) {
        const $ = cheerio.load(html);
        const scriptTags = $('script').toArray();

        for (const script of scriptTags) {
            const content = $(script).html();
            if (content && content.includes('captionTracks')) {
                const matches = content.match(/"captionTracks":\s*(\[.+?\])/g);
                if (matches) {
                    for (const match of matches) {
                        try {
                            const tracksJson = match.replace('"captionTracks":', '');
                            const tracks = JSON.parse(tracksJson);

                            if (tracks.length > 0) {
                                const track = tracks.find(t => t.languageCode === 'en') || tracks[0];
                                const transcript = await this.fetchCaptionContent(track.baseUrl);
                                if (transcript) {
                                    return {
                                        transcript: transcript,
                                        language: track.languageCode || 'en',
                                        isAutoGenerated: track.kind === 'asr'
                                    };
                                }
                            }
                        } catch (parseError) {
                            continue;
                        }
                    }
                }
            }
        }
        throw new Error('No captionTracks found in script tags');
    }

    async extractFromPlayerConfig(html, videoId) {
        // Look for player config or other caption references
        const configMatches = [
            /playerConfig\s*=\s*({.+?});/,
            /"captions":\s*({.+?})/,
            /"playerCaptionsTracklistRenderer":\s*({.+?})/
        ];

        for (const regex of configMatches) {
            const match = html.match(regex);
            if (match) {
                try {
                    const config = JSON.parse(match[1]);
                    // Process config to extract captions
                    const tracks = this.extractTracksFromConfig(config);
                    if (tracks && tracks.length > 0) {
                        const track = tracks.find(t => t.languageCode === 'en') || tracks[0];
                        const transcript = await this.fetchCaptionContent(track.baseUrl);
                        if (transcript) {
                            return {
                                transcript: transcript,
                                language: track.languageCode || 'en',
                                isAutoGenerated: track.kind === 'asr'
                            };
                        }
                    }
                } catch (parseError) {
                    continue;
                }
            }
        }
        throw new Error('No player config captions found');
    }

    extractTracksFromConfig(config) {
        // Recursively search for caption tracks in config object
        const findTracks = (obj) => {
            if (typeof obj !== 'object' || obj === null) return null;

            if (Array.isArray(obj)) {
                for (const item of obj) {
                    const result = findTracks(item);
                    if (result) return result;
                }
                return null;
            }

            if (obj.captionTracks) return obj.captionTracks;
            if (obj.baseUrl && obj.languageCode) return [obj];

            for (const key in obj) {
                const result = findTracks(obj[key]);
                if (result) return result;
            }

            return null;
        };

        return findTracks(config);
    }

    async fetchCaptionContent(captionUrl) {
        try {
            console.log(`Fetching caption content from: ${captionUrl}`);

            // Ensure we use the correct format
            let url = captionUrl;
            if (!url.includes('fmt=')) {
                url += '&fmt=srv3';
            }

            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/ttml+xml,text/vtt,*/*'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const contentType = response.headers.get('content-type') || '';
            const xmlText = await response.text();
            console.log(`Got caption data: ${xmlText.length} characters, type: ${contentType}`);

            // Try different parsing methods based on content type
            let transcript = '';

            if (contentType.includes('xml') || xmlText.includes('<text') || xmlText.includes('<p')) {
                // XML/TTML format
                transcript = this.parseXMLCaptions(xmlText);
            } else if (contentType.includes('vtt') || xmlText.includes('WEBVTT')) {
                // VTT format
                transcript = this.parseVTTCaptions(xmlText);
            } else {
                // Try both parsers
                transcript = this.parseXMLCaptions(xmlText) || this.parseVTTCaptions(xmlText);
            }

            if (!transcript) {
                // Fallback: simple text extraction
                transcript = this.extractTextFromAny(xmlText);
            }

            return transcript.trim();
        } catch (error) {
            console.log('Failed to fetch caption content:', error.message);
            return null;
        }
    }

    parseXMLCaptions(xmlText) {
        try {
            const $ = cheerio.load(xmlText, { xmlMode: true });

            let transcript = '';

            // Try different XML caption formats
            const selectors = ['text', 'p', 'span[begin]', 'div'];

            for (const selector of selectors) {
                $(selector).each((i, elem) => {
                    const text = $(elem).text().trim();
                    if (text && !transcript.includes(text)) {
                        transcript += text + ' ';
                    }
                });

                if (transcript.length > 10) break;
            }

            return transcript.trim();
        } catch (error) {
            console.log('XML parsing failed:', error.message);
            return '';
        }
    }

    parseVTTCaptions(vttText) {
        try {
            // Parse WebVTT format
            const lines = vttText.split('\n');
            let transcript = '';

            for (const line of lines) {
                const trimmed = line.trim();
                // Skip timestamps and empty lines
                if (trimmed &&
                    !trimmed.includes('-->') &&
                    !trimmed.startsWith('WEBVTT') &&
                    !trimmed.startsWith('NOTE') &&
                    !/^\d+$/.test(trimmed)) {
                    transcript += trimmed + ' ';
                }
            }

            return transcript.trim();
        } catch (error) {
            console.log('VTT parsing failed:', error.message);
            return '';
        }
    }

    extractTextFromAny(content) {
        try {
            // Remove HTML/XML tags and extract text
            let text = content.replace(/<[^>]*>/g, ' ');
            // Remove timestamps
            text = text.replace(/\d+:\d+:\d+[.,]\d+\s*-->\s*\d+:\d+:\d+[.,]\d+/g, '');
            // Remove WebVTT headers
            text = text.replace(/WEBVTT[^\n]*/g, '');
            // Clean up whitespace
            text = text.replace(/\s+/g, ' ').trim();

            return text;
        } catch (error) {
            console.log('Text extraction failed:', error.message);
            return '';
        }
    }

    async tryDirectPageParsing(videoId) {
        try {
            const html = await this.fetchYouTubePage(videoId);
            const captionTracks = this.extractCaptionTracks(html);

            if (captionTracks.length > 0) {
                const bestTrack = this.selectBestCaptionTrack(captionTracks);
                const transcript = await this.fetchCaptionXML(bestTrack.url);

                if (transcript && transcript.trim()) {
                    console.log(`Direct parsing success: ${transcript.length} characters`);
                    return {
                        transcript: transcript,
                        language: bestTrack.languageCode,
                        isAutoGenerated: bestTrack.kind === 'asr'
                    };
                }
            }
        } catch (error) {
            console.log('Direct page parsing failed:', error.message);
        }
        return null;
    }

    async generateSampleTranscript(videoId) {
        try {
            console.log('Real transcript extraction failed - providing transparent message to user');
            const videoInfo = await this.getVideoInfo(videoId);
            const title = videoInfo.title;

            // Be completely honest about what happened
            let honestMessage = `⚠️ TRANSCRIPT EXTRACTION NOTICE:\n\n`;
            honestMessage += `Unfortunately, we could not extract the actual transcript from this YouTube video (${title}). `;
            honestMessage += `This happens because:\n\n`;
            honestMessage += `• YouTube actively blocks automated transcript extraction\n`;
            honestMessage += `• The video may not have captions enabled\n`;
            honestMessage += `• The video may have restricted access to its transcripts\n`;
            honestMessage += `• Some videos only have auto-generated captions that are hard to access\n\n`;
            honestMessage += `RECOMMENDATION: To get a real transcript, try:\n`;
            honestMessage += `1. Use YouTube's built-in transcript feature (click "..." → "Show transcript")\n`;
            honestMessage += `2. Try a different video that you know has captions\n`;
            honestMessage += `3. Use our demo modes ("demo", "speech", "tech-talk") to see how the AI summarization works\n\n`;
            honestMessage += `This application works best with videos that have openly accessible captions.`;

            console.log(`Generated honest message about transcript extraction failure`);

            return {
                transcript: honestMessage,
                language: 'en',
                isAutoGenerated: false
            };
        } catch (error) {
            console.log('Failed to generate even the fallback message:', error.message);
            return {
                transcript: '❌ Unable to extract transcript from this video. YouTube restricts automated access to video transcripts. Please try the demo modes instead.',
                language: 'en',
                isAutoGenerated: false
            };
        }
    }

    extractCaptionTracks(html) {
        try {
            const playerResponseMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
            if (!playerResponseMatch) {
                throw new Error('Could not find player response');
            }

            const playerResponse = JSON.parse(playerResponseMatch[1]);
            const captionTracks = playerResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];

            return captionTracks.map(track => ({
                url: track.baseUrl,
                languageCode: track.languageCode,
                name: track.name?.simpleText || track.languageCode,
                kind: track.kind
            }));
        } catch (error) {
            console.error('Error parsing caption tracks:', error);
            return [];
        }
    }

    selectBestCaptionTrack(tracks) {
        const englishManual = tracks.find(t => t.languageCode === 'en' && t.kind !== 'asr');
        if (englishManual) return englishManual;

        const englishAuto = tracks.find(t => t.languageCode === 'en' && t.kind === 'asr');
        if (englishAuto) return englishAuto;

        const anyManual = tracks.find(t => t.kind !== 'asr');
        if (anyManual) return anyManual;

        return tracks[0];
    }

    async fetchCaptionXML(url) {
        return new Promise((resolve, reject) => {
            const xmlUrl = url.includes('fmt=') ? url : `${url}&fmt=srv3`;

            this.https.get(xmlUrl, (res) => {
                let data = '';

                res.on('data', chunk => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        const transcript = this.parseTranscriptXML(data);
                        resolve(transcript);
                    } catch (error) {
                        reject(error);
                    }
                });
            }).on('error', (err) => {
                reject(err);
            });
        });
    }

    parseTranscriptXML(xmlText) {
        const textRegex = /<text[^>]*>([^<]*)<\/text>/g;
        let transcript = '';
        let match;

        while ((match = textRegex.exec(xmlText)) !== null) {
            const text = match[1];
            if (text.trim()) {
                const decodedText = this.decodeHtmlEntities(text);
                transcript += decodedText + ' ';
            }
        }

        return transcript.trim();
    }

    decodeHtmlEntities(text) {
        const entities = {
            '&amp;': '&',
            '&lt;': '<',
            '&gt;': '>',
            '&quot;': '"',
            '&#39;': "'",
            '&#x27;': "'",
            '&#x2F;': '/',
            '&#x60;': '`',
            '&#x3D;': '='
        };

        return text.replace(/&[#\w]+;/g, (entity) => entities[entity] || entity);
    }

    async getVideoInfo(videoId) {
        try {
            const html = await this.fetchYouTubePage(videoId);

            const titleMatch = html.match(/<title>([^<]+)<\/title>/);
            const title = titleMatch ? titleMatch[1].replace(' - YouTube', '') : 'Unknown Title';

            // Extract channel name from various possible locations
            let channelName = 'Unknown Channel';
            console.log('Attempting to extract channel name...');

            const channelPatterns = [
                // JSON-LD structured data
                /"name":"([^"]+)"[^}]*"@type":"Person"/,
                /"name":"([^"]+)"[^}]*"@type":"Organization"/,

                // YouTube API data
                /"ownerChannelName":"([^"]+)"/,
                /"channelName":"([^"]+)"/,
                /"author":"([^"]+)"/,
                /"uploader":"([^"]+)"/,

                // Meta tags and structured data
                /<meta name="author" content="([^"]+)">/,
                /<meta property="og:video:tag" content="([^"]+)">/,
                /<link itemprop="url" href="[^"]*\/channel\/[^"]*"[^>]*><meta itemprop="name" content="([^"]*)">/,
                /itemprop="name"[^>]*content="([^"]+)"/,
                /content="([^"]+)"[^>]*itemprop="name"/,

                // YouTube player data
                /"videoOwnerRenderer":\{"thumbnail"[^}]*"text":"([^"]+)"/,
                /"ownerText":\{"runs":\[\{"text":"([^"]+)"/,
                /"shortBylineText":\{"runs":\[\{"text":"([^"]+)"/,
                /"longBylineText":\{"runs":\[\{"text":"([^"]+)"/,

                // Channel link patterns
                /<a[^>]*href="[^"]*\/channel\/[^"]*"[^>]*>([^<]+)<\/a>/,
                /<a[^>]*href="[^"]*\/@[^"]*"[^>]*>([^<]+)<\/a>/,

                // Title extraction (fallback)
                /<title>([^-]+) - YouTube<\/title>/
            ];

            for (let i = 0; i < channelPatterns.length; i++) {
                const pattern = channelPatterns[i];
                const match = html.match(pattern);
                if (match && match[1] && match[1].trim()) {
                    const extractedName = match[1].trim();
                    // Filter out common false positives
                    if (extractedName !== title &&
                        extractedName !== 'YouTube' &&
                        extractedName.length > 1 &&
                        !extractedName.includes('http') &&
                        !extractedName.includes('www.')) {
                        channelName = extractedName;
                        console.log(`Channel name found using pattern ${i + 1}: "${channelName}"`);
                        break;
                    }
                }
            }

            if (channelName === 'Unknown Channel') {
                console.log('No channel name found with regex patterns, trying JSON extraction...');

                // Try to extract from YouTube's JSON data
                const jsonMatches = html.match(/var ytInitialData = ({.*?});/);
                if (jsonMatches) {
                    try {
                        const ytData = JSON.parse(jsonMatches[1]);
                        const channelFromJson = this.extractChannelFromYtData(ytData);
                        if (channelFromJson) {
                            channelName = channelFromJson;
                            console.log(`Channel name found in JSON data: "${channelName}"`);
                        }
                    } catch (jsonError) {
                        console.log('Failed to parse YouTube JSON data:', jsonError.message);
                    }
                }

                // Try ytInitialPlayerResponse as well
                if (channelName === 'Unknown Channel') {
                    const playerMatches = html.match(/var ytInitialPlayerResponse = ({.*?});/);
                    if (playerMatches) {
                        try {
                            const playerData = JSON.parse(playerMatches[1]);
                            const channelFromPlayer = this.extractChannelFromPlayerData(playerData);
                            if (channelFromPlayer) {
                                channelName = channelFromPlayer;
                                console.log(`Channel name found in player data: "${channelName}"`);
                            }
                        } catch (playerError) {
                            console.log('Failed to parse YouTube player data:', playerError.message);
                        }
                    }
                }

                // Last resort: try to extract from title
                if (channelName === 'Unknown Channel') {
                    const titleParts = title.split(' - ');
                    if (titleParts.length > 1) {
                        channelName = titleParts[titleParts.length - 1];
                        console.log(`Using title-based channel name: "${channelName}"`);
                    }
                }
            }

            const viewsMatch = html.match(/"viewCount":"(\d+)"/);
            const views = viewsMatch ? parseInt(viewsMatch[1]).toLocaleString() + ' views' : 'Unknown views';

            const durationMatch = html.match(/"lengthSeconds":"(\d+)"/);
            let duration = 'Unknown';
            if (durationMatch) {
                const seconds = parseInt(durationMatch[1]);
                const minutes = Math.floor(seconds / 60);
                const remainingSeconds = seconds % 60;
                duration = `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
            }

            // Debug: Save a sample of HTML for analysis if channel name is still unknown
            if (channelName === 'Unknown Channel') {
                console.log('=== DEBUG: Channel name extraction failed ===');
                console.log('HTML sample (first 2000 chars):');
                console.log(html.substring(0, 2000));
                console.log('=== END DEBUG ===');
            }

            console.log(`Extracted video info: Title="${title}", Channel="${channelName}", Views="${views}", Duration="${duration}"`);

            return {
                title,
                channelName,
                views,
                duration,
                uploadDate: 'Recently uploaded' // Would need additional parsing
            };
        } catch (error) {
            console.error('Error extracting video info:', error);
            return {
                title: 'Unknown Title',
                channelName: 'Unknown Channel',
                views: 'Unknown views',
                duration: 'Unknown',
                uploadDate: 'Unknown'
            };
        }
    }

    extractChannelFromYtData(ytData) {
        try {
            // Navigate through YouTube's data structure to find channel name
            const contents = ytData?.contents?.twoColumnWatchNextResults?.results?.results?.contents;
            if (contents) {
                for (const content of contents) {
                    if (content.videoPrimaryInfoRenderer) {
                        const owner = content.videoPrimaryInfoRenderer?.videoActions?.menuRenderer?.topLevelButtons;
                        // This is a complex structure, let's try a different approach
                    }
                    if (content.videoSecondaryInfoRenderer) {
                        const owner = content.videoSecondaryInfoRenderer?.owner?.videoOwnerRenderer;
                        if (owner?.title?.runs?.[0]?.text) {
                            return owner.title.runs[0].text;
                        }
                        if (owner?.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl) {
                            // Extract from URL like /@channelname
                            const urlMatch = owner.navigationEndpoint.browseEndpoint.canonicalBaseUrl.match(/@(.+)/);
                            if (urlMatch) {
                                return urlMatch[1];
                            }
                        }
                    }
                }
            }
            return null;
        } catch (error) {
            console.log('Error extracting channel from ytData:', error.message);
            return null;
        }
    }

    extractChannelFromPlayerData(playerData) {
        try {
            // Try to extract from player response
            const videoDetails = playerData?.videoDetails;
            if (videoDetails?.author) {
                return videoDetails.author;
            }
            if (videoDetails?.channelId) {
                // We have channel ID but not name, could be used as fallback
                return `Channel ${videoDetails.channelId.substring(0, 8)}...`;
            }
            return null;
        } catch (error) {
            console.log('Error extracting channel from player data:', error.message);
            return null;
        }
    }
}

const server = http.createServer(async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = parsedUrl.pathname;

    // API endpoints for YouTube transcript extraction
    if (pathname.startsWith('/api/')) {
        if (pathname === '/api/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() }));
            return;
        }

        if (pathname === '/api/transcript') {
            try {
                const videoId = parsedUrl.searchParams.get('videoId');
                if (!videoId) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Video ID is required' }));
                    return;
                }

                const extractor = new ServerYouTubeTranscriptExtractor();
                const transcriptData = await extractor.extractTranscript(videoId);
                const videoInfo = await extractor.getVideoInfo(videoId);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    transcript: transcriptData,
                    videoInfo: videoInfo
                }));
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
            return;
        }

        if (pathname === '/api/summarize') {
            try {
                let body = '';
                req.on('data', chunk => {
                    body += chunk.toString();
                });

                req.on('end', async () => {
                    try {
                        const { transcript, model = 'gemma2:9b', options = {} } = JSON.parse(body);

                        if (!transcript) {
                            res.writeHead(400, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: 'Transcript is required' }));
                            return;
                        }

                        console.log('Received summarize request:', { model, options });

                        let summary;
                        if (options.useExternalAPI && options.externalAPIConfig) {
                            summary = await generateExternalAPISummary(transcript, options.externalAPIConfig, options);
                        } else {
                            summary = await generateOllamaSummary(transcript, model, options);
                        }

                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ summary }));
                    } catch (parseError) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Invalid JSON or processing error: ' + parseError.message }));
                    }
                });
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
            return;
        }

        if (pathname === '/api/service/start') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                message: 'Service is already running',
                status: 'running'
            }));
            return;
        }

        if (pathname === '/api/service/stop') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                message: 'Cannot stop service from API call for security reasons. Please stop manually.',
                status: 'running'
            }));
            return;
        }
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

// Helper function to build markdown prompt
function buildMarkdownPrompt(bulletStyle, includeTimestamps, includeQuotes) {
    const bullet = bulletStyle;
    const timestampNote = includeTimestamps ? '\n- Include relevant timestamps where important (format: [MM:SS])' : '';
    const quotesNote = includeQuotes ? '\n- Include key quotes from the video when they add value' : '';

    return `Please provide a comprehensive and well-structured summary of the following YouTube video transcript using this specific Markdown format:

## 🔍 Video Summary  

### 1️⃣ What This Video Covers  
Brief hook about the main topic and why it matters.

---

### 2️⃣ Key Insights  
${bullet} [Key insight 1]  
${bullet} [Key insight 2]  
${bullet} [Key insight 3]  
${bullet} [Key insight 4]  

---

### 3️⃣ Deep Dive Highlights  
💡 Notable demos, examples, or case studies:  
${bullet} [Important highlight 1]  
${bullet} [Important highlight 2]  

---

### 4️⃣ Why It Matters  
🌍 Real-world impact and applications explained.

---

### 5️⃣ Actionable Takeaways  
✅ What you can do next:  
${bullet} [Actionable item 1]  
${bullet} [Actionable item 2]  
${bullet} [Actionable item 3]  

---

### 6️⃣ Closing Thoughts  
⚡ Wrap-up statement linking back to the value.

FORMATTING REQUIREMENTS:
- Use the specified bullet style: "${bullet}"
- Use Markdown formatting with headers (##, ###) and emphasis
- Make the summary engaging, informative, and valuable for viewers${timestampNote}${quotesNote}
- Focus on extracting maximum value from the content`;
}

// Helper function to build plain text prompt
function buildPlainTextPrompt(bulletStyle, includeTimestamps, includeQuotes) {
    const bullet = bulletStyle;
    const timestampNote = includeTimestamps ? '\n- Include relevant timestamps where important (format: [MM:SS])' : '';
    const quotesNote = includeQuotes ? '\n- Include key quotes from the video when they add value' : '';

    return `Please provide a comprehensive and well-structured summary of the following YouTube video transcript using this plain text format:

VIDEO SUMMARY

WHAT THIS VIDEO COVERS
Brief hook about the main topic and why it matters.

KEY INSIGHTS
${bullet} [Key insight 1]
${bullet} [Key insight 2]
${bullet} [Key insight 3]
${bullet} [Key insight 4]

DEEP DIVE HIGHLIGHTS
Notable demos, examples, or case studies:
${bullet} [Important highlight 1]
${bullet} [Important highlight 2]

WHY IT MATTERS
Real-world impact and applications explained.

ACTIONABLE TAKEAWAYS
What you can do next:
${bullet} [Actionable item 1]
${bullet} [Actionable item 2]
${bullet} [Actionable item 3]

CLOSING THOUGHTS
Wrap-up statement linking back to the value.

FORMATTING REQUIREMENTS:
- Use the specified bullet style: "${bullet}"
- Use plain text formatting with clear section headers
- Make the summary engaging, informative, and valuable for viewers${timestampNote}${quotesNote}
- Focus on extracting maximum value from the content`;
}

// External API Summary Function
async function generateExternalAPISummary(transcript, apiConfig, options = {}) {
    try {
        const provider = apiConfig.provider;
        const config = apiConfig[provider];

        console.log(`Generating summary with external API: ${provider}`);

        if (!config.apiKey) {
            throw new Error(`API key is required for ${provider}`);
        }

        if (!config.baseUrl) {
            throw new Error(`Base URL is required for ${provider}`);
        }

        // Extract options with defaults
        const {
            outputFormat = 'markdown',
            bulletStyle = '•',
            includeTimestamps = true,
            includeQuotes = true,
            maxTokens = 1200,
            temperature = 0.4
        } = options;

        // Build prompt based on provider
        let prompt;
        if (outputFormat === 'markdown') {
            prompt = buildMarkdownPrompt(bulletStyle, includeTimestamps, includeQuotes);
        } else {
            prompt = buildPlainTextPrompt(bulletStyle, includeTimestamps, includeQuotes);
        }

        prompt += `\n\nTranscript to summarize:\n${transcript}\n\nSummary:`;

        let summary;

        if (provider === 'openai') {
            summary = await callOpenAIAPI(config, prompt, maxTokens, temperature);
        } else if (provider === 'anthropic') {
            summary = await callAnthropicAPI(config, prompt, maxTokens, temperature);
        } else if (provider === 'custom') {
            summary = await callCustomAPI(config, prompt, maxTokens, temperature);
        } else {
            throw new Error(`Unsupported provider: ${provider}`);
        }

        console.log(`External API summary generated successfully with ${provider}`);
        return summary;

    } catch (error) {
        console.error('External API summary error:', error.message);
        throw new Error(`Failed to generate summary with external API: ${error.message}`);
    }
}

// OpenAI API call
async function callOpenAIAPI(config, prompt, maxTokens, temperature) {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
            model: config.model,
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: maxTokens,
            temperature: temperature
        })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'No summary generated';
}

// Anthropic API call
async function callAnthropicAPI(config, prompt, maxTokens, temperature) {
    const response = await fetch(`${config.baseUrl}/messages`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': config.apiKey,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: config.model,
            max_tokens: maxTokens,
            temperature: temperature,
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ]
        })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Anthropic API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return data.content[0]?.text || 'No summary generated';
}

// Custom API call
async function callCustomAPI(config, prompt, maxTokens, temperature) {
    const headers = {
        'Content-Type': 'application/json',
        ...config.headers
    };

    if (config.apiKey) {
        headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
            model: config.model,
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: maxTokens,
            temperature: temperature
        })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Custom API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || data.content?.[0]?.text || 'No summary generated';
}