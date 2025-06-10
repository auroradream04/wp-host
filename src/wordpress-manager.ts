import * as fs from 'fs-extra';
import * as path from 'path';
import fetch from 'node-fetch';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Extract } from 'unzipper';
import inquirer from 'inquirer';
import { Config, SiteConfig, DeploymentResult } from './types';

export class WordPressManager {
  private config: Config;
  private readonly WORDPRESS_DOWNLOAD_URL = 'https://wordpress.org/latest.zip';

  constructor(config: Config) {
    this.config = config;
  }

  /**
   * Download and install WordPress for all sites
   */
  async installAllSites(autoCleanDirectories: boolean = false): Promise<DeploymentResult[]> {
    console.log(`\n🌐 Starting WordPress installation for ${this.config.sites.length} site(s)...`);
    
    const results: DeploymentResult[] = [];

    for (let i = 0; i < this.config.sites.length; i++) {
      const site = this.config.sites[i];
      console.log(`\n📦 [${i + 1}/${this.config.sites.length}] Installing WordPress: ${site.site_name}`);
      
      try {
        const result = await this.installWordPressSite(site, autoCleanDirectories);
        results.push(result);
        
        if (result.status === 'success') {
          console.log(`✅ ${site.site_name}: WordPress installation completed successfully`);
        } else {
          console.log(`⚠️  ${site.site_name}: WordPress installation completed with warnings`);
        }
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`❌ ${site.site_name}: WordPress installation failed - ${errorMessage}`);
        
        results.push({
          site_name: site.site_name,
          status: 'failed',
          errors: [errorMessage]
        });
      }
    }

