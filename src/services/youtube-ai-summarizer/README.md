# YouTube AI Summarizer Microservice

A self-contained microservice for extracting YouTube video transcripts and generating AI-powered summaries using local LLM models.

## 📁 Structure

```
youtube-ai-summarizer/
├── backend/                 # Node.js backend service
│   ├── server.js           # Main server with transcript extraction
│   └── package.json        # Backend dependencies
├── components/             # React frontend components
│   └── YoutubeAISumTab.js  # Main React component
├── styles/                 # Component styles
│   └── YoutubeAISumTab.css # Styling for the component
├── ApiClient.js           # Frontend API client
├── ServiceManager.js      # Backend service manager
├── index.js              # Main exports
└── README.md             # This file
```

## 🚀 Features

- **YouTube Transcript Extraction**: Multiple extraction methods for maximum compatibility
- **AI-Powered Summaries**: Two modes - detailed and fast summaries
- **Local LLM Integration**: Uses Ollama with Gemma 2 models
- **Task History Sidebar**: Collapsible sidebar with handle for easy access to previous tasks
- **Dual Themes**: Light and dark themes for different environments
- **Responsive Design**: Works on desktop and mobile with adaptive sidebar
- **Copy to Clipboard**: Easy content sharing
- **Real-time Status**: Connection and processing status indicators

## 🛠 Setup

### Backend Service

1. Navigate to the backend directory:
   ```bash
   cd src/services/youtube-ai-summarizer/backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the service:
   ```bash
   npm start
   ```

The backend service will run on `http://localhost:8082`

### Prerequisites

- **Node.js**: Version 14 or higher
- **Ollama**: Local LLM server running on port 11434
- **Gemma 2 Models**: Install required models:
  ```bash
  ollama pull gemma2:9b  # For detailed summaries
  ollama pull gemma2:2b  # For fast summaries
  ```

## 🔧 Configuration

### Backend Port
The service runs on port 8082 by default. To change:
```javascript
// In backend/server.js
const PORT = process.env.PORT || 8082;
```

### API Endpoints

- `GET /api/transcript?videoId={id}` - Extract transcript
- `POST /api/summarize` - Generate AI summary
- `GET /api/health` - Health check

### Frontend Integration

Import and use the component:
```javascript
import { YoutubeAISumTab } from '../services/youtube-ai-summarizer';

// In your component
<YoutubeAISumTab />
```

### UI Controls

**Sidebar Handle:**
- Click the handle (with grip dots) to toggle sidebar visibility
- Handle shows arrow indicators: ◀ (collapse) / ▶ (expand)
- Hover effects provide visual feedback

**Theme Toggle:**
- Located in the header controls
- Switch between Light (☀️) and Dark (🌙) themes
- Theme preference saved in localStorage

## 📝 API Usage

### Extract Transcript
```javascript
const apiClient = new YouTubeAIApiClient();
const result = await apiClient.extractTranscript('VIDEO_ID');
```

### Generate Summary
```javascript
const summary = await apiClient.generateSummary(transcript, 'gemma2:9b');
```

## 🎨 Themes

The component supports two themes:
- **Light**: Clean, professional appearance with light colors
- **Dark**: Dark mode for low-light environments

## 🔒 Security

- CORS enabled for cross-origin requests
- Input validation for YouTube URLs
- Error handling for failed requests
- No sensitive data storage

## 🚨 Troubleshooting

### Service Not Connecting
1. Ensure backend service is running on port 8082
2. Check if Ollama is running on port 11434
3. Verify no port conflicts
4. Check connection status indicator in header (🟢 Connected / 🔴 Disconnected)

### Transcript Extraction Fails
1. YouTube may block automated access
2. Video might not have captions
3. Try demo modes: "demo", "speech", "tech-talk"
4. Verify URL format is correct

### AI Summary Generation Fails
1. Check Ollama service status
2. Ensure required models are installed
3. Verify local LLM server is accessible
4. Try the fast summary mode if detailed mode fails

### UI Issues
1. **Sidebar not responding**: Check if handle is visible and clickable
2. **Theme not switching**: Clear localStorage and refresh
3. **Mobile layout issues**: Ensure viewport meta tag is set
4. **History not saving**: Check browser localStorage permissions

## 📄 Dependencies

### Backend
- `youtube-transcript`: Transcript extraction
- `node-fetch`: HTTP requests
- `cheerio`: HTML parsing

### Frontend
- `React`: UI framework
- Included in Desktop-Hub's dependencies

## 🎛️ User Interface

### Sidebar with Handle Design
- **Collapsible Sidebar**: Task history sidebar that can be collapsed to save space
- **Attached Handle**: Always-visible handle with grip dots for intuitive interaction
- **Smooth Animations**: Professional transitions when opening/closing
- **Mobile Responsive**: Adapts to mobile screens with slide-in behavior

### Task History Management
- **Persistent Storage**: Previous tasks saved in localStorage
- **Quick Access**: Click any history item to reload the URL
- **Status Badges**: Visual indicators for completed AI and fast summaries
- **Clear History**: One-click option to clear all history

## 🤝 Integration

This microservice is designed to work seamlessly with Desktop-Hub:

1. **Self-contained**: All code in dedicated folder
2. **Modular**: Easy to enable/disable
3. **Independent**: Can run standalone
4. **Scalable**: Easy to extend with new features
5. **Modern UI**: Consistent with Desktop-Hub's design language

## 📈 Performance

- **Transcript Extraction**: ~2-5 seconds
- **AI Summary Generation**: ~10-30 seconds (depends on model)
- **Memory Usage**: ~50-100MB for backend service
- **Storage**: Task history stored in localStorage (up to 10 recent tasks)
- **UI Responsiveness**: Smooth 0.3s animations with hardware acceleration