import React, { useState, useEffect, useRef } from 'react';
import YouTubeAIApiClient from '../ApiClient';
import '../styles/YoutubeAISumTab.css';

const YoutubeAISumTab = () => {
    const [currentUrl, setCurrentUrl] = useState('');
    const [currentTranscript, setCurrentTranscript] = useState('');
    const [currentVideoInfo, setCurrentVideoInfo] = useState(null);
    const [aiSummary, setAiSummary] = useState('');
    const [activeTab, setActiveTab] = useState('ai-summary');
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState({ message: '', type: 'info', visible: false });
    const [progress, setProgress] = useState(0);
    const [taskHistory, setTaskHistory] = useState([]);
    const [currentTheme, setCurrentTheme] = useState('light');
    const [isServiceConnected, setIsServiceConnected] = useState(false);
    const [isSidebarVisible, setIsSidebarVisible] = useState(true);
    const [isSettingsVisible, setIsSettingsVisible] = useState(false);
    const [isServerRunning, setIsServerRunning] = useState(false);
    const [settingsStatus, setSettingsStatus] = useState({ message: '', type: 'info', visible: false });
    const [historyPreview, setHistoryPreview] = useState({ visible: false, task: null });
    const [lastConnectionCheck, setLastConnectionCheck] = useState(new Date());
    const [connectionMonitorInterval, setConnectionMonitorInterval] = useState(null);
    const [settings, setSettings] = useState({
        models: {
            aiSummary: 'gemma2:2b'
        },
        summaryPreferences: {
            outputFormat: 'markdown',
            includeTimestamps: true,
            includeQuotes: true,
            maxTokensAI: 1200,
            temperature: 0.4,
            bulletStyle: '•'
        },
        ui: {
            autoSwitchToResult: true,
            showWordCount: true
        },
        externalAPIs: {
            enabled: false,
            provider: 'openai', // 'openai', 'anthropic', 'custom'
            openai: {
                apiKey: '',
                baseUrl: 'https://api.openai.com/v1',
                model: 'gpt-3.5-turbo'
            },
            anthropic: {
                apiKey: '',
                baseUrl: 'https://api.anthropic.com/v1',
                model: 'claude-3-haiku-20240307'
            },
            custom: {
                apiKey: '',
                baseUrl: '',
                model: '',
                headers: {}
            }
        }
    });

    // State for dropdown features box
    const [featuresDropdown, setFeaturesDropdown] = useState({
        isVisible: true,
        activeDropdown: null, // 'export', 'analysis', 'tools', 'templates'
        exportOptions: {
            format: 'markdown',
            includeMetadata: true,
            includeTimestamp: true
        },
        analysisOptions: {
            showWordCount: true,
            showReadingTime: true,
            showSentiment: false
        }
    });

    const apiClient = useRef(new YouTubeAIApiClient()).current;

    useEffect(() => {
        loadTaskHistory();
        loadTheme();
        loadSettings();
        checkServiceConnection(true);
        startConnectionMonitoring();

        // Cleanup on unmount
        return () => {
            stopConnectionMonitoring();
        };
    }, []);

    const checkServiceConnection = async (showStatusMessage = false) => {
        try {
            const isHealthy = await apiClient.checkServiceHealth();
            const previousState = isServiceConnected;

            setIsServiceConnected(isHealthy);
            setIsServerRunning(isHealthy);
            setLastConnectionCheck(new Date());

            // Only show status messages if explicitly requested or state changed
            if (showStatusMessage || previousState !== isHealthy) {
                if (isHealthy) {
                    showSettingsStatus('✅ Backend server connected successfully!', 'success');
                } else {
                    showSettingsStatus('⚠️ Backend server is not responding. Please start the service.', 'warning');
                }
            }

            return isHealthy;
        } catch (error) {
            const previousState = isServiceConnected;
            setIsServiceConnected(false);
            setIsServerRunning(false);
            setLastConnectionCheck(new Date());

            if (showStatusMessage || previousState !== false) {
                showSettingsStatus('❌ Could not connect to backend server.', 'error');
            }

            return false;
        }
    };

    const startConnectionMonitoring = () => {
        // Clear existing interval
        if (connectionMonitorInterval) {
            clearInterval(connectionMonitorInterval);
        }

        // Start monitoring every 5 seconds
        const interval = setInterval(async () => {
            await checkServiceConnection(false);
        }, 5000);

        setConnectionMonitorInterval(interval);
    };

    const stopConnectionMonitoring = () => {
        if (connectionMonitorInterval) {
            clearInterval(connectionMonitorInterval);
            setConnectionMonitorInterval(null);
        }
    };



    const loadTaskHistory = () => {
        try {
            const saved = localStorage.getItem('youtube-ai-task-history');
            if (saved) {
                setTaskHistory(JSON.parse(saved));
            }
        } catch (error) {
            console.error('Error loading task history:', error);
        }
    };

    const saveTaskHistory = (newHistory) => {
        try {
            // Limit history to 5 items to manage localStorage size
            const limitedHistory = newHistory.slice(0, 5);
            localStorage.setItem('youtube-ai-task-history', JSON.stringify(limitedHistory));
            setTaskHistory(limitedHistory);
        } catch (error) {
            console.error('Error saving task history:', error);
            if (error.name === 'QuotaExceededError') {
                // If storage is full, try saving with only 3 items
                try {
                    const smallerHistory = newHistory.slice(0, 3);
                    localStorage.setItem('youtube-ai-task-history', JSON.stringify(smallerHistory));
                    setTaskHistory(smallerHistory);
                    showStatus('Storage nearly full - keeping only 3 most recent items', 'warning');
                } catch (secondError) {
                    showStatus('Storage full - unable to save history', 'error');
                }
            } else {
                showStatus('Error saving to storage', 'error');
            }
        }
    };

    const loadTheme = () => {
        const saved = localStorage.getItem('youtube-ai-theme') || 'light';
        setCurrentTheme(saved);
        document.documentElement.setAttribute('data-theme', saved);
    };

    const setTheme = (theme) => {
        setCurrentTheme(theme);
        localStorage.setItem('youtube-ai-theme', theme);
        document.documentElement.setAttribute('data-theme', theme);
    };

    const loadSettings = () => {
        try {
            const saved = localStorage.getItem('youtube-ai-settings');
            if (saved) {
                const parsedSettings = JSON.parse(saved);

                // Validate loaded settings
                if (parsedSettings && typeof parsedSettings === 'object') {
                    // Merge with defaults to ensure all required properties exist
                    const mergedSettings = {
                        models: {
                            aiSummary: parsedSettings.models?.aiSummary || 'gemma2:2b'
                        },
                        summaryPreferences: {
                            outputFormat: parsedSettings.summaryPreferences?.outputFormat || 'markdown',
                            includeTimestamps: parsedSettings.summaryPreferences?.includeTimestamps ?? true,
                            includeQuotes: parsedSettings.summaryPreferences?.includeQuotes ?? true,
                            maxTokensAI: parsedSettings.summaryPreferences?.maxTokensAI || 1200,
                            temperature: parsedSettings.summaryPreferences?.temperature || 0.4,
                            bulletStyle: parsedSettings.summaryPreferences?.bulletStyle || '•'
                        },
                        ui: {
                            autoSwitchToResult: parsedSettings.ui?.autoSwitchToResult ?? true,
                            showWordCount: parsedSettings.ui?.showWordCount ?? true
                        },
                        externalAPIs: {
                            enabled: parsedSettings.externalAPIs?.enabled ?? false,
                            provider: parsedSettings.externalAPIs?.provider || 'openai',
                            openai: {
                                apiKey: parsedSettings.externalAPIs?.openai?.apiKey || '',
                                baseUrl: parsedSettings.externalAPIs?.openai?.baseUrl || 'https://api.openai.com/v1',
                                model: parsedSettings.externalAPIs?.openai?.model || 'gpt-3.5-turbo'
                            },
                            anthropic: {
                                apiKey: parsedSettings.externalAPIs?.anthropic?.apiKey || '',
                                baseUrl: parsedSettings.externalAPIs?.anthropic?.baseUrl || 'https://api.anthropic.com/v1',
                                model: parsedSettings.externalAPIs?.anthropic?.model || 'claude-3-haiku-20240307'
                            },
                            custom: {
                                apiKey: parsedSettings.externalAPIs?.custom?.apiKey || '',
                                baseUrl: parsedSettings.externalAPIs?.custom?.baseUrl || '',
                                model: parsedSettings.externalAPIs?.custom?.model || '',
                                headers: parsedSettings.externalAPIs?.custom?.headers || {}
                            }
                        }
                    };

                    setSettings(mergedSettings);
                    console.log('Settings loaded successfully');
                } else {
                    throw new Error('Invalid settings format');
                }
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            showStatus('Failed to load saved settings. Using defaults.', 'warning');

            // Clear corrupted settings
            try {
                localStorage.removeItem('youtube-ai-settings');
            } catch (clearError) {
                console.error('Error clearing corrupted settings:', clearError);
            }
        }
    };

    const saveSettings = (newSettings) => {
        try {
            // Validate settings before saving
            if (!newSettings || typeof newSettings !== 'object') {
                throw new Error('Invalid settings data');
            }

            if (!newSettings.models || !newSettings.models.aiSummary) {
                throw new Error('Model settings are required');
            }

            localStorage.setItem('youtube-ai-settings', JSON.stringify(newSettings));
            setSettings(newSettings);
            showStatus('Settings saved successfully!', 'success');
        } catch (error) {
            console.error('Error saving settings:', error);
            if (error.name === 'QuotaExceededError') {
                showStatus('Failed to save settings: Storage quota exceeded. Please clear some browser data.', 'error');
            } else {
                showStatus(`Failed to save settings: ${error.message}`, 'error');
            }
        }
    };

    const resetSettings = () => {
        const defaultSettings = {
            models: {
                aiSummary: 'gemma2:2b'
            },
            summaryPreferences: {
                outputFormat: 'markdown',
                includeTimestamps: true,
                includeQuotes: true,
                maxTokensAI: 1200,
                temperature: 0.4,
                bulletStyle: '•'
            },
            ui: {
                autoSwitchToResult: true,
                showWordCount: true
            },
            externalAPIs: {
                enabled: false,
                provider: 'openai',
                openai: {
                    apiKey: '',
                    baseUrl: 'https://api.openai.com/v1',
                    model: 'gpt-3.5-turbo'
                },
                anthropic: {
                    apiKey: '',
                    baseUrl: 'https://api.anthropic.com/v1',
                    model: 'claude-3-haiku-20240307'
                },
                custom: {
                    apiKey: '',
                    baseUrl: '',
                    model: '',
                    headers: {}
                }
            }
        };
        saveSettings(defaultSettings);
    };

    const validateModelAvailability = async (model) => {
        try {
            showSettingsStatus(`Testing model "${model}"... Please wait.`, 'info');

            // Test the model with a small sample and basic options
            const testTranscript = "This is a test message for model validation.";
            const testOptions = {
                outputFormat: 'plain',
                bulletStyle: '•',
                includeTimestamps: false,
                includeQuotes: false,
                maxTokens: 50,
                temperature: 0.1
            };

            const result = await apiClient.generateSummary(testTranscript, model, testOptions);

            if (result && result.length > 0) {
                return {
                    available: true,
                    message: `✅ Model "${model}" is ready to go! Test response received successfully.`,
                    type: 'success'
                };
            } else {
                return {
                    available: false,
                    message: `❌ Model "${model}" responded but returned empty result. The model may not be working properly.`,
                    suggestion: 'Please reinstall the model manually or select a different model from the dropdown.',
                    type: 'error'
                };
            }
        } catch (error) {
            console.error('Model validation error:', error);

            // Parse different error types for better user guidance
            let errorMessage = '';
            let suggestion = '';

            if (error.message.includes('404') || error.message.includes('not found')) {
                errorMessage = `❌ Model "${model}" is not installed on your system.`;
                suggestion = 'Please install the model manually or select a different model from the dropdown.';
            } else if (error.message.includes('500') || error.message.includes('server error')) {
                errorMessage = `❌ Model "${model}" is installed but encountered an error during processing.`;
                suggestion = 'The model may be corrupted. Please reinstall it manually or select a different model.';
            } else if (error.message.includes('Cannot connect') || error.message.includes('fetch')) {
                errorMessage = `❌ Cannot connect to the AI service. Please ensure the backend server is running.`;
                suggestion = 'Start the backend server first, then test the model again.';
            } else {
                errorMessage = `❌ Model "${model}" test failed: ${error.message}`;
                suggestion = 'Please check the model installation or select a different model from the dropdown.';
            }

            return {
                available: false,
                message: errorMessage,
                suggestion: suggestion,
                type: 'error'
            };
        }
    };


    const showStatus = (message, type = 'info') => {
        setStatus({ message, type, visible: true });
        setTimeout(() => {
            setStatus(prev => ({ ...prev, visible: false }));
        }, 5000);
    };

    const showSettingsStatus = (message, type = 'info') => {
        setSettingsStatus({ message, type, visible: true });
        setTimeout(() => {
            setSettingsStatus(prev => ({ ...prev, visible: false }));
        }, 5000);
    };

    const showProgress = (percent) => {
        setProgress(percent);
    };

    const addToHistory = (task) => {
        const newTask = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            createdAt: new Date().toLocaleString(),
            ...task
        };
        const newHistory = [newTask, ...taskHistory.slice(0, 4)]; // Keep last 5 total
        saveTaskHistory(newHistory);
    };

    const updateHistoryWithContent = (transcript, aiSummary, videoInfo) => {
        if (taskHistory.length > 0) {
            const updatedHistory = taskHistory.map((task, index) => {
                if (index === 0) { // Update the most recent task
                    return {
                        ...task,
                        transcript: transcript,
                        aiSummary: aiSummary,
                        videoInfo: videoInfo,
                        hasAiSummary: !!aiSummary
                    };
                }
                return task;
            });
            saveTaskHistory(updatedHistory);
        }
    };

    const handleExtractTranscript = async () => {
        if (!currentUrl.trim()) {
            showStatus('Please enter a YouTube URL or type "demo"', 'error');
            return;
        }

        if (!isServiceConnected) {
            showStatus('YouTube AI Service is not connected. Please check the backend service.', 'error');
            return;
        }

        const videoId = apiClient.extractVideoId(currentUrl);
        if (!videoId) {
            showStatus('Please enter a valid YouTube URL', 'error');
            return;
        }

        setIsLoading(true);
        showStatus('Extracting transcript...', 'info');
        showProgress(30);

        try {
            const result = await apiClient.extractTranscript(videoId);

            if (result.transcript && result.transcript.transcript) {
                setCurrentTranscript(result.transcript.transcript);
                setCurrentVideoInfo(result.videoInfo);
                showStatus('Transcript extracted successfully!', 'success');
                showProgress(100);

                // Add to history with full content
                addToHistory({
                    url: currentUrl,
                    videoTitle: result.videoInfo?.title || 'Unknown Video',
                    channelName: result.videoInfo?.channelName || 'Unknown Channel',
                    transcriptLength: result.transcript.transcript.length,
                    transcript: result.transcript.transcript,
                    videoInfo: result.videoInfo,
                    aiSummary: '',
                    hasAiSummary: false,
                    language: result.transcript.language || 'en',
                    isAutoGenerated: result.transcript.isAutoGenerated || false,
                    videoId: apiClient.extractVideoId(currentUrl)
                });

                // Enable summarize buttons
                if (settings.ui.autoSwitchToResult) {
                    setActiveTab('transcript');
                }
            } else {
                throw new Error('No transcript found');
            }
        } catch (error) {
            console.error('Transcript extraction error:', error);
            showStatus(`Failed to extract transcript: ${error.message}`, 'error');
        } finally {
            setIsLoading(false);
            setTimeout(() => showProgress(0), 1000);
        }
    };

    const handleSummarize = async (isFastMode = false) => {
        if (!currentTranscript) {
            showStatus('Please extract a transcript first', 'error');
            return;
        }

        if (!isServiceConnected) {
            showStatus('YouTube AI Service is not connected.', 'error');
            return;
        }

        setIsLoading(true);
        const mode = isFastMode ? 'fast' : 'detailed';
        showStatus(`Generating ${mode} AI summary...`, 'info');
        showProgress(50);

        try {
            // Use models from settings
            const model = settings.models.aiSummary;

            // Validate model selection
            if (!model || model.trim() === '') {
                throw new Error('No model selected. Please check your settings and select a valid AI model.');
            }

            showStatus(`Using model: ${model} for ${mode} summary...`, 'info');

            // Prepare options from settings
            const summaryOptions = {
                outputFormat: settings.summaryPreferences.outputFormat,
                bulletStyle: settings.summaryPreferences.bulletStyle,
                includeTimestamps: settings.summaryPreferences.includeTimestamps,
                includeQuotes: settings.summaryPreferences.includeQuotes,
                maxTokens: settings.summaryPreferences.maxTokensAI,
                temperature: settings.summaryPreferences.temperature,
                useExternalAPI: settings.externalAPIs.enabled,
                externalAPIConfig: settings.externalAPIs.enabled ? settings.externalAPIs : null
            };

            // Use external API model if enabled, otherwise use local model
            const finalModel = settings.externalAPIs.enabled ? 'external-api' : model;

            const summary = await apiClient.generateSummary(currentTranscript, finalModel, summaryOptions);

            setAiSummary(summary);
            if (settings.ui.autoSwitchToResult) {
                setActiveTab('ai-summary');
            }

            showStatus(`${mode} summary generated successfully!`, 'success');
            showProgress(100);

            // Update history with the actual summary content
            const updatedHistory = taskHistory.map(task => {
                if (task.id === taskHistory[0]?.id) {
                    return {
                        ...task,
                        aiSummary: summary,
                        hasAiSummary: true,
                        summaryLength: summary.length,
                        summaryWordCount: summary.split(/\s+/).length,
                        summaryGeneratedAt: new Date().toLocaleString(),
                        modelUsed: settings.externalAPIs.enabled ?
                            `${settings.externalAPIs.provider}-${settings.externalAPIs[settings.externalAPIs.provider].model}` :
                            settings.models.aiSummary
                    };
                }
                return task;
            });
            saveTaskHistory(updatedHistory);

        } catch (error) {
            console.error('Summary generation error:', error);
            showStatus(`Failed to generate summary: ${error.message}`, 'error');
        } finally {
            setIsLoading(false);
            setTimeout(() => showProgress(0), 1000);
        }
    };

    const copyToClipboard = (type) => {
        let content = '';
        switch (type) {
            case 'ai-summary':
                content = aiSummary;
                break;
            case 'transcript':
                content = currentTranscript;
                break;
            default:
                return;
        }

        if (!content) {
            showStatus('Nothing to copy', 'warning');
            return;
        }

        navigator.clipboard.writeText(content).then(() => {
            showStatus('Copied to clipboard!', 'success');
        }).catch(() => {
            showStatus('Failed to copy to clipboard', 'error');
        });
    };

    const clearHistory = () => {
        setTaskHistory([]);
        localStorage.removeItem('youtube-ai-task-history');
        showStatus('History cleared', 'success');
    };

    const deleteHistoryItem = (taskId, event) => {
        event.stopPropagation(); // Prevent triggering the loadHistoryItem
        const updatedHistory = taskHistory.filter(task => task.id !== taskId);
        saveTaskHistory(updatedHistory);
        showStatus('Task deleted', 'success');
    };

    const loadHistoryItem = (task) => {
        setCurrentUrl(task.url);

        // Restore all content from history
        if (task.transcript) {
            setCurrentTranscript(task.transcript);
        }

        if (task.videoInfo) {
            setCurrentVideoInfo(task.videoInfo);
        }

        if (task.aiSummary) {
            setAiSummary(task.aiSummary);
        }

        // Switch to appropriate tab based on available content
        if (task.aiSummary && task.transcript) {
            setActiveTab('ai-summary');
            showStatus(`✅ Full session restored! Video: "${task.videoTitle}" | Transcript: ${Math.round(task.transcriptLength / 1000)}k chars | Summary: ${task.summaryWordCount || 'N/A'} words | Model: ${task.modelUsed || 'N/A'}`, 'success');
        } else if (task.transcript) {
            setActiveTab('transcript');
            showStatus(`📄 Transcript restored! Video: "${task.videoTitle}" | ${Math.round(task.transcriptLength / 1000)}k characters | Language: ${task.language || 'N/A'}`, 'success');
        } else {
            showStatus(`🔗 URL loaded from history: "${task.videoTitle}". Extract transcript to continue.`, 'info');
        }

        // Log detailed information for debugging
        console.log('Loaded history item:', {
            title: task.videoTitle,
            hasTranscript: !!task.transcript,
            hasAiSummary: !!task.hasAiSummary,
            hasVideoInfo: !!task.videoInfo,
            transcriptLength: task.transcriptLength,
            summaryWordCount: task.summaryWordCount,
            modelUsed: task.modelUsed,
            createdAt: task.createdAt,
            language: task.language,
            isAutoGenerated: task.isAutoGenerated
        });
    };

    const showHistoryPreview = (task, event) => {
        event.stopPropagation();
        setHistoryPreview({ visible: true, task: task });
    };

    const hideHistoryPreview = () => {
        setHistoryPreview({ visible: false, task: null });
    };

    const toggleSidebar = () => {
        setIsSidebarVisible(!isSidebarVisible);
    };

    const testExternalAPI = async () => {
        try {
            if (!settings.externalAPIs.enabled) {
                throw new Error('External APIs are not enabled');
            }

            const provider = settings.externalAPIs.provider;
            const config = settings.externalAPIs[provider];

            if (!config.apiKey) {
                throw new Error(`API key is required for ${provider}`);
            }

            if (!config.baseUrl) {
                throw new Error(`Base URL is required for ${provider}`);
            }

            // Test with a simple prompt
            const testOptions = {
                outputFormat: 'plain',
                bulletStyle: '•',
                includeTimestamps: false,
                includeQuotes: false,
                maxTokens: 100,
                temperature: 0.3,
                useExternalAPI: true
            };

            await apiClient.generateSummary('This is a test message.', 'external-api', testOptions);

            return {
                success: true,
                message: `✅ ${provider.toUpperCase()} API connection successful! Model: ${config.model}`
            };
        } catch (error) {
            return {
                success: false,
                message: `❌ API test failed: ${error.message}`
            };
        }
    };

    // Features dropdown functions
    const toggleFeaturesDropdown = (dropdownType) => {
        setFeaturesDropdown(prev => ({
            ...prev,
            activeDropdown: prev.activeDropdown === dropdownType ? null : dropdownType
        }));
    };

    const toggleFeaturesBox = () => {
        setFeaturesDropdown(prev => ({
            ...prev,
            isVisible: !prev.isVisible
        }));
    };

    const handleExport = (format) => {
        let content = '';
        let filename = '';
        
        switch (format) {
            case 'markdown':
                content = generateMarkdownExport();
                filename = 'youtube-summary.md';
                break;
            case 'txt':
                content = generateTextExport();
                filename = 'youtube-summary.txt';
                break;
            case 'json':
                content = generateJSONExport();
                filename = 'youtube-summary.json';
                break;
            default:
                return;
        }

        downloadFile(content, filename);
        showStatus(`Exported as ${format.toUpperCase()}!`, 'success');
    };

    const generateMarkdownExport = () => {
        let content = '';
        
        if (currentVideoInfo) {
            content += `# ${currentVideoInfo.title}\n\n`;
            content += `**Channel:** ${currentVideoInfo.channelName}\n`;
            content += `**URL:** ${currentUrl}\n`;
            if (featuresDropdown.exportOptions.includeTimestamp) {
                content += `**Exported:** ${new Date().toLocaleString()}\n`;
            }
            content += '\n---\n\n';
        }

        if (aiSummary) {
            content += '## AI Summary\n\n';
            content += aiSummary + '\n\n';
        }

        if (currentTranscript && featuresDropdown.exportOptions.includeMetadata) {
            content += '## Full Transcript\n\n';
            content += currentTranscript + '\n\n';
        }

        return content;
    };

    const generateTextExport = () => {
        let content = '';
        
        if (currentVideoInfo) {
            content += `${currentVideoInfo.title}\n`;
            content += `Channel: ${currentVideoInfo.channelName}\n`;
            content += `URL: ${currentUrl}\n`;
            if (featuresDropdown.exportOptions.includeTimestamp) {
                content += `Exported: ${new Date().toLocaleString()}\n`;
            }
            content += '\n' + '='.repeat(50) + '\n\n';
        }

        if (aiSummary) {
            content += 'AI SUMMARY:\n\n';
            content += aiSummary + '\n\n';
        }

        if (currentTranscript && featuresDropdown.exportOptions.includeMetadata) {
            content += 'FULL TRANSCRIPT:\n\n';
            content += currentTranscript + '\n\n';
        }

        return content;
    };

    const generateJSONExport = () => {
        const data = {
            videoInfo: currentVideoInfo,
            url: currentUrl,
            aiSummary: aiSummary,
            transcript: featuresDropdown.exportOptions.includeMetadata ? currentTranscript : null,
            exportedAt: featuresDropdown.exportOptions.includeTimestamp ? new Date().toISOString() : null,
            settings: {
                model: settings.models.aiSummary,
                outputFormat: settings.summaryPreferences.outputFormat
            }
        };
        
        return JSON.stringify(data, null, 2);
    };

    const downloadFile = (content, filename) => {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const getAnalysisData = () => {
        const data = {
            wordCount: 0,
            readingTime: 0,
            sentiment: 'neutral'
        };

        if (aiSummary) {
            data.wordCount = aiSummary.split(/\s+/).length;
            data.readingTime = Math.ceil(data.wordCount / 200); // Average reading speed
        }

        return data;
    };

    return (
        <div className={`youtube-ai-container theme-${currentTheme}`} data-theme={currentTheme}>
            {/* Backdrop Overlay - Only for mobile */}
            {isSidebarVisible && (
                <div
                    className="sidebar-backdrop"
                    onClick={toggleSidebar}
                />
            )}

            {/* Mobile Sidebar Backdrop */}
            {isSidebarVisible && (
                <div
                    className="sidebar-backdrop-mobile"
                    onClick={toggleSidebar}
                />
            )}

            {/* Sidebar for Task History */}
            <aside className={`youtube-ai-sidebar ${isSidebarVisible ? 'visible' : 'hidden'}`}>

                {/* Sidebar Content - Only show when visible */}
                {isSidebarVisible && (
                    <div className="sidebar-main">
                        <div className="sidebar-header">
                            <div className="sidebar-header-left">
                                <h3>📋 Task History</h3>
                                <span className="task-count">{taskHistory.length} tasks</span>
                            </div>
                            <div className="sidebar-header-right">
                                <button
                                    className="clear-btn"
                                    onClick={clearHistory}
                                    title="Clear all history"
                                    disabled={taskHistory.length === 0}
                                >
                                    🗑️
                                </button>
                            </div>
                        </div>
                        <div className="sidebar-content">
                            <div className="task-list">
                                {taskHistory.length === 0 ? (
                                    <div className="empty-history">
                                        <div className="empty-icon">📝</div>
                                        <p>No previous tasks yet</p>
                                        <small>Your task history will appear here</small>
                                    </div>
                                ) : (
                                    taskHistory.map(task => (
                                        <div
                                            key={task.id}
                                            className="task-item"
                                            onClick={() => loadHistoryItem(task)}
                                        >
                                            <div className="task-content">
                                                <div className="task-title" title={task.videoTitle}>
                                                    {task.videoTitle.length > 60 ?
                                                        `${task.videoTitle.substring(0, 60)}...` :
                                                        task.videoTitle
                                                    }
                                                </div>
                                                <div className="task-channel" title={task.channelName || 'Unknown Channel'}>
                                                    📺 {task.channelName || 'Unknown Channel'}
                                                </div>
                                            </div>
                                            <div className="task-actions">
                                                <button
                                                    className="preview-btn"
                                                    onClick={(e) => showHistoryPreview(task, e)}
                                                    title="Preview Details"
                                                >
                                                    👁️ Details
                                                </button>
                                                <button
                                                    className="delete-btn"
                                                    onClick={(e) => deleteHistoryItem(task.id, e)}
                                                    title="Delete Task"
                                                >
                                                    🗑️ Delete
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </aside>

            <div className="youtube-ai-main">
                {/* Header */}
                <header className="youtube-ai-header">
                    <div className="header-content">
                        <button
                            className="sidebar-toggle-btn"
                            onClick={toggleSidebar}
                            title={isSidebarVisible ? 'Hide History' : 'Show History'}
                            aria-expanded={isSidebarVisible}
                            aria-label="Toggle task history sidebar"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="3" y1="6" x2="21" y2="6"></line>
                                <line x1="3" y1="12" x2="21" y2="12"></line>
                                <line x1="3" y1="18" x2="21" y2="18"></line>
                            </svg>
                        </button>
                        <div className="header-center">
                            <div className="header-text">
                                <h1>YouTube AI Summarizer</h1>
                                <p>Extract transcripts and generate AI-powered summaries from YouTube videos</p>
                            </div>
                        </div>
                        <div className="header-controls">
                            <div className="service-status">
                                <span className={`status-indicator ${isServiceConnected ? 'connected' : 'disconnected'}`}>
                                    <span className={`status-dot ${isServiceConnected ? 'connected' : 'disconnected'}`}></span>
                                    {isServiceConnected ? 'Connected' : 'Disconnected'}
                                </span>
                            </div>
                            <div className="header-controls-group">
                                <button
                                    className={`settings-btn ${isSettingsVisible ? 'active' : ''}`}
                                    onClick={() => setIsSettingsVisible(!isSettingsVisible)}
                                    title="Settings"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12A3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97 0-.33-.03-.66-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.31-.61-.22l-2.49 1c-.52-.39-1.06-.73-1.69-.98l-.37-2.65A.506.506 0 0 0 14 2h-4c-.25 0-.46.18-.5.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1 0 .33.03.65.07.97l-2.11 1.66c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1.01c.52.4 1.06.74 1.69.99l.37 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.63-.26 1.17-.59 1.69-.99l2.49 1.01c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.66Z" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Settings Panel */}
                {isSettingsVisible && (
                    <div className="settings-panel">
                        <div className="settings-panel-backdrop" onClick={() => setIsSettingsVisible(false)} />
                        <div className="settings-panel-content">
                            <div className="settings-panel-header">
                                <h2>⚙️ Settings</h2>
                                <button
                                    className="settings-close-btn"
                                    onClick={() => setIsSettingsVisible(false)}
                                    title="Close Settings"
                                >
                                    ✕
                                </button>
                            </div>
                            <div className="settings-content">
                                {/* Settings Status Section */}
                                {settingsStatus.visible && (
                                    <div className={`settings-status-section ${settingsStatus.type}`}>
                                        <div className="settings-status-message">{settingsStatus.message}</div>
                                    </div>
                                )}

                                <div className="settings-section">
                                    <h3>🖥️ Backend Server</h3>
                                    <div className="setting-group">
                                        <div className="server-instruction-container">
                                            <div className="server-instruction-content">
                                                <p className="server-instruction-text">
                                                    To start the backend server, run:
                                                </p>
                                                <div className="server-command-box">
                                                    <code className="server-command">
                                                        cd src/services/youtube-ai-summarizer/backend; node server.js
                                                    </code>
                                                    <button
                                                        className="copy-command-btn"
                                                        onClick={async () => {
                                                            try {
                                                                await navigator.clipboard.writeText('cd src/services/youtube-ai-summarizer/backend; node server.js');
                                                                showSettingsStatus('📋 Command copied to clipboard!', 'success');
                                                            } catch (error) {
                                                                showSettingsStatus('❌ Failed to copy command', 'error');
                                                            }
                                                        }}
                                                        title="Copy command to clipboard"
                                                    >
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="settings-section">
                                    <h3>🤖 AI Models</h3>
                                    <div className="setting-group">
                                        <label htmlFor="ai-model">AI Summary Model:</label>
                                        <div className="model-setting-row">
                                            <select
                                                id="ai-model"
                                                value={settings.models.aiSummary}
                                                onChange={(e) => saveSettings({
                                                    ...settings,
                                                    models: { ...settings.models, aiSummary: e.target.value }
                                                })}
                                            >
                                                <option value="gemma2:2b">Gemma 2 2B (Fast)</option>
                                                <option value="gemma3:1b">Gemma 3 1B (Ultra Fast)</option>
                                                <option value="gemma3:4b">Gemma 3 4B (Fast)</option>
                                                <option value="gemma2:9b">Gemma 2 9B (Detailed)</option>
                                                <option value="llama3.1:8b">Llama 3.1 8B</option>
                                                <option value="llama3.2:1b">Llama 3.2 1B (Ultra Fast)</option>
                                                <option value="llama3.2:3b">Llama 3.2 3B (Fast)</option>
                                                <option value="mistral:7b">Mistral 7B</option>
                                                <option value="gemma2:27b">Gemma 2 27B (High Quality)</option>
                                                <option value="llama3.1:70b">Llama 3.1 70B (Best Quality)</option>
                                            </select>
                                            <button
                                                className="test-model-btn compact"
                                                onClick={async () => {
                                                    setIsLoading(true);
                                                    try {
                                                        const result = await validateModelAvailability(settings.models.aiSummary);

                                                        // Display main message in settings panel
                                                        showSettingsStatus(result.message, result.type || (result.available ? 'success' : 'error'));

                                                        // If there's a suggestion, show it after a brief delay
                                                        if (result.suggestion && !result.available) {
                                                            setTimeout(() => {
                                                                showSettingsStatus(result.suggestion, 'info');
                                                            }, 3000);
                                                        }
                                                    } catch (error) {
                                                        showSettingsStatus(`Test failed: ${error.message}`, 'error');
                                                    }
                                                    setIsLoading(false);
                                                }}
                                                disabled={isLoading}
                                                title="Test if this model is available and working"
                                            >
                                                🧪 Test Model
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="settings-section">
                                    <h3>🌐 External AI APIs</h3>
                                    <div className="setting-group checkbox-group">
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={settings.externalAPIs.enabled}
                                                onChange={(e) => saveSettings({
                                                    ...settings,
                                                    externalAPIs: { ...settings.externalAPIs, enabled: e.target.checked }
                                                })}
                                            />
                                            Enable External AI APIs
                                        </label>
                                    </div>

                                    {settings.externalAPIs.enabled && (
                                        <>
                                            <div className="setting-group">
                                                <label htmlFor="api-provider">API Provider:</label>
                                                <select
                                                    id="api-provider"
                                                    value={settings.externalAPIs.provider}
                                                    onChange={(e) => saveSettings({
                                                        ...settings,
                                                        externalAPIs: { ...settings.externalAPIs, provider: e.target.value }
                                                    })}
                                                >
                                                    <option value="openai">OpenAI (GPT)</option>
                                                    <option value="anthropic">Anthropic (Claude)</option>
                                                    <option value="custom">Custom API</option>
                                                </select>
                                            </div>

                                            {settings.externalAPIs.provider === 'openai' && (
                                                <div className="api-config-section">
                                                    <h4>🤖 OpenAI Configuration</h4>
                                                    <div className="setting-group">
                                                        <label htmlFor="openai-key">API Key:</label>
                                                        <input
                                                            type="password"
                                                            id="openai-key"
                                                            value={settings.externalAPIs.openai.apiKey}
                                                            onChange={(e) => saveSettings({
                                                                ...settings,
                                                                externalAPIs: {
                                                                    ...settings.externalAPIs,
                                                                    openai: { ...settings.externalAPIs.openai, apiKey: e.target.value }
                                                                }
                                                            })}
                                                            placeholder="sk-..."
                                                        />
                                                    </div>
                                                    <div className="setting-group">
                                                        <label htmlFor="openai-model">Model:</label>
                                                        <select
                                                            id="openai-model"
                                                            value={settings.externalAPIs.openai.model}
                                                            onChange={(e) => saveSettings({
                                                                ...settings,
                                                                externalAPIs: {
                                                                    ...settings.externalAPIs,
                                                                    openai: { ...settings.externalAPIs.openai, model: e.target.value }
                                                                }
                                                            })}
                                                        >
                                                            <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                                                            <option value="gpt-4">GPT-4</option>
                                                            <option value="gpt-4-turbo">GPT-4 Turbo</option>
                                                            <option value="gpt-4o">GPT-4o</option>
                                                            <option value="gpt-4o-mini">GPT-4o Mini</option>
                                                        </select>
                                                    </div>
                                                    <div className="setting-group">
                                                        <label htmlFor="openai-url">Base URL:</label>
                                                        <input
                                                            type="url"
                                                            id="openai-url"
                                                            value={settings.externalAPIs.openai.baseUrl}
                                                            onChange={(e) => saveSettings({
                                                                ...settings,
                                                                externalAPIs: {
                                                                    ...settings.externalAPIs,
                                                                    openai: { ...settings.externalAPIs.openai, baseUrl: e.target.value }
                                                                }
                                                            })}
                                                            placeholder="https://api.openai.com/v1"
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {settings.externalAPIs.provider === 'anthropic' && (
                                                <div className="api-config-section">
                                                    <h4>🧠 Anthropic Configuration</h4>
                                                    <div className="setting-group">
                                                        <label htmlFor="anthropic-key">API Key:</label>
                                                        <input
                                                            type="password"
                                                            id="anthropic-key"
                                                            value={settings.externalAPIs.anthropic.apiKey}
                                                            onChange={(e) => saveSettings({
                                                                ...settings,
                                                                externalAPIs: {
                                                                    ...settings.externalAPIs,
                                                                    anthropic: { ...settings.externalAPIs.anthropic, apiKey: e.target.value }
                                                                }
                                                            })}
                                                            placeholder="sk-ant-..."
                                                        />
                                                    </div>
                                                    <div className="setting-group">
                                                        <label htmlFor="anthropic-model">Model:</label>
                                                        <select
                                                            id="anthropic-model"
                                                            value={settings.externalAPIs.anthropic.model}
                                                            onChange={(e) => saveSettings({
                                                                ...settings,
                                                                externalAPIs: {
                                                                    ...settings.externalAPIs,
                                                                    anthropic: { ...settings.externalAPIs.anthropic, model: e.target.value }
                                                                }
                                                            })}
                                                        >
                                                            <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
                                                            <option value="claude-3-sonnet-20240229">Claude 3 Sonnet</option>
                                                            <option value="claude-3-opus-20240229">Claude 3 Opus</option>
                                                            <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            )}

                                            {settings.externalAPIs.provider === 'custom' && (
                                                <div className="api-config-section">
                                                    <h4>⚙️ Custom API Configuration</h4>
                                                    <div className="setting-group">
                                                        <label htmlFor="custom-url">Base URL:</label>
                                                        <input
                                                            type="url"
                                                            id="custom-url"
                                                            value={settings.externalAPIs.custom.baseUrl}
                                                            onChange={(e) => saveSettings({
                                                                ...settings,
                                                                externalAPIs: {
                                                                    ...settings.externalAPIs,
                                                                    custom: { ...settings.externalAPIs.custom, baseUrl: e.target.value }
                                                                }
                                                            })}
                                                            placeholder="https://api.example.com/v1"
                                                        />
                                                    </div>
                                                    <div className="setting-group">
                                                        <label htmlFor="custom-key">API Key:</label>
                                                        <input
                                                            type="password"
                                                            id="custom-key"
                                                            value={settings.externalAPIs.custom.apiKey}
                                                            onChange={(e) => saveSettings({
                                                                ...settings,
                                                                externalAPIs: {
                                                                    ...settings.externalAPIs,
                                                                    custom: { ...settings.externalAPIs.custom, apiKey: e.target.value }
                                                                }
                                                            })}
                                                            placeholder="Your API key"
                                                        />
                                                    </div>
                                                    <div className="setting-group">
                                                        <label htmlFor="custom-model">Model:</label>
                                                        <input
                                                            type="text"
                                                            id="custom-model"
                                                            value={settings.externalAPIs.custom.model}
                                                            onChange={(e) => saveSettings({
                                                                ...settings,
                                                                externalAPIs: {
                                                                    ...settings.externalAPIs,
                                                                    custom: { ...settings.externalAPIs.custom, model: e.target.value }
                                                                }
                                                            })}
                                                            placeholder="model-name"
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            <div className="api-test-section">
                                                <button
                                                    className="test-api-btn"
                                                    onClick={async () => {
                                                        setIsLoading(true);
                                                        try {
                                                            const result = await testExternalAPI();
                                                            showStatus(result.message, result.success ? 'success' : 'error');
                                                        } catch (error) {
                                                            showStatus(`API test failed: ${error.message}`, 'error');
                                                        }
                                                        setIsLoading(false);
                                                    }}
                                                    disabled={isLoading || !settings.externalAPIs.enabled}
                                                    title="Test the external API connection"
                                                >
                                                    🧪 Test API Connection
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div className="settings-section">
                                    <h3>📝 Summary Preferences</h3>
                                    <div className="preferences-container compact">
                                        <div className="setting-group compact">
                                            <label htmlFor="output-format">Output Format:</label>
                                            <select
                                                id="output-format"
                                                value={settings.summaryPreferences.outputFormat}
                                                onChange={(e) => saveSettings({
                                                    ...settings,
                                                    summaryPreferences: { ...settings.summaryPreferences, outputFormat: e.target.value }
                                                })}
                                            >
                                                <option value="markdown">Markdown</option>
                                                <option value="plain">Plain Text</option>
                                            </select>
                                        </div>
                                        <div className="setting-group compact">
                                            <label htmlFor="bullet-style">Bullet Style:</label>
                                            <select
                                                id="bullet-style"
                                                value={settings.summaryPreferences.bulletStyle}
                                                onChange={(e) => saveSettings({
                                                    ...settings,
                                                    summaryPreferences: { ...settings.summaryPreferences, bulletStyle: e.target.value }
                                                })}
                                            >
                                                <option value="•">• Bullet</option>
                                                <option value="-">- Dash</option>
                                                <option value="1.">1. Numbered</option>
                                            </select>
                                        </div>
                                        <div className="setting-group compact">
                                            <label htmlFor="max-tokens-ai">Max Tokens:</label>
                                            <input
                                                type="range"
                                                id="max-tokens-ai"
                                                min="500"
                                                max="2000"
                                                step="100"
                                                value={settings.summaryPreferences.maxTokensAI}
                                                onChange={(e) => saveSettings({
                                                    ...settings,
                                                    summaryPreferences: { ...settings.summaryPreferences, maxTokensAI: parseInt(e.target.value) }
                                                })}
                                            />
                                            <span className="range-value">{settings.summaryPreferences.maxTokensAI}</span>
                                        </div>
                                        <div className="setting-group compact">
                                            <label htmlFor="temperature">Temperature:</label>
                                            <input
                                                type="range"
                                                id="temperature"
                                                min="0.1"
                                                max="1.0"
                                                step="0.1"
                                                value={settings.summaryPreferences.temperature}
                                                onChange={(e) => saveSettings({
                                                    ...settings,
                                                    summaryPreferences: { ...settings.summaryPreferences, temperature: parseFloat(e.target.value) }
                                                })}
                                            />
                                            <span className="range-value">{settings.summaryPreferences.temperature}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="settings-section">
                                    <h3>🎛️ UI Preferences</h3>
                                    <div className="preferences-container compact">
                                        <div className="setting-group compact checkbox-group">
                                            <label>
                                                <input
                                                    type="checkbox"
                                                    checked={settings.summaryPreferences.includeTimestamps}
                                                    onChange={(e) => saveSettings({
                                                        ...settings,
                                                        summaryPreferences: { ...settings.summaryPreferences, includeTimestamps: e.target.checked }
                                                    })}
                                                />
                                                Include timestamps
                                            </label>
                                        </div>
                                        <div className="setting-group compact checkbox-group">
                                            <label>
                                                <input
                                                    type="checkbox"
                                                    checked={settings.summaryPreferences.includeQuotes}
                                                    onChange={(e) => saveSettings({
                                                        ...settings,
                                                        summaryPreferences: { ...settings.summaryPreferences, includeQuotes: e.target.checked }
                                                    })}
                                                />
                                                Include key quotes
                                            </label>
                                        </div>
                                        <div className="setting-group compact checkbox-group">
                                            <label>
                                                <input
                                                    type="checkbox"
                                                    checked={settings.ui.autoSwitchToResult}
                                                    onChange={(e) => saveSettings({
                                                        ...settings,
                                                        ui: { ...settings.ui, autoSwitchToResult: e.target.checked }
                                                    })}
                                                />
                                                Auto-switch to result tab
                                            </label>
                                        </div>
                                        <div className="setting-group compact checkbox-group">
                                            <label>
                                                <input
                                                    type="checkbox"
                                                    checked={settings.ui.showWordCount}
                                                    onChange={(e) => saveSettings({
                                                        ...settings,
                                                        ui: { ...settings.ui, showWordCount: e.target.checked }
                                                    })}
                                                />
                                                Show word count
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <div className="settings-actions">
                                    <button
                                        className="reset-btn"
                                        onClick={resetSettings}
                                        title="Reset all settings to defaults"
                                    >
                                        🔄 Reset to Defaults
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* History Preview Modal */}
                {historyPreview.visible && historyPreview.task && (
                    <div className="history-preview-modal">
                        <div className="history-preview-backdrop" onClick={hideHistoryPreview} />
                        <div className="history-preview-content">
                            <div className="history-preview-header">
                                <h3>📋 Task History Details</h3>
                                <button
                                    className="history-preview-close"
                                    onClick={hideHistoryPreview}
                                    title="Close Preview"
                                >
                                    ✕
                                </button>
                            </div>
                            <div className="history-preview-body">
                                <div className="preview-section">
                                    <h4>🎬 Video Information</h4>
                                    <div className="preview-field">
                                        <strong>Title:</strong> {historyPreview.task.videoTitle}
                                    </div>
                                    <div className="preview-field">
                                        <strong>Channel:</strong> {historyPreview.task.channelName || 'Unknown Channel'}
                                    </div>
                                    <div className="preview-field">
                                        <strong>URL:</strong> <a href={historyPreview.task.url} target="_blank" rel="noopener noreferrer">{historyPreview.task.url}</a>
                                    </div>
                                    <div className="preview-field">
                                        <strong>Created:</strong> {historyPreview.task.createdAt || new Date(historyPreview.task.timestamp).toLocaleString()}
                                    </div>
                                    {historyPreview.task.videoInfo && (
                                        <>
                                            <div className="preview-field">
                                                <strong>Duration:</strong> {historyPreview.task.videoInfo.duration}
                                            </div>
                                            <div className="preview-field">
                                                <strong>Views:</strong> {historyPreview.task.videoInfo.views}
                                            </div>
                                        </>
                                    )}
                                </div>

                                {historyPreview.task.transcript && (
                                    <div className="preview-section">
                                        <h4>📄 Transcript Details</h4>
                                        <div className="preview-field">
                                            <strong>Length:</strong> {Math.round(historyPreview.task.transcriptLength / 1000)}k characters ({historyPreview.task.transcript.split(/\s+/).length} words)
                                        </div>
                                        <div className="preview-field">
                                            <strong>Language:</strong> {historyPreview.task.language || 'N/A'}
                                        </div>
                                        <div className="preview-field">
                                            <strong>Auto-Generated:</strong> {historyPreview.task.isAutoGenerated ? 'Yes' : 'No'}
                                        </div>
                                        <div className="preview-field">
                                            <strong>Preview:</strong>
                                            <div className="transcript-preview">
                                                {historyPreview.task.transcript.substring(0, 200)}...
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {historyPreview.task.hasAiSummary && historyPreview.task.aiSummary && (
                                    <div className="preview-section">
                                        <h4>✨ AI Summary Details</h4>
                                        <div className="preview-field">
                                            <strong>Length:</strong> {historyPreview.task.summaryWordCount || historyPreview.task.aiSummary.split(/\s+/).length} words ({historyPreview.task.summaryLength || historyPreview.task.aiSummary.length} characters)
                                        </div>
                                        <div className="preview-field">
                                            <strong>Model Used:</strong> {historyPreview.task.modelUsed || 'N/A'}
                                        </div>
                                        <div className="preview-field">
                                            <strong>Generated:</strong> {historyPreview.task.summaryGeneratedAt || 'N/A'}
                                        </div>
                                        <div className="preview-field">
                                            <strong>Preview:</strong>
                                            <div className="summary-preview">
                                                {historyPreview.task.aiSummary.substring(0, 300)}...
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="preview-actions">
                                    <button
                                        className="restore-btn"
                                        onClick={() => {
                                            loadHistoryItem(historyPreview.task);
                                            hideHistoryPreview();
                                        }}
                                    >
                                        🔄 Restore This Session
                                    </button>
                                    <button
                                        className="close-btn"
                                        onClick={hideHistoryPreview}
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <main className="youtube-ai-content">
                    <div className="content-layout">
                        {/* Main Content Area */}
                        <div className="main-content-area">
                            {/* Input Section */}
                            <div className="input-section">
                        <div className="input-group">
                            <label htmlFor="youtube-url">YouTube URL:</label>
                            <input
                                type="url"
                                id="youtube-url"
                                value={currentUrl}
                                onChange={(e) => setCurrentUrl(e.target.value)}
                                placeholder="Enter YouTube URL or try: 'demo', 'speech', 'tech-talk'"
                                onKeyPress={(e) => e.key === 'Enter' && handleExtractTranscript()}
                                disabled={isLoading}
                            />
                            <div className="button-group">
                                <button
                                    onClick={handleExtractTranscript}
                                    disabled={isLoading || !isServiceConnected}
                                    className="extract-btn"
                                >
                                    {isLoading ? 'Extracting...' : 'Extract Transcript'}
                                </button>
                                <button
                                    onClick={() => handleSummarize(false)}
                                    disabled={isLoading || !currentTranscript || !isServiceConnected}
                                    className="summarize-btn"
                                >
                                    AI Summarize
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Status Section */}
                    {status.visible && (
                        <div className={`status-section ${status.type}`}>
                            <div className="status-message">{status.message}</div>
                        </div>
                    )}

                    {/* Progress Bar */}
                    {progress > 0 && (
                        <div className="progress-section">
                            <div className="progress-bar">
                                <div
                                    className="progress-fill"
                                    style={{ width: `${progress}%` }}
                                ></div>
                            </div>
                        </div>
                    )}

                    {/* Results Section */}
                    <div className="results-section">
                        <div className="tabs">
                            <button
                                className={`tab-btn ${activeTab === 'ai-summary' ? 'active' : ''}`}
                                onClick={() => setActiveTab('ai-summary')}
                            >
                                AI Summary
                            </button>
                            <button
                                className={`tab-btn ${activeTab === 'transcript' ? 'active' : ''}`}
                                onClick={() => setActiveTab('transcript')}
                            >
                                Full Transcript
                            </button>
                        </div>

                        <div className="tab-content">
                            {/* AI Summary Tab */}
                            <div className={`tab-panel ${activeTab === 'ai-summary' ? 'active' : ''}`}>
                                <div className="output-header">
                                    <button
                                        className="copy-btn"
                                        onClick={() => copyToClipboard('ai-summary')}
                                        disabled={!aiSummary}
                                        title="Copy AI summary to clipboard"
                                    >
                                        📋 Copy AI Summary
                                    </button>
                                </div>

                                <div className="output-box">
                                    {aiSummary ? (
                                        <>
                                            <pre className="summary-content">{aiSummary}</pre>
                                            {settings.ui.showWordCount && (
                                                <div className="word-count">
                                                    Words: {aiSummary.split(/\s+/).length} | Characters: {aiSummary.length}
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <p className="placeholder">AI-generated summary will appear here...</p>
                                    )}
                                </div>
                            </div>


                            {/* Transcript Tab */}
                            <div className={`tab-panel ${activeTab === 'transcript' ? 'active' : ''}`}>
                                <div className="output-header">
                                    <button
                                        className="copy-btn"
                                        onClick={() => copyToClipboard('transcript')}
                                        disabled={!currentTranscript}
                                        title="Copy transcript to clipboard"
                                    >
                                        📋 Copy Transcript
                                    </button>
                                </div>
                                <div className="output-box">
                                    {currentTranscript ? (
                                        <>
                                            <pre className="transcript-content">{currentTranscript}</pre>
                                            {settings.ui.showWordCount && (
                                                <div className="word-count">
                                                    Words: {currentTranscript.split(/\s+/).length} | Characters: {currentTranscript.length}
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <p className="placeholder">Full transcript will appear here...</p>
                                    )}
                                </div>
                            </div>


                        </div>
                    </div>

                    {/* Video Info Section */}
                    {currentVideoInfo && (
                        <div className="video-info">
                            <h3>📹 Video Information</h3>
                            <div className="video-details">
                                <p><strong>Title:</strong> {currentVideoInfo.title}</p>
                                <p><strong>Channel:</strong> {currentVideoInfo.channelName || 'Unknown Channel'}</p>
                                <p><strong>Duration:</strong> {currentVideoInfo.duration}</p>
                                <p><strong>Views:</strong> {currentVideoInfo.views}</p>
                            </div>
                        </div>
                    )}
                        </div>

                        {/* Features Dropdown Box */}
                        {featuresDropdown.isVisible && (
                            <div className="features-dropdown-box">
                                <div className="features-header">
                                    <h3>🛠️ Features</h3>
                                    <button 
                                        className="features-toggle-btn"
                                        onClick={toggleFeaturesBox}
                                        title="Hide features panel"
                                    >
                                        ✕
                                    </button>
                                </div>

                                <div className="features-content">
                                    {/* Export Dropdown */}
                                    <div className="feature-item">
                                        <button 
                                            className={`feature-btn ${featuresDropdown.activeDropdown === 'export' ? 'active' : ''}`}
                                            onClick={() => toggleFeaturesDropdown('export')}
                                        >
                                            📤 Export
                                            <span className="dropdown-arrow">
                                                {featuresDropdown.activeDropdown === 'export' ? '▲' : '▼'}
                                            </span>
                                        </button>
                                        
                                        {featuresDropdown.activeDropdown === 'export' && (
                                            <div className="dropdown-content">
                                                <div className="dropdown-options">
                                                    <button 
                                                        className="dropdown-option"
                                                        onClick={() => handleExport('markdown')}
                                                        disabled={!aiSummary && !currentTranscript}
                                                    >
                                                        📝 Markdown (.md)
                                                    </button>
                                                    <button 
                                                        className="dropdown-option"
                                                        onClick={() => handleExport('txt')}
                                                        disabled={!aiSummary && !currentTranscript}
                                                    >
                                                        📄 Text (.txt)
                                                    </button>
                                                    <button 
                                                        className="dropdown-option"
                                                        onClick={() => handleExport('json')}
                                                        disabled={!aiSummary && !currentTranscript}
                                                    >
                                                        🔧 JSON (.json)
                                                    </button>
                                                </div>
                                                
                                                <div className="export-settings">
                                                    <label className="checkbox-label">
                                                        <input 
                                                            type="checkbox"
                                                            checked={featuresDropdown.exportOptions.includeMetadata}
                                                            onChange={(e) => setFeaturesDropdown(prev => ({
                                                                ...prev,
                                                                exportOptions: {
                                                                    ...prev.exportOptions,
                                                                    includeMetadata: e.target.checked
                                                                }
                                                            }))}
                                                        />
                                                        Include transcript
                                                    </label>
                                                    <label className="checkbox-label">
                                                        <input 
                                                            type="checkbox"
                                                            checked={featuresDropdown.exportOptions.includeTimestamp}
                                                            onChange={(e) => setFeaturesDropdown(prev => ({
                                                                ...prev,
                                                                exportOptions: {
                                                                    ...prev.exportOptions,
                                                                    includeTimestamp: e.target.checked
                                                                }
                                                            }))}
                                                        />
                                                        Include timestamp
                                                    </label>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Analysis Dropdown */}
                                    <div className="feature-item">
                                        <button 
                                            className={`feature-btn ${featuresDropdown.activeDropdown === 'analysis' ? 'active' : ''}`}
                                            onClick={() => toggleFeaturesDropdown('analysis')}
                                        >
                                            📊 Analysis
                                            <span className="dropdown-arrow">
                                                {featuresDropdown.activeDropdown === 'analysis' ? '▲' : '▼'}
                                            </span>
                                        </button>
                                        
                                        {featuresDropdown.activeDropdown === 'analysis' && (
                                            <div className="dropdown-content">
                                                {aiSummary ? (
                                                    <div className="analysis-stats">
                                                        <div className="stat-item">
                                                            <span className="stat-label">📝 Words:</span>
                                                            <span className="stat-value">{getAnalysisData().wordCount}</span>
                                                        </div>
                                                        <div className="stat-item">
                                                            <span className="stat-label">⏱️ Reading time:</span>
                                                            <span className="stat-value">{getAnalysisData().readingTime} min</span>
                                                        </div>
                                                        <div className="stat-item">
                                                            <span className="stat-label">📈 Characters:</span>
                                                            <span className="stat-value">{aiSummary.length}</span>
                                                        </div>
                                                        {currentTranscript && (
                                                            <div className="stat-item">
                                                                <span className="stat-label">📜 Original length:</span>
                                                                <span className="stat-value">{Math.round(currentTranscript.length / 1000)}k chars</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="no-data">
                                                        <p>Generate a summary to see analysis</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Tools Dropdown */}
                                    <div className="feature-item">
                                        <button 
                                            className={`feature-btn ${featuresDropdown.activeDropdown === 'tools' ? 'active' : ''}`}
                                            onClick={() => toggleFeaturesDropdown('tools')}
                                        >
                                            🔧 Tools
                                            <span className="dropdown-arrow">
                                                {featuresDropdown.activeDropdown === 'tools' ? '▲' : '▼'}
                                            </span>
                                        </button>
                                        
                                        {featuresDropdown.activeDropdown === 'tools' && (
                                            <div className="dropdown-content">
                                                <div className="tool-options">
                                                    <button 
                                                        className="tool-btn"
                                                        onClick={() => copyToClipboard('ai-summary')}
                                                        disabled={!aiSummary}
                                                    >
                                                        📋 Copy Summary
                                                    </button>
                                                    <button 
                                                        className="tool-btn"
                                                        onClick={() => copyToClipboard('transcript')}
                                                        disabled={!currentTranscript}
                                                    >
                                                        📋 Copy Transcript
                                                    </button>
                                                    <button 
                                                        className="tool-btn"
                                                        onClick={() => {
                                                            setCurrentUrl('');
                                                            setCurrentTranscript('');
                                                            setAiSummary('');
                                                            setCurrentVideoInfo(null);
                                                            showStatus('Workspace cleared!', 'success');
                                                        }}
                                                    >
                                                        🗑️ Clear All
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Templates Dropdown */}
                                    <div className="feature-item">
                                        <button 
                                            className={`feature-btn ${featuresDropdown.activeDropdown === 'templates' ? 'active' : ''}`}
                                            onClick={() => toggleFeaturesDropdown('templates')}
                                        >
                                            📋 Templates
                                            <span className="dropdown-arrow">
                                                {featuresDropdown.activeDropdown === 'templates' ? '▲' : '▼'}
                                            </span>
                                        </button>
                                        
                                        {featuresDropdown.activeDropdown === 'templates' && (
                                            <div className="dropdown-content">
                                                <div className="template-options">
                                                    <button 
                                                        className="template-btn"
                                                        onClick={() => setCurrentUrl('demo')}
                                                    >
                                                        🎬 Demo Video
                                                    </button>
                                                    <button 
                                                        className="template-btn"
                                                        onClick={() => setCurrentUrl('tech-talk')}
                                                    >
                                                        💻 Tech Talk Demo
                                                    </button>
                                                    <button 
                                                        className="template-btn"
                                                        onClick={() => setCurrentUrl('speech')}
                                                    >
                                                        🎤 Speech Demo
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Show Features Button when hidden */}
                        {!featuresDropdown.isVisible && (
                            <button 
                                className="show-features-btn"
                                onClick={toggleFeaturesBox}
                                title="Show features panel"
                            >
                                🛠️
                            </button>
                        )}
                    </div>
                </main>


            </div>
        </div>
    );
};

export default YoutubeAISumTab;