    return results;
  }

  /**
   * Install WordPress for a single site
   */
  async installWordPressSite(site: SiteConfig, autoCleanDirectories: boolean = false): Promise<DeploymentResult> {
    const targetDir = path.resolve(site.directory_path);
    
    console.log(`   Target Directory: ${targetDir}`);

    try {
      // Step 1: Prepare directory
              await this.prepareDirectory(targetDir, autoCleanDirectories ? 'auto' : true);

      // Step 2: Download WordPress
      const tempZipPath = await this.downloadWordPress(targetDir);

      // Step 3: Extract WordPress
      await this.extractWordPress(tempZipPath, targetDir);

      // Step 4: Clean up temp files
      await fs.remove(tempZipPath);

      // Step 5: Verify installation
      const isValid = await this.verifyInstallation(targetDir);
      if (!isValid) {
        throw new Error('WordPress installation verification failed');
      }

      // Step 6: Generate site URL and create wp-config.php
      const siteUrl = this.generateSiteUrl(targetDir);
      await this.createWordPressConfig(site, targetDir, siteUrl);

      // Step 7: Set proper file permissions
      await this.setWordPressPermissions(targetDir);

      // Step 8: Complete WordPress installation (setup wizard)
      await this.completeWordPressInstallation(site, siteUrl);

      return {
        site_name: site.site_name,
        status: 'success',
        wordpress_path: targetDir,
        wordpress_info: {
          site_url: siteUrl,
          admin_user: site.wordpress_admin_username || 'admin',
          admin_password: this.config.wordpress.adminPassword,
          admin_email: this.config.wordpress.adminEmail
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`WordPress installation failed: ${errorMessage}`);
    }
  }

  /**
   * Safely clean directory, handling special files like .user.ini
   */
  private async safeCleanDirectory(targetDir: string): Promise<void> {
    try {
      const files = await fs.readdir(targetDir);
      
      for (const file of files) {
        const filePath = path.join(targetDir, file);
        
        try {
          const stats = await fs.lstat(filePath);
          
          if (stats.isDirectory()) {
            await fs.remove(filePath);
          } else {
            // Handle special files that might have restricted permissions
            try {
              await fs.remove(filePath);
            } catch (fileError) {
              // If we can't delete a file (like .user.ini), try to change permissions first
              try {
                await fs.chmod(filePath, 0o666);
                await fs.remove(filePath);
              } catch (permError) {
                console.log(`   ⚠️  Could not remove ${file} (system file, skipping)`);
                // Some files like .user.ini might be protected by the system
                // We'll skip them and let WordPress work around them
              }
            }
          }
        } catch (statError) {
          console.log(`   ⚠️  Could not access ${file}, skipping`);
        }
      }
    } catch (error) {
      throw new Error(`Failed to clean directory: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Prepare directory for WordPress installation
   */
  async prepareDirectory(targetDir: string, allowCleanup: boolean | 'auto' = false): Promise<void> {
    console.log(`   📁 Preparing directory...`);

    // Check if directory exists and is writable
    try {
      await fs.ensureDir(targetDir);
      
      // Check if directory is empty or contains only hidden files
      const files = await fs.readdir(targetDir);
      const visibleFiles = files.filter(file => !file.startsWith('.'));
      
      if (visibleFiles.length > 0) {
        // Check if it's already a WordPress installation
        const wpConfigExists = await fs.pathExists(path.join(targetDir, 'wp-config.php'));
        const wpIncludesExists = await fs.pathExists(path.join(targetDir, 'wp-includes'));
        
        if (wpConfigExists || wpIncludesExists) {
          console.log(`   ⚠️  WordPress already exists in ${targetDir}`);
          
                  if (allowCleanup) {
          if (allowCleanup !== 'auto') {
            const { confirmOverwrite } = await inquirer.prompt([{
              type: 'confirm',
              name: 'confirmOverwrite',
              message: `⚠️  WordPress already exists in ${targetDir}. Overwrite existing installation?`,
              default: false
            }]);
            
            if (!confirmOverwrite) {
              throw new Error('WordPress already installed in target directory');
            }
          }
            
            console.log(`   🧹 Removing existing WordPress installation...`);
            await this.safeCleanDirectory(targetDir);
            console.log(`   ✅ Directory cleaned successfully`);
            return;
          }
          
          throw new Error('WordPress already installed in target directory');
        }
        
        console.log(`   ⚠️  Directory not empty: ${targetDir}`);
        console.log(`   📁 Files found: ${visibleFiles.slice(0, 5).join(', ')}${visibleFiles.length > 5 ? '...' : ''}`);
        
        if (allowCleanup) {
          if (allowCleanup !== 'auto') {
            const { confirmCleanup } = await inquirer.prompt([{
              type: 'confirm',
              name: 'confirmCleanup',
              message: `⚠️  Directory ${targetDir} is not empty. Remove all files and continue?`,
              default: false
            }]);
            
            if (!confirmCleanup) {
              throw new Error('Target directory is not empty');
            }
          }
          
                      console.log(`   🧹 Cleaning directory...`);
            await this.safeCleanDirectory(targetDir);
            console.log(`   ✅ Directory cleaned successfully`);
        } else {
          throw new Error('Target directory is not empty');
        }
      }

      // Test write permissions
      const testFile = path.join(targetDir, '.write-test');
      await fs.writeFile(testFile, 'test');
      await fs.remove(testFile);
      
      console.log(`   ✅ Directory prepared successfully`);

    } catch (error) {
      if (error instanceof Error && error.message.includes('WordPress already installed')) {
        throw error;
      }
      if (error instanceof Error && error.message.includes('not empty')) {
        throw error;
      }
      throw new Error(`Cannot prepare directory ${targetDir}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Download WordPress from wordpress.org
   */
  async downloadWordPress(targetDir: string): Promise<string> {
    console.log(`   ⬇️  Downloading WordPress...`);
    
    const tempZipPath = path.join(targetDir, 'wordpress-temp.zip');

    try {
      const response = await fetch(this.WORDPRESS_DOWNLOAD_URL);
      
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Download response body is empty');
      }

      const fileStream = createWriteStream(tempZipPath);
      await pipeline(response.body, fileStream);

      // Verify the download
      const stats = await fs.stat(tempZipPath);
      if (stats.size < 1000000) { // Less than 1MB suggests download failed
        throw new Error('Downloaded file appears to be incomplete');
      }

      console.log(`   ✅ WordPress downloaded (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
      return tempZipPath;

    } catch (error) {
      // Clean up partial download
      if (await fs.pathExists(tempZipPath)) {
        await fs.remove(tempZipPath);
      }
      throw new Error(`WordPress download failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Extract WordPress ZIP file
   */
  async extractWordPress(zipPath: string, targetDir: string): Promise<void> {
    console.log(`   📦 Extracting WordPress...`);

    try {
      // Extract to temporary directory first
      const tempExtractDir = path.join(targetDir, 'temp-extract');
      await fs.ensureDir(tempExtractDir);

      // Use a more robust extraction method with proper error handling
      await new Promise<void>((resolve, reject) => {
        const readStream = fs.createReadStream(zipPath);
        const extractStream = Extract({ path: tempExtractDir });

        readStream.pipe(extractStream);

        extractStream.on('close', () => {
          console.log(`   📦 ZIP extraction completed`);
          resolve();
        });

        extractStream.on('error', (error) => {
          console.error(`   ❌ Extraction error: ${error.message}`);
          reject(error);
        });

        readStream.on('error', (error) => {
          console.error(`   ❌ Read error: ${error.message}`);
          reject(error);
        });

        // Add timeout for extraction
        setTimeout(() => {
          reject(new Error('ZIP extraction timeout after 60 seconds'));
        }, 60000);
      });

      // WordPress ZIP contains a 'wordpress' folder, we need to move its contents
      const wordpressDir = path.join(tempExtractDir, 'wordpress');
      
      if (!await fs.pathExists(wordpressDir)) {
        throw new Error('WordPress folder not found in extracted ZIP');
      }

      // Move WordPress files to target directory
      const files = await fs.readdir(wordpressDir);
      console.log(`   📁 Moving ${files.length} WordPress files...`);
      
      for (const file of files) {
        const srcPath = path.join(wordpressDir, file);
        const destPath = path.join(targetDir, file);
        await fs.move(srcPath, destPath);
      }

      // Clean up temporary extraction directory and ZIP file
      await fs.remove(tempExtractDir);
      await fs.remove(zipPath);

      console.log(`   ✅ WordPress extracted successfully`);

    } catch (error) {
      // Clean up on error
      const tempExtractDir = path.join(targetDir, 'temp-extract');
      if (await fs.pathExists(tempExtractDir)) {
        await fs.remove(tempExtractDir);
      }
      
      throw new Error(`WordPress extraction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate site URL based on directory path and domain inference
   */
  private generateSiteUrl(targetDir: string): string {
    // Try to infer domain from directory structure
    const normalizedPath = path.resolve(targetDir);
    
    // Common hosting patterns
    if (normalizedPath.includes('/var/www/')) {
      // Extract site name from path
      const pathParts = normalizedPath.split('/');
      const wwwIndex = pathParts.indexOf('www');
      
      if (wwwIndex >= 0 && pathParts.length > wwwIndex + 1) {
        const siteName = pathParts[wwwIndex + 1];
        
        // Remove 'html' if it's part of the path
        if (siteName === 'html' && pathParts.length > wwwIndex + 2) {
          const actualSiteName = pathParts[wwwIndex + 2];
          return `https://${actualSiteName}`;
        } else {
          return `https://${siteName}`;
        }
      }
    }
    
    // Extract domain from directory name as fallback
    const dirName = path.basename(normalizedPath);
    
    // If directory name looks like a domain (contains dots)
    if (dirName.includes('.')) {
      return `https://${dirName}`;
    }
    
    // If directory name is clean, add .com
    if (dirName && dirName !== 'html' && dirName !== 'public_html') {
      return `https://${dirName}.com`;
    }
    
    // Last resort fallback
    return `https://localhost`;
  }

  /**
   * Complete WordPress installation by calling the installation API
   */
  async completeWordPressInstallation(site: SiteConfig, siteUrl: string): Promise<void> {
    console.log(`   🔧 Completing WordPress setup wizard...`);

    try {
      const installUrl = `${siteUrl}/wp-admin/install.php?step=2`;
      
      const installData = new URLSearchParams({
        weblog_title: site.wordpress_site_title || 'WordPress Site',
        user_name: site.wordpress_admin_username || 'admin',
        admin_password: this.config.wordpress.adminPassword,
        admin_password2: this.config.wordpress.adminPassword,
        admin_email: this.config.wordpress.adminEmail,
        blog_public: '0', // Don't index by search engines during setup
        Submit: 'Install WordPress'
      });

      const response = await fetch(installUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'WordPress-Automation-Tool/1.0'
        },
        body: installData.toString()
      });

      if (response.ok) {
        console.log(`   ✅ WordPress setup completed successfully`);
        console.log(`   🌐 Site URL: ${siteUrl}`);
        console.log(`   👤 Admin Login: ${siteUrl}/wp-admin/`);
      } else {
        console.log(`   ⚠️  WordPress setup may need manual completion`);
        console.log(`   🌐 Visit: ${siteUrl}/wp-admin/install.php`);
      }

    } catch (error) {
      console.log(`   ⚠️  WordPress setup automation failed, manual setup required`);
      console.log(`   🌐 Visit: ${siteUrl}/wp-admin/install.php`);
      console.log(`   📝 Site Title: ${site.wordpress_site_title || 'WordPress Site'}`);
      console.log(`   👤 Username: ${site.wordpress_admin_username || 'admin'}`);
    }
  }

  /**
   * Verify WordPress installation
   */
  async verifyInstallation(targetDir: string): Promise<boolean> {
    console.log(`   🔍 Verifying WordPress installation...`);

    try {
      // Check for essential WordPress files
      const requiredFiles = [
        'index.php',
        'wp-blog-header.php',
        'wp-config-sample.php',
        'wp-includes/version.php'
      ];

      for (const file of requiredFiles) {
        const filePath = path.join(targetDir, file);
        if (!await fs.pathExists(filePath)) {
          console.log(`   ❌ Missing required file: ${file}`);
          return false;
        }
      }

      // Check WordPress version
      const versionFile = path.join(targetDir, 'wp-includes', 'version.php');
      const versionContent = await fs.readFile(versionFile, 'utf8');
      const versionMatch = versionContent.match(/\$wp_version\s*=\s*['"]([^'"]+)['"]/);
      
      if (versionMatch) {
        console.log(`   ✅ WordPress ${versionMatch[1]} verified successfully`);
      } else {
        console.log(`   ✅ WordPress installation verified (version unknown)`);
      }

      return true;

    } catch (error) {
      console.log(`   ❌ Verification failed: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Check WordPress installation status for a site
   */
  async checkInstallation(site: SiteConfig): Promise<{
    exists: boolean;
    isWordPress: boolean;
    version?: string;
    hasConfig: boolean;
  }> {
    const targetDir = path.resolve(site.directory_path);

    try {
      const exists = await fs.pathExists(targetDir);
      if (!exists) {
        return { exists: false, isWordPress: false, hasConfig: false };
      }

      // Check if it's a WordPress installation
      const indexExists = await fs.pathExists(path.join(targetDir, 'index.php'));
      const wpIncludesExists = await fs.pathExists(path.join(targetDir, 'wp-includes'));
      
      if (!indexExists || !wpIncludesExists) {
        return { exists: true, isWordPress: false, hasConfig: false };
      }

      // Get WordPress version
      let version: string | undefined;
      try {
        const versionFile = path.join(targetDir, 'wp-includes', 'version.php');
        const versionContent = await fs.readFile(versionFile, 'utf8');
        const versionMatch = versionContent.match(/\$wp_version\s*=\s*['"]([^'"]+)['"]/);
        version = versionMatch ? versionMatch[1] : undefined;
      } catch {
        // Version detection failed, but it's still WordPress
      }

      // Check for wp-config.php
      const hasConfig = await fs.pathExists(path.join(targetDir, 'wp-config.php'));

      return { exists: true, isWordPress: true, version, hasConfig };

    } catch (error) {
      console.error(`Error checking installation: ${error instanceof Error ? error.message : String(error)}`);
      return { exists: false, isWordPress: false, hasConfig: false };
    }
  }

  /**
   * Generate WordPress installation report
   */
  async generateReport(): Promise<void> {
    console.log('\n📊 WordPress Installation Status Report');
    console.log('======================================');

    for (let i = 0; i < this.config.sites.length; i++) {
      const site = this.config.sites[i];
      console.log(`\n${i + 1}. ${site.site_name}`);
      
      try {
        const status = await this.checkInstallation(site);
        
        console.log(`   Directory: ${status.exists ? '✅ Exists' : '❌ Missing'}`);
        console.log(`   WordPress: ${status.isWordPress ? '✅ Installed' : '❌ Not found'}`);
        
        if (status.version) {
          console.log(`   Version: ${status.version}`);
        }
        
        console.log(`   Config: ${status.hasConfig ? '✅ wp-config.php exists' : '❌ No wp-config.php'}`);
        
        if (status.exists && status.isWordPress && status.hasConfig) {
          console.log(`   Status: 🟢 Ready`);
        } else if (status.exists && status.isWordPress) {
          console.log(`   Status: 🟡 Needs configuration`);
        } else if (status.exists) {
          console.log(`   Status: 🟡 Directory exists, no WordPress`);
        } else {
          console.log(`   Status: 🔴 Not installed`);
        }
        
      } catch (error) {
        console.log(`   Status: ❌ Error checking status`);
        console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  /**
   * Clean up WordPress installations
   * WARNING: This will delete all WordPress files!
   */
  async cleanupAllInstallations(): Promise<void> {
    console.log('\n🧹 Cleaning up WordPress installations...');
    console.log('⚠️  WARNING: This will permanently delete all WordPress files!');

    for (const site of this.config.sites) {
      const targetDir = path.resolve(site.directory_path);

      try {
        console.log(`\n🗑️  Cleaning up ${site.site_name}:`);
        
        const status = await this.checkInstallation(site);
        
        if (status.exists) {
          if (status.isWordPress) {
            await fs.remove(targetDir);
            console.log(`   ✅ WordPress installation removed`);
          } else {
            console.log(`   ℹ️  Directory exists but doesn't contain WordPress`);
          }
        } else {
          console.log(`   ℹ️  Directory doesn't exist`);
        }

      } catch (error) {
        console.error(`   ❌ Error cleaning up ${site.site_name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    console.log('\n✅ Cleanup completed.');
  }

  /**
   * Get installation summary
   */
  getSummary(results: DeploymentResult[]): {
    total: number;
    successful: number;
    failed: number;
    skipped: number;
  } {
    const total = results.length;
    const successful = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const skipped = results.filter(r => r.status === 'skipped').length;

    return { total, successful, failed, skipped };
  }

  /**
   * Create wp-config.php file with proper database settings and site URL
   */
  private async createWordPressConfig(site: SiteConfig, targetDir: string, siteUrl: string): Promise<void> {
    console.log(`   ⚙️  Creating wp-config.php...`);

    try {
      const wpConfigSamplePath = path.join(targetDir, 'wp-config-sample.php');
      const wpConfigPath = path.join(targetDir, 'wp-config.php');

      // Read the sample config
      const sampleConfig = await fs.readFile(wpConfigSamplePath, 'utf8');

      // Replace database settings
      let config = sampleConfig
        .replace('database_name_here', site.database_name || '')
        .replace('username_here', site.db_user || '')
        .replace('password_here', this.config.mysql.sharedDbPassword || '')
        .replace('localhost', this.config.mysql.host || 'localhost');

      // Add WordPress site URL and home URL
      const siteUrlConfig = `
// WordPress Site URL Configuration
define('WP_HOME', '${siteUrl}');
define('WP_SITEURL', '${siteUrl}');

// Security keys (you should replace these with unique values)
define('AUTH_KEY',         'put your unique phrase here');
define('SECURE_AUTH_KEY',  'put your unique phrase here');
define('LOGGED_IN_KEY',    'put your unique phrase here');
define('NONCE_KEY',        'put your unique phrase here');
define('AUTH_SALT',        'put your unique phrase here');
define('SECURE_AUTH_SALT', 'put your unique phrase here');
define('LOGGED_IN_SALT',   'put your unique phrase here');
define('NONCE_SALT',       'put your unique phrase here');

`;

      // Insert site URL config before the database table prefix
      config = config.replace(
        /(\$table_prefix\s*=\s*'wp_';)/,
        siteUrlConfig + '$1'
      );

      // Write the config file
      await fs.writeFile(wpConfigPath, config);
      console.log(`   ✅ Created wp-config.php with domain: ${siteUrl}`);

    } catch (error) {
      console.log(`   ⚠️  Could not create wp-config.php: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Set proper WordPress file permissions
   */
  private async setWordPressPermissions(targetDir: string): Promise<void> {
    console.log(`   🔒 Setting WordPress file permissions...`);

    try {
      // Set directory permissions recursively
      await this.setDirectoryPermissions(targetDir);
      
      // Set file permissions recursively  
      await this.setFilePermissions(targetDir);
      
      // Set special permissions for key files
      await this.setSpecialFilePermissions(targetDir);
      
      console.log(`   ✅ WordPress permissions set successfully`);

    } catch (error) {
      console.log(`   ⚠️  Could not set permissions: ${error instanceof Error ? error.message : String(error)}`);
      // Don't throw error - permissions can be set manually
    }
  }

  /**
   * Set directory permissions to 755 recursively
   */
  private async setDirectoryPermissions(targetDir: string): Promise<void> {
    const setDirPermissions = async (dirPath: string): Promise<void> => {
      if (!await fs.pathExists(dirPath)) return;

      // Set current directory to 755
      await fs.chmod(dirPath, 0o755);

      // Process subdirectories
      const items = await fs.readdir(dirPath);
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stat = await fs.stat(itemPath);
        
        if (stat.isDirectory()) {
          await setDirPermissions(itemPath);
        }
      }
    };

    await setDirPermissions(targetDir);
  }

  /**
   * Set file permissions to 644 recursively
   */
  private async setFilePermissions(targetDir: string): Promise<void> {
    const setFilePermissions = async (dirPath: string): Promise<void> => {
      if (!await fs.pathExists(dirPath)) return;

      const items = await fs.readdir(dirPath);
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        
        // Skip system files
        if (item.startsWith('.') && ['user.ini', 'DS_Store'].some(sys => item.includes(sys))) {
          continue;
        }
        
        try {
          const stat = await fs.stat(itemPath);
          
          if (stat.isFile()) {
            await fs.chmod(itemPath, 0o644);
          } else if (stat.isDirectory()) {
            await setFilePermissions(itemPath);
          }
        } catch (error) {
          // Skip files that can't be modified (like system files)
          continue;
        }
      }
    };

    await setFilePermissions(targetDir);
  }

  /**
   * Set special permissions for important WordPress files
   */
  private async setSpecialFilePermissions(targetDir: string): Promise<void> {
    // wp-config.php should be readable by web server
    const wpConfigPath = path.join(targetDir, 'wp-config.php');
    if (await fs.pathExists(wpConfigPath)) {
      await fs.chmod(wpConfigPath, 0o644);
    }

    // .htaccess should be readable by web server
    const htaccessPath = path.join(targetDir, '.htaccess');
    if (await fs.pathExists(htaccessPath)) {
      await fs.chmod(htaccessPath, 0o644);
    }

    // Ensure wp-content and uploads are writable
    const wpContentPath = path.join(targetDir, 'wp-content');
    if (await fs.pathExists(wpContentPath)) {
      await fs.chmod(wpContentPath, 0o755);
    }

    const uploadsPath = path.join(targetDir, 'wp-content', 'uploads');
    if (await fs.pathExists(uploadsPath)) {
      await fs.chmod(uploadsPath, 0o755);
    } else {
      await fs.ensureDir(uploadsPath);
      await fs.chmod(uploadsPath, 0o755);
    }
  }
} 