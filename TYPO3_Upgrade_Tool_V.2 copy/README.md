# TYPO3 Upgrade Analysis Tool

A modern web application for analyzing TYPO3 installations and planning upgrade paths. This tool helps you understand compatibility issues, required changes, and provides step-by-step upgrade instructions.

## Features

- 🔍 Site Analysis: Scan your TYPO3 installation for compatibility issues
- 📊 Extension Compatibility Check: Verify extension compatibility with target versions
- 🛣️ Upgrade Path Generation: Get detailed upgrade paths with step-by-step instructions
- 📦 Package Management: Integration with Packagist for extension information
- 📱 Responsive Design: Works on desktop and mobile devices

## Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (version 16.x or higher)
- npm (version 8.x or higher)
- Git

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/typo3-upgrade-tool.git
cd typo3-upgrade-tool
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory:
```bash
cp .env.example .env
```

## Configuration

1. Open the `.env` file and configure the following variables:
```env
VITE_API_URL=your_api_url
VITE_PACKAGIST_API_URL=https://packagist.org/p2
```

## Development

To start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## Building for Production

1. Create a production build:
```bash
npm run build
```

2. Preview the production build:
```bash
npm run preview
```

## Project Structure

```
typo3-upgrade-tool/
├── src/                    # Source files
│   ├── components/         # React components
│   ├── lib/               # Utility functions and API calls
│   └── assets/            # Static assets
├── public/                 # Public static files
├── index.html             # Entry HTML file
├── vite.config.js         # Vite configuration
└── package.json           # Project dependencies and scripts
```

## Key Components

- `TYPO3Analysis`: Main analysis component
- `TYPO3UpgradeTool`: Upgrade path generator
- `ProjectAnalysisResults`: Results display
- `Contact`: Contact form and information

## Proxy Configuration

The application uses Vite's proxy configuration to handle CORS issues with the Packagist API. This is configured in `vite.config.js`:

```javascript
export default defineConfig({
  server: {
    proxy: {
      '/api/packagist': {
        target: 'https://packagist.org/p2',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/packagist/, '')
      }
    }
  }
})
```

## Troubleshooting

### Common Issues

1. **CORS Errors**
   - Ensure the proxy configuration is correct in `vite.config.js`
   - Check if the API endpoints are accessible

2. **Build Errors**
   - Clear the `node_modules` folder and run `npm install` again
   - Make sure all dependencies are installed: `npm install`

3. **Runtime Errors**
   - Check the browser console for specific error messages
   - Verify environment variables are set correctly

### Solutions

If you encounter issues:

1. Clean installation:
```bash
rm -rf node_modules
rm -rf dist
npm install
```

2. Clear Vite cache:
```bash
npm run clean
```

3. Update dependencies:
```bash
npm update
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Submit a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, please:
- Open an issue in the GitHub repository
- Contact us through the Contact form in the application
- Email us at contact@typo3upgrade.tool

## Acknowledgments

- TYPO3 Community
- Packagist API
- React and Vite teams
- All contributors to this project
