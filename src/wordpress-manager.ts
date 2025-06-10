import * as fs from 'fs-extra';
import * as path from 'path';
import fetch from 'node-fetch';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Extract } from 'unzipper';
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
  async installAllSites(): Promise<DeploymentResult[]> {
    console.log(`\n🌐 Starting WordPress installation for ${this.config.sites.length} site(s)...`);
    
    const results: DeploymentResult[] = [];

    for (let i = 0; i < this.config.sites.length; i++) {
      const site = this.config.sites[i];
      console.log(`\n📦 [${i + 1}/${this.config.sites.length}] Installing WordPress: ${site.site_name}`);
      
      try {
        const result = await this.installWordPressSite(site);
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
  async installWordPressSite(site: SiteConfig): Promise<DeploymentResult> {
    const targetDir = path.resolve(site.directory_path);
    
    console.log(`   Target Directory: ${targetDir}`);

    try {
      // Step 1: Prepare directory
      await this.prepareDirectory(targetDir);

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

      return {
        site_name: site.site_name,
        status: 'success',
        wordpress_path: targetDir,
        wordpress_info: {
          site_url: `http://localhost${targetDir.startsWith('/var/www') ? '' : ':8080'}`,
          admin_user: 'admin',
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
   * Prepare directory for WordPress installation
   */
  async prepareDirectory(targetDir: string): Promise<void> {
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
          throw new Error('WordPress already installed in target directory');
        }
        
        console.log(`   ⚠️  Directory not empty: ${targetDir}`);
        throw new Error('Target directory is not empty');
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
      // Create read stream from ZIP file
      const zipStream = fs.createReadStream(zipPath);
      
      // Extract to temporary directory first
      const tempExtractDir = path.join(targetDir, 'temp-extract');
      await fs.ensureDir(tempExtractDir);

      // Extract the ZIP file
      await pipeline(
        zipStream,
        Extract({ path: tempExtractDir })
      );

      // WordPress ZIP contains a 'wordpress' folder, we need to move its contents
      const wordpressDir = path.join(tempExtractDir, 'wordpress');
      
      if (!await fs.pathExists(wordpressDir)) {
        throw new Error('WordPress folder not found in extracted ZIP');
      }

      // Move WordPress files to target directory
      const files = await fs.readdir(wordpressDir);
      for (const file of files) {
        const srcPath = path.join(wordpressDir, file);
        const destPath = path.join(targetDir, file);
        await fs.move(srcPath, destPath);
      }

      // Clean up temporary extraction directory
      await fs.remove(tempExtractDir);

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
} 