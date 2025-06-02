import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();

// Enable CORS for development
app.use(cors());

// Configure axios defaults
const typo3Api = axios.create({
  baseURL: 'https://get.typo3.org/api/v1/',
  timeout: 10000,
  headers: {
    'Accept': 'application/json',
    'User-Agent': 'TYPO3-Upgrade-Tool'
  }
});

// Proxy endpoint for TYPO3 major versions
app.get('/api/typo3/:version', async (req, res) => {
  try {
    const version = req.params.version;
    console.log(`Fetching TYPO3 version ${version}...`);
    
    const response = await typo3Api.get(`major/${version}`);
    console.log(`Got response for version ${version}`);
    
    res.json(response.data);
  } catch (error) {
    console.error(`Error fetching TYPO3 version ${req.params.version}:`, error.message);
    if (error.response) {
      console.error('Error response:', error.response.data);
    }
    res.status(500).json({ 
      error: `Failed to fetch TYPO3 version ${req.params.version}`,
      details: error.message,
      response: error.response?.data
    });
  }
});

// Proxy endpoint for specific TYPO3 minor versions
app.get('/api/typo3/:major/:minor', async (req, res) => {
  try {
    const { major, minor } = req.params;
    console.log(`Fetching TYPO3 version ${major}.${minor}...`);
    
    // First try the new API endpoint structure
    try {
      const response = await typo3Api.get(`release/${major}/${minor}`);
      console.log(`Got response for version ${major}.${minor} from new API endpoint`);
      res.json(response.data);
      return;
    } catch (newApiError) {
      console.log(`New API endpoint failed, trying legacy endpoint: ${newApiError.message}`);
      
      // Try legacy API endpoint
      try {
        const legacyResponse = await typo3Api.get(`json/releases/ter/full`);
        const version = `${major}.${minor}`;
        
        if (legacyResponse.data[version]) {
          console.log(`Got response from legacy API endpoint`);
          res.json(legacyResponse.data[version]);
          return;
        }
      } catch (legacyError) {
        console.error('Legacy API endpoint also failed:', legacyError.message);
        throw legacyError;
      }
      
      // If both attempts fail, throw the original error
      throw newApiError;
    }
  } catch (error) {
    console.error(`Error fetching TYPO3 version ${major}.${minor}:`, error.message);
    if (error.response) {
      console.error('Error response:', error.response.data);
    }
    res.status(500).json({ 
      error: 'Failed to fetch TYPO3 version information', 
      details: error.message,
      version: `${req.params.major}.${req.params.minor}`
    });
  }
});

// Start the server
const port = 3000;
app.listen(port, () => {
  console.log(`Proxy server running on http://localhost:${port}`);
}); 