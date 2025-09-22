# Desktop Hub

A Windows desktop application built with Electron and React that provides a tabbed interface for various productivity tools.

## Features

- **Tabbed Interface**: Create multiple tabs with different features
- **Calculator**: Basic mathematical operations
- **Notes**: Rich text editor with auto-save functionality
- **Todo List**: Task management with filters and persistence
- **Timer**: Pomodoro timer with custom presets
- **Weather**: Weather information display (demo with mock data)
- **File Explorer**: Basic file browser (demo with mock data)

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. For production build:
```bash
npm run build
npm run dist
```

## Usage

- Click the **+** button to add new tabs
- Use **Ctrl+T** to create a new tab
- Use **Ctrl+W** to close the current tab
- Switch between tabs by clicking on them
- Each tab maintains its own state and data

## Tab Features

### Calculator
- Basic arithmetic operations
- Clean, responsive interface
- Keyboard and mouse input support

### Notes
- Rich text editing with formatting options
- Auto-save functionality
- Character and word count
- Date insertion

### Todo List
- Add, edit, and delete tasks
- Mark tasks as complete
- Filter by all, active, or completed
- Persistent storage

### Timer
- Pomodoro timer (25 minutes)
- Short break (5 minutes) and long break (15 minutes) presets
- Custom timer settings
- Desktop notifications when timer completes
- Progress visualization

### Weather
- Current weather display (demo with mock data)
- 5-day forecast
- Location search functionality
- Responsive design

### File Explorer
- Navigate through directories (demo with mock data)
- List and grid view modes
- File details panel
- Breadcrumb navigation

## Keyboard Shortcuts

- **Ctrl+T**: New tab
- **Ctrl+W**: Close tab
- **F11**: Toggle fullscreen
- **Ctrl+R**: Reload
- **F12**: Toggle developer tools

## Technology Stack

- **Electron**: Desktop application framework
- **React**: Frontend library
- **CSS3**: Styling with gradients and animations
- **LocalStorage**: Data persistence

## Development

The application is structured as follows:

- `src/main.js`: Electron main process
- `src/App.js`: Main React application
- `src/components/`: React components
- `src/components/tabs/`: Individual tab components
- `public/`: Static assets

## Building for Production

```bash
npm run build-electron
```

This will create a distributable package in the `dist` folder.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details