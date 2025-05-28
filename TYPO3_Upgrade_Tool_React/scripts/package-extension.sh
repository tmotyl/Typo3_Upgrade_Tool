#!/bin/bash

# Variables
EXT_NAME="typo3_upgrade_analyzer"
EXT_DIR="public/$EXT_NAME"
TARGET_DIR="dist"
TIMESTAMP=$(date +"%Y%m%d%H%M%S")
ZIP_FILE="$TARGET_DIR/${EXT_NAME}_${TIMESTAMP}.zip"

# Create dist directory if it doesn't exist
mkdir -p $TARGET_DIR

# Package the extension
echo "Packaging extension: $EXT_NAME"
cd public
zip -r ../$ZIP_FILE $EXT_NAME -x "*.git*" -x "*.DS_Store"
cd ..

echo "Extension packaged successfully: $ZIP_FILE"

# Output download link
CURRENT_URL=$(pwd)
echo "Download URL: file://$CURRENT_URL/$ZIP_FILE"

# Instructions
echo ""
echo "Installation Instructions:"
echo "-------------------------"
echo "1. Upload and install this extension in your TYPO3 installation"
echo "2. Log in to TYPO3 backend as administrator"
echo "3. Use the toolbar icon to collect and download site data"
echo "4. Upload the data to the TYPO3 Upgrade Tool for analysis" 