import * as fs from 'fs-extra';
import * as path from 'path';
import { Config, SiteConfig, DeploymentResult } from './types';

export class PermissionsManager {
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  /**
   * Set file permissions for all WordPress sites
   */
  async setAllPermissions(): Promise<DeploymentResult[]> {
    console.log(`\n🔒 Setting file permissions for ${this.config.sites.length} WordPress site(s)...`);
    
    const results: DeploymentResult[] = [];

    for (let i = 0; i < this.config.sites.length; i++) {
      const site = this.config.sites[i];
      console.log(`\n🔧 [${i + 1}/${this.config.sites.length}] Setting permissions: ${site.site_name}`);
      
      try {
        const result = await this.setSitePermissions(site);
        results.push(result);
        
        if (result.status === 'success') {
          console.log(`✅ ${site.site_name}: Permissions set successfully`);
        } else {
          console.log(`⚠️  ${site.site_name}: Permissions set with warnings`);
        }
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`❌ ${site.site_name}: Permission setting failed - ${errorMessage}`);
        
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
   * Set permissions for a single WordPress site
   */
  async setSitePermissions(site: SiteConfig): Promise<DeploymentResult> {
    const targetDir = path.resolve(site.directory_path);
    
    console.log(`   Target: ${targetDir}`);

    try {
      // Step 1: Verify WordPress installation exists
      await this.verifyWordPressInstallation(targetDir);

      // Step 2: Set directory permissions (755)
      await this.setDirectoryPermissions(targetDir);

      // Step 3: Set file permissions (644)
      await this.setFilePermissions(targetDir);

      // Step 4: Set special permissions for specific files
      await this.setSpecialPermissions(targetDir);

      console.log(`   ✅ Permissions set successfully`);

      return {
        site_name: site.site_name,
        status: 'success',
        wordpress_path: targetDir
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Permission setting failed: ${errorMessage}`);
    }
  }

  /**
   * Verify that WordPress is installed in the target directory
   */
  async verifyWordPressInstallation(targetDir: string): Promise<void> {
    const requiredFiles = [
      'wp-blog-header.php',
      'wp-config.php',
      'wp-includes/version.php'
    ];

    for (const file of requiredFiles) {
      const filePath = path.join(targetDir, file);
      if (!await fs.pathExists(filePath)) {
        throw new Error(`WordPress not properly installed - missing ${file}`);
      }
    }
  }

  /**
   * Set directory permissions to 755 (owner: rwx, group: rx, others: rx)
   */
  async setDirectoryPermissions(targetDir: string): Promise<void> {
    console.log(`   📁 Setting directory permissions (755)...`);
    
    // WordPress directories that need 755 permissions
    const directories = [
      '', // Root directory
      'wp-admin',
      'wp-includes',
      'wp-content',
      'wp-content/themes',
      'wp-content/plugins',
      'wp-content/uploads'
    ];

    for (const dir of directories) {
      const dirPath = path.join(targetDir, dir);
      
      if (await fs.pathExists(dirPath)) {
        await fs.chmod(dirPath, 0o755);
        console.log(`   ✅ ${dir || '.'}: 755`);
      }
    }

    // Set permissions recursively for wp-content subdirectories
    await this.setDirectoryPermissionsRecursive(path.join(targetDir, 'wp-content'));
  }

  /**
   * Recursively set directory permissions
   */
  async setDirectoryPermissionsRecursive(dirPath: string): Promise<void> {
    if (!await fs.pathExists(dirPath)) {
      return;
    }

    const items = await fs.readdir(dirPath);
    
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stat = await fs.stat(itemPath);
      
      if (stat.isDirectory()) {
        await fs.chmod(itemPath, 0o755);
        await this.setDirectoryPermissionsRecursive(itemPath);
      }
    }
  }

  /**
   * Set file permissions to 644 (owner: rw, group: r, others: r)
   */
  async setFilePermissions(targetDir: string): Promise<void> {
    console.log(`   📄 Setting file permissions (644)...`);
    
    // Set permissions recursively for all PHP files
    await this.setFilePermissionsRecursive(targetDir);
  }

  /**
   * Recursively set file permissions
   */
  async setFilePermissionsRecursive(dirPath: string): Promise<void> {
    if (!await fs.pathExists(dirPath)) {
      return;
    }

    const items = await fs.readdir(dirPath);
    
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stat = await fs.stat(itemPath);
      
      if (stat.isDirectory()) {
        await this.setFilePermissionsRecursive(itemPath);
      } else if (stat.isFile()) {
        // Set 644 for most files
        await fs.chmod(itemPath, 0o644);
      }
    }
  }

  /**
   * Set special permissions for specific WordPress files
   */
  async setSpecialPermissions(targetDir: string): Promise<void> {
    console.log(`   🔐 Setting special permissions...`);
    
    // wp-config.php should be 600 (owner only) for security
    const wpConfigPath = path.join(targetDir, 'wp-config.php');
    if (await fs.pathExists(wpConfigPath)) {
      await fs.chmod(wpConfigPath, 0o600);
      console.log(`   🔒 wp-config.php: 600 (secure)`);
    }

    // .htaccess should be 644 if it exists
    const htaccessPath = path.join(targetDir, '.htaccess');
    if (await fs.pathExists(htaccessPath)) {
      await fs.chmod(htaccessPath, 0o644);
      console.log(`   ✅ .htaccess: 644`);
    }

    // wp-content/uploads should be 755 and writable for uploads
    const uploadsPath = path.join(targetDir, 'wp-content', 'uploads');
    if (await fs.pathExists(uploadsPath)) {
      await fs.chmod(uploadsPath, 0o755);
      console.log(`   📁 wp-content/uploads: 755 (writable)`);
    } else {
      // Create uploads directory if it doesn't exist
      await fs.ensureDir(uploadsPath);
      await fs.chmod(uploadsPath, 0o755);
      console.log(`   📁 wp-content/uploads: Created with 755`);
    }

    // Ensure wp-content is writable for WordPress
    const wpContentPath = path.join(targetDir, 'wp-content');
    if (await fs.pathExists(wpContentPath)) {
      await fs.chmod(wpContentPath, 0o755);
      console.log(`   📁 wp-content: 755 (writable)`);
    }
  }

  /**
   * Check permissions for all sites
   */
  async checkAllPermissions(): Promise<void> {
    console.log('\n📊 WordPress Permissions Status Report');
    console.log('======================================');

    for (let i = 0; i < this.config.sites.length; i++) {
      const site = this.config.sites[i];
      console.log(`\n${i + 1}. ${site.site_name}`);
      
      try {
        const status = await this.checkSitePermissions(site);
        
        console.log(`   WordPress: ${status.hasWordPress ? '✅ Installed' : '❌ Not found'}`);
        console.log(`   Directories: ${status.directoriesOk ? '✅ Correct (755)' : '⚠️  Needs fixing'}`);
        console.log(`   Files: ${status.filesOk ? '✅ Correct (644)' : '⚠️  Needs fixing'}`);
        console.log(`   wp-config.php: ${status.wpConfigOk ? '✅ Secure (600)' : '⚠️  Needs fixing'}`);
        console.log(`   wp-content: ${status.wpContentOk ? '✅ Writable (755)' : '⚠️  Needs fixing'}`);
        
        if (status.hasWordPress && status.directoriesOk && status.filesOk && status.wpConfigOk && status.wpContentOk) {
          console.log(`   Status: 🟢 All permissions correct`);
        } else if (status.hasWordPress) {
          console.log(`   Status: 🟡 WordPress installed, permissions need adjustment`);
        } else {
          console.log(`   Status: 🔴 WordPress not installed`);
        }
        
      } catch (error) {
        console.log(`   Status: ❌ Error checking permissions`);
        console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  /**
   * Check permissions for a single site
   */
  async checkSitePermissions(site: SiteConfig): Promise<{
    hasWordPress: boolean;
    directoriesOk: boolean;
    filesOk: boolean;
    wpConfigOk: boolean;
    wpContentOk: boolean;
  }> {
    const targetDir = path.resolve(site.directory_path);

    try {
      // Check if WordPress is installed
      const hasWordPress = await fs.pathExists(path.join(targetDir, 'wp-includes'));
      
      if (!hasWordPress) {
        return {
          hasWordPress: false,
          directoriesOk: false,
          filesOk: false,
          wpConfigOk: false,
          wpContentOk: false
        };
      }

      // Check main directory permissions
      const rootStat = await fs.stat(targetDir);
      const directoriesOk = this.checkPermissions(rootStat.mode, 0o755);

      // Check a sample file permissions
      const wpConfigPath = path.join(targetDir, 'wp-config.php');
      let filesOk = true;
      let wpConfigOk = false;
      
      if (await fs.pathExists(wpConfigPath)) {
        const wpConfigStat = await fs.stat(wpConfigPath);
        wpConfigOk = this.checkPermissions(wpConfigStat.mode, 0o600);
      }

      // Check wp-content permissions
      const wpContentPath = path.join(targetDir, 'wp-content');
      let wpContentOk = false;
      
      if (await fs.pathExists(wpContentPath)) {
        const wpContentStat = await fs.stat(wpContentPath);
        wpContentOk = this.checkPermissions(wpContentStat.mode, 0o755);
      }

      return {
        hasWordPress,
        directoriesOk,
        filesOk,
        wpConfigOk,
        wpContentOk
      };

    } catch (error) {
      console.error(`Error checking permissions: ${error instanceof Error ? error.message : String(error)}`);
      return {
        hasWordPress: false,
        directoriesOk: false,
        filesOk: false,
        wpConfigOk: false,
        wpContentOk: false
      };
    }
  }

  /**
   * Check if file/directory has the expected permissions
   */
  checkPermissions(currentMode: number, expectedMode: number): boolean {
    // Extract the permission bits (last 9 bits)
    const currentPerms = currentMode & parseInt('777', 8);
    return currentPerms === expectedMode;
  }

  /**
   * Fix permissions for all sites
   */
  async fixAllPermissions(): Promise<void> {
    console.log('\n🔧 Fixing WordPress permissions...');
    console.log('===================================');

    const results = await this.setAllPermissions();
    const summary = this.getSummary(results);

    console.log('\n📊 Permission Fix Summary');
    console.log('=========================');
    console.log(`Total Sites: ${summary.total}`);
    console.log(`✅ Successful: ${summary.successful}`);
    console.log(`❌ Failed: ${summary.failed}`);

    if (summary.failed > 0) {
      console.log('\n⚠️  Some sites failed permission fixes. Check the errors above.');
    } else {
      console.log('\n🎉 All permissions fixed successfully!');
    }
  }

  /**
   * Get permissions summary
   */
  getSummary(results: DeploymentResult[]): {
    total: number;
    successful: number;
    failed: number;
  } {
    const total = results.length;
    const successful = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status === 'failed').length;

    return { total, successful, failed };
  }

  /**
   * Get platform-specific permission setting command for manual fixing
   */
  getManualPermissionCommands(sitePath: string): string[] {
    const commands = [
      `# Set directory permissions (755)`,
      `find "${sitePath}" -type d -exec chmod 755 {} \\;`,
      ``,
      `# Set file permissions (644)`,
      `find "${sitePath}" -type f -exec chmod 644 {} \\;`,
      ``,
      `# Secure wp-config.php (600)`,
      `chmod 600 "${sitePath}/wp-config.php"`,
      ``,
      `# Make wp-content writable (755)`,
      `chmod 755 "${sitePath}/wp-content"`,
      `chmod 755 "${sitePath}/wp-content/uploads"`,
    ];

    return commands;
  }
} 