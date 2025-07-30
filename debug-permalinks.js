#!/usr/bin/env node

// Quick debug script to test permalink updates on a single site
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const execAsync = promisify(exec);

async function debugPermalinks(siteDirectory) {
  console.log(`🔍 Debugging permalink update for: ${siteDirectory}`);
  
  try {
    // Check if directory exists
    if (!fs.existsSync(siteDirectory)) {
      console.log('❌ Directory does not exist');
      return;
    }
    
    // Check if WordPress is installed
    const wpIncludesPath = path.join(siteDirectory, 'wp-includes');
    if (!fs.existsSync(wpIncludesPath)) {
      console.log('❌ WordPress not installed (wp-includes missing)');
      return;
    }
    
    // Check if wp-config.php exists
    const wpConfigPath = path.join(siteDirectory, 'wp-config.php');
    if (!fs.existsSync(wpConfigPath)) {
      console.log('❌ wp-config.php not found');
      return;
    }
    
    console.log('✅ WordPress files found');
    
    // Check if WP-CLI is installed
    try {
      const { stdout } = await execAsync('wp --version');
      console.log(`✅ WP-CLI found: ${stdout.trim()}`);
    } catch (error) {
      console.log('❌ WP-CLI not installed or not in PATH');
      console.log('   Install with: curl -O https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar && chmod +x wp-cli.phar && sudo mv wp-cli.phar /usr/local/bin/wp');
      return;
    }
    
    // Test WP-CLI connection
    try {
      const checkCommand = `cd "${siteDirectory}" && wp core is-installed`;
      await execAsync(checkCommand);
      console.log('✅ WordPress is properly installed and configured');
    } catch (error) {
      console.log('❌ WordPress installation check failed:');
      console.log(`   Error: ${error.message}`);
      console.log('   This usually means database connection issues or incomplete installation');
      return;
    }
    
    // Check current permalink structure
    try {
      const getCurrentCommand = `cd "${siteDirectory}" && wp option get permalink_structure`;
      const { stdout: currentStructure } = await execAsync(getCurrentCommand);
      console.log(`📝 Current permalink structure: "${currentStructure.trim()}"`);
      
      if (currentStructure.trim() === '/%postname%/') {
        console.log('✅ Already using Post name structure');
      } else {
        console.log('⚠️  Not using Post name structure - needs update');
      }
    } catch (error) {
      console.log('❌ Could not check current permalink structure:');
      console.log(`   Error: ${error.message}`);
      return;
    }
    
    // Test permalink update
    try {
      console.log('🔄 Testing permalink update...');
      
      const updateCommand = `cd "${siteDirectory}" && wp rewrite structure "/%postname%/"`;
      const { stdout, stderr } = await execAsync(updateCommand);
      
      if (stderr && !stderr.includes('Success:')) {
        console.log(`⚠️  WP-CLI stderr: ${stderr}`);
      }
      
      console.log('🔄 Flushing rewrite rules...');
      const flushCommand = `cd "${siteDirectory}" && wp rewrite flush`;
      await execAsync(flushCommand);
      
      // Verify the update
      const verifyCommand = `cd "${siteDirectory}" && wp option get permalink_structure`;
      const { stdout: newStructure } = await execAsync(verifyCommand);
      
      if (newStructure.trim() === '/%postname%/') {
        console.log('✅ SUCCESS: Permalink structure updated to Post name');
        console.log('✅ wp-json API should now work');
      } else {
        console.log(`❌ FAILED: Structure is still "${newStructure.trim()}"`);
      }
      
    } catch (error) {
      console.log('❌ Permalink update failed:');
      console.log(`   Error: ${error.message}`);
    }
    
  } catch (error) {
    console.log(`❌ Debug failed: ${error.message}`);
  }
}

// Usage
if (process.argv.length < 3) {
  console.log('Usage: node debug-permalinks.js /path/to/wordpress/site');
  console.log('Example: node debug-permalinks.js /var/www/html/example.com');
  process.exit(1);
}

const siteDir = process.argv[2];
debugPermalinks(siteDir);