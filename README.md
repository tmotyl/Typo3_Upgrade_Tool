# TYPO3 Upgrade Analysis Tool & Project Export Extension

A modern solution for analyzing TYPO3 installations, planning upgrade paths, and exporting project data for seamless upgrades.

---

## Overview

This project consists of two main parts:

1. **TYPO3 Upgrade Analysis Tool (React App):**  
   A web application that helps you analyze your TYPO3 installation, check extension compatibility, and generate step-by-step upgrade instructions.

2. **Project Export TYPO3 Extension:**  
   A TYPO3 extension that exports detailed project data (TYPO3 version, PHP version, database info, installed extensions, etc.) as JSON, which can be analyzed by the React app.

---

## Features

### React App

- 🛠️ **Site Analysis:** Scan your TYPO3 installation for compatibility issues.
- 📊 **Extension Compatibility Check:** Verify extension compatibility with target TYPO3 versions.
- 🛣️ **Upgrade Path Generation:** Get detailed, step-by-step upgrade instructions.
- 📦 **Package Management:** Integration with Packagist for extension information.
- 📱 **Responsive Design:** Works on desktop and mobile devices.

### TYPO3 Extension

- 📤 **Project Data Export:** Exports TYPO3 system and extension data as JSON.
- 🔒 **Admin-Only Access:** Only backend admins can export data.
- 🛠️ **Easy Integration:** Simple module in the TYPO3 backend.

---

## Getting Started

### 1. TYPO3 Extension: Project Export

**Purpose:**  
Exports project data (TYPO3 version, PHP version, database, extensions, etc.) as JSON for analysis.

**Installation:**

- Copy the `project_export` folder to your TYPO3 `typo3conf/ext/` directory.
- Activate the extension in the TYPO3 Extension Manager.
- If encountering any problems, add the path to the repository in the root composer.json file:
  ```
  "require": {
  	"vendor/project-export": "*"
	},
  "repositories": [
	{
		"type": "path",
		"url": "public/typo3conf/ext/project_export"
	}
  ],
  ```
- run composer update command:
```bash
	composer update
```
- run require composer command:
```bash
	composer require vendor/project-export:*
```
- flush cache via command prompt or backend Maintenance panel:
```bash
  	./vendor/bin/typo3 cache:flush
```

---

**Usage:**

- Log in to the TYPO3 backend as an admin.
- Go to the **System > Project Upgrade Support** module.
- Click "Export" to download a JSON file with your project data.

**Technical Details:**

- **Main Controller:** `ExportController.php`
- **Exports:** TYPO3 version, PHP version, database info, web server info, installed extensions, export timestamp, and exporting user.
- **Access:** Only backend admins can export data.

---

### 2. React App: TYPO3 Upgrade Tool

**Installation:**

1. Clone the repository:
   ```bash
   git clone https://github.com/tmotyl/Typo3_Upgrade_Tool.git
   cd Typo3_Upgrade_Tool/
   ```
2. Open Website Folder:
   ```bash
	cd TYPO3_Upgrade_Tool_React/
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
**Development:**

Start Proxy Server
```bash
    node src/server/proxy.js   
```

```bash
    npm run dev
```
App runs at `http://localhost:5173`

**Build for Production:**

```bash
    npm run build
    npm run preview
```
App runs at `http://localhost:4173`

---

## How They Work Together

1. **Export Data:**  
   Use the TYPO3 extension to export your project’s data as a JSON file.

2. **Analyze & Plan:**  
   Upload the JSON file in the React app to analyze your installation, check extension compatibility, and generate an upgrade path.

---

## License

- React App: MIT License
- TYPO3 Extension: GPL-2.0-or-later

---

## Acknowledgments

- TYPO3 Community
- Packagist API
- React, Vite, and TYPO3 teams
- All contributors
