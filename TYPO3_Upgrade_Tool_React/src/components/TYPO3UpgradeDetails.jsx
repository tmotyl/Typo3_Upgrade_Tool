import { useEffect, useState } from "react";
import { ArrowLeft, Check, HelpCircle, Info, Terminal, Database, Files, Server } from "lucide-react";

export default function TYPO3UpgradeDetails({ version, onBack }) {
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!version) return;

    const generatedSteps = [
      {
        id: 1,
        title: "Preparation",
        description: "Prepare your environment before upgrading",
        tasks: [
          { text: "Backup your database", icon: <Database size={16} /> },
          { text: "Backup all files", icon: <Files size={16} /> },
          { text: "Check system requirements", icon: <Server size={16} /> },
          { text: `Ensure PHP ${version.requirements.php} is installed`, icon: <Terminal size={16} /> },
          { text: `Ensure MySQL ${version.requirements.mysql} is available`, icon: <Database size={16} /> },
        ]
      },
      {
        id: 2,
        title: "Update Dependencies",
        description: "Update Composer dependencies",
        tasks: [
          { text: "Update composer.json to require new TYPO3 version", icon: <Terminal size={16} /> },
          { text: `Run composer require typo3/cms-core:^${version.version} -W`, icon: <Terminal size={16} /> },
          { text: "Run composer update", icon: <Terminal size={16} /> },
        ]
      },
      {
        id: 3,
        title: "Database Updates",
        description: "Update your database structure",
        tasks: [
          { text: "Run TYPO3 Install Tool at /typo3/install.php", icon: <Info size={16} /> },
          { text: "Execute database comparison", icon: <Database size={16} /> },
          { text: "Update database schema", icon: <Database size={16} /> },
        ]
      },
      {
        id: 4,
        title: "Clear Cache",
        description: "Clear all caches",
        tasks: [
          { text: "Clear all caches in Install Tool", icon: <Terminal size={16} /> },
          { text: "Run TYPO3 cache:flush command", icon: <Terminal size={16} /> },
          { text: "Clear frontend and backend caches", icon: <Info size={16} /> },
        ]
      },
      {
        id: 5,
        title: "Extension Compatibility",
        description: "Check and update extensions",
        tasks: [
          { text: "Check extension compatibility with the new version", icon: <HelpCircle size={16} /> },
          { text: "Update extensions if needed", icon: <Terminal size={16} /> },
          { text: "Disable incompatible extensions", icon: <Info size={16} /> },
        ]
      },
      {
        id: 6,
        title: "Post-Upgrade Tasks",
        description: "Final steps after upgrading",
        tasks: [
          { text: "Check deprecation logs", icon: <Files size={16} /> },
          { text: "Update TypoScript if needed", icon: <Files size={16} /> },
          { text: "Test website functionality", icon: <Check size={16} /> },
          { text: "Check for breaking changes in new version", icon: <Info size={16} /> },
        ]
      }
    ];

    if (version.db_changes) {
      generatedSteps.push({
        id: 7,
        title: "Database Migration",
        description: "This version requires specific database changes",
        tasks: [
          { text: "Run database schema analyzer in Install Tool", icon: <Database size={16} /> },
          { text: "Apply all suggested database changes", icon: <Database size={16} /> },
          { text: "Check for database migrations specific to this version", icon: <Info size={16} /> },
        ]
      });
    }

    if (version.install_tool_migrations) {
      generatedSteps.push({
        id: 8,
        title: "Install Tool Migrations",
        description: "Run specific Install Tool migrations",
        tasks: [
          { text: "Access Install Tool > Upgrade Wizard", icon: <Terminal size={16} /> },
          { text: "Run all available upgrade wizards", icon: <Terminal size={16} /> },
          { text: "Verify all upgrades are complete", icon: <Check size={16} /> },
        ]
      });
    }


    const sortedSteps = [...generatedSteps].sort((a, b) => a.id - b.id);

    setTimeout(() => {
      setSteps(sortedSteps);
      setLoading(false);
    }, 500);
  }, [version]);

  if (!version) return null;

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <header className="typo3-header mb-6">
        <div className="container mx-auto">
          <div className="flex items-center">
            <button 
              onClick={onBack}
              className="mr-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="typo3-logo">Upgrade Guide: TYPO3 {version.version}</h1>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">Version Information</h2>
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <span className={`inline-flex items-center justify-center px-2 py-1 rounded-full text-xs font-medium typo3-badge-${version.type}`}>
                    {version.type.toUpperCase()}
                  </span>
                  <span>Release Type</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary"></span>
                  <span>Released: {new Date(version.release_date).toLocaleDateString()}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  <span>Active Support Until: {version.support.active_until}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                  <span>Security Support Until: {version.support.security_until}</span>
                </li>
              </ul>
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-4">System Requirements</h2>
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary"></span>
                  <span>PHP: {version.requirements.php}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary"></span>
                  <span>MySQL: {version.requirements.mysql}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary"></span>
                  <span>Composer: {version.requirements.composer}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-6">Upgrade Steps</h2>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {steps.map((step, index) => (
              <div key={step.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">{step.title}</h3>
                      <p className="text-gray-600">{step.description}</p>
                    </div>
                  </div>
                  <ul className="space-y-3 mt-4 pl-12">
                    {step.tasks.map((task, taskIndex) => (
                      <li key={taskIndex} className="flex items-center gap-2">
                        <div className="text-primary">{task.icon}</div>
                        <span>{task.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Warning box */}
        <div className="mt-8 bg-yellow-50 border-l-4 border-yellow-400 p-5 rounded-md">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <Info className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Important Note</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  These upgrade steps are general guidelines. Always refer to the official 
                  <a 
                    href={`https://docs.typo3.org/m/typo3/guide-installation/main/en-us/Upgrade/Index.html`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="font-medium underline"
                  > TYPO3 upgrade documentation </a> 
                  for version-specific instructions. Make sure to create full backups before starting the upgrade process.
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Troubleshooting section */}
        <div className="mt-8 bg-red-50 border border-red-200 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-red-700 mb-3">Common Upgrade Issues</h3>
          
          <div className="space-y-4">
            <div className="bg-white p-4 rounded border border-red-100">
              <h4 className="font-medium text-red-700 mb-2">503 Error - Database Schema Issue</h4>
              <p className="text-sm text-gray-600 mb-3">
                If you encounter a 503 error with message "Incorrect integer value: 'info' for column 'level' at row 1",
                you need to manually fix the <code className="bg-gray-100 text-red-600 px-1 py-0.5 rounded">sys_log</code> table schema.
              </p>
              <div className="bg-gray-800 p-3 rounded">
                <pre className="text-sm text-green-400 overflow-x-auto">
                  ALTER TABLE sys_log MODIFY level int(1) unsigned DEFAULT '0' NOT NULL;
                </pre>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Run this SQL query in phpMyAdmin or another database management tool, then clear all caches.
              </p>
            </div>
            
            <div className="bg-white p-4 rounded border border-red-100">
              <h4 className="font-medium text-red-700 mb-2">Upgrade Wizard Error - be_users lang column</h4>
              <p className="text-sm text-gray-600 mb-3">
                If you encounter an error during the upgrade wizard with message "Data too long for column 'lang' at row 1",
                you need to increase the size of the <code className="bg-gray-100 text-red-600 px-1 py-0.5 rounded">lang</code> column in the be_users table.
              </p>
              <div className="bg-gray-800 p-3 rounded">
                <pre className="text-sm text-green-400 overflow-x-auto">
                  ALTER TABLE be_users MODIFY lang varchar(20) DEFAULT '' NOT NULL;
                </pre>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Run this SQL query in phpMyAdmin or another database management tool, then retry the upgrade wizard.
              </p>
            </div>
            
            <div className="bg-white p-4 rounded border border-red-100">
              <h4 className="font-medium text-red-700 mb-2">Can't Access Backend After Upgrade</h4>
              <p className="text-sm text-gray-600 mb-3">
                If you can't access the TYPO3 backend after upgrading, try clearing all caches and fixing file permissions.
              </p>
              <div className="bg-gray-800 p-3 rounded">
                <pre className="text-sm text-green-400 overflow-x-auto">
                  rm -rf typo3temp/var/cache/*
                </pre>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded border border-red-100">
              <h4 className="font-medium text-red-700 mb-2">Extension Compatibility Issues</h4>
              <p className="text-sm text-gray-600 mb-3">
                If extensions are causing issues after upgrade, try disabling them temporarily and re-enabling one by one.
                Check for updated versions of problematic extensions that support your new TYPO3 version.
              </p>
              <div className="bg-gray-800 p-3 rounded">
                <pre className="text-sm text-green-400 overflow-x-auto">
                  # Check why a package conflicts with your TYPO3 version
                  composer prohibits typo3/cms-core ^11.5
                </pre>
              </div>
            </div>
          </div>
        </div>

        {/* Back button */}
        <div className="mt-8 text-center">
          <button 
            onClick={onBack}
            className="inline-flex items-center px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md transition-colors"
          >
            <ArrowLeft size={16} className="mr-2" />
            Back to Version List
          </button>
        </div>
      </div>
    </div>
  );
} 