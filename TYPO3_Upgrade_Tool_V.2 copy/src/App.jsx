// src/App.jsx
import { useState } from 'react';
import TYPO3UpgradeTool from "./components/TYPO3UpgradeTool";
import { TYPO3VersionInfo } from "./components/TYPO3VersionInfo";
import TYPO3Analysis from "./components/TYPO3Analysis";
import Homepage from "./components/Homepage";

function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [currentVersion, setCurrentVersion] = useState('');
  const [targetVersion, setTargetVersion] = useState('');
  const [upgradeMethod, setUpgradeMethod] = useState('console');
  const [extensions, setExtensions] = useState([]);

  const handleShowSteps = (current, target, method, extList = []) => {
    setCurrentVersion(current);
    setTargetVersion(target);
    setUpgradeMethod(method);
    setExtensions(extList);
    setActiveTab('path');
  };

  const handleNavigate = (tab) => {
    setActiveTab(tab);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return <Homepage onNavigate={handleNavigate} />;
      case 'versions':
        return <TYPO3VersionInfo />;
      case 'path':
        return <TYPO3UpgradeTool 
          initialCurrentVersion={currentVersion} 
          initialTargetVersion={targetVersion} 
          upgradeMethod={upgradeMethod}
          extensions={extensions}
        />;
      case 'analysis':
        return <TYPO3Analysis onShowSteps={handleShowSteps} />;
      default:
        return <Homepage onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="min-h-screen bg-orange-50">
      <header className="bg-[rgb(249,115,22)] text-white shadow-md">
        <div className="container mx-auto px-4 py-5">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold">TYPO3 Upgrade Tool</h1>
              <p className="text-white mt-1">Analyze and prepare your TYPO3 upgrades with ease</p>
            </div>
          </div>
          
          <div className="mt-8 flex bg-white/20 backdrop-blur-sm rounded-lg p-1">
            <button 
              onClick={() => setActiveTab('home')}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'home' ? 'bg-white text-[rgb(249,115,22)]' : 'text-white hover:bg-white/10'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              Home
            </button>
            <button 
              onClick={() => setActiveTab('versions')}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'versions' ? 'bg-white text-[rgb(249,115,22)]' : 'text-white hover:bg-white/10'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <rect width="7" height="7" x="3" y="3" rx="1" />
                <rect width="7" height="7" x="14" y="3" rx="1" />
                <rect width="7" height="7" x="14" y="14" rx="1" />
                <rect width="7" height="7" x="3" y="14" rx="1" />
              </svg>
              Versions
            </button>
            <button 
              onClick={() => setActiveTab('path')}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'path' ? 'bg-white text-[rgb(249,115,22)]' : 'text-white hover:bg-white/10'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="M14 3v4a1 1 0 0 0 1 1h4" />
                <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z" />
                <path d="m10 13-2 2 2 2" />
                <path d="m14 17 2-2-2-2" />
              </svg>
              Path
            </button>
            <button 
              onClick={() => setActiveTab('analysis')}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'analysis' ? 'bg-white text-[rgb(249,115,22)]' : 'text-white hover:bg-white/10'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <path d="M3 3v18h18" />
                <path d="m19 9-5 5-4-4-3 3" />
              </svg>
              Analysis
            </button>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-8 space-y-8">
        {renderContent()}
      </main>
      
      <footer className="bg-[rgb(249,115,22)] text-white mt-12">
        <div className="container mx-auto px-4 py-4 text-center text-sm">
          &copy; {new Date().getFullYear()} Macopedia | Data from TYPO3 API
        </div>
      </footer>
    </div>
  );
}

export default App;
