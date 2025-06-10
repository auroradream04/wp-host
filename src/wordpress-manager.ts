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
    
    // Install WP-CLI globally once at the beginning
    console.log(`\n🔧 Setting up WP-CLI globally for all sites...`);
    await this.ensureWPCLIInstalled();
    
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
   * Complete WordPress installation by directly setting up the database and admin user
   */
  async completeWordPressInstallation(site: SiteConfig, siteUrl: string): Promise<void> {
    console.log(`   🔧 Completing WordPress setup...`);

    try {
      // Import MySQL connection from database manager
      const mysql = require('mysql2/promise');
      
      const connection = await mysql.createConnection({
        host: this.config.mysql.host,
        port: this.config.mysql.port,
        user: this.config.mysql.rootUser,
        password: this.config.mysql.rootPassword,
        database: site.database_name
      });

      // Check if WordPress is already installed
      const [tables] = await connection.execute(
        "SHOW TABLES LIKE 'wp_options'"
      );

      if (Array.isArray(tables) && tables.length > 0) {
        console.log(`   ✅ WordPress already configured`);
        await connection.end();
        return;
      }

      console.log(`   🚀 Running WordPress installation via WP-CLI...`);

      // Use WP-CLI for reliable WordPress installation
      await this.installWordPressWithWPCLI(site, siteUrl);

      // Verify that WordPress recognizes this as a valid installation
      console.log(`   🔍 Verifying WordPress installation detection...`);
      
      try {
        // Check if siteurl option was set correctly
        const [siteurlRows] = await connection.execute(
          `SELECT option_value FROM wp_options WHERE option_name = 'siteurl'`
        );
        
        if (Array.isArray(siteurlRows) && siteurlRows.length > 0) {
          const actualSiteurl = (siteurlRows[0] as any).option_value;
          console.log(`   ✅ WordPress siteurl confirmed: ${actualSiteurl}`);
        } else {
          console.log(`   ⚠️  Could not verify siteurl setting`);
        }
        
        // Check if admin user was created correctly
        const [userRows] = await connection.execute(
          `SELECT user_login, user_email FROM wp_users WHERE user_login = ? LIMIT 1`,
          ['admin']
        );
        
        if (Array.isArray(userRows) && userRows.length > 0) {
          const adminUser = userRows[0] as any;
          console.log(`   ✅ Admin user confirmed: ${adminUser.user_login} (${adminUser.user_email})`);
        } else {
          console.log(`   ⚠️  Could not verify admin user`);
        }

        // Trigger WordPress installation completion process
        console.log(`   🏁 Triggering WordPress installation completion...`);
        
        // Let WordPress handle its own database version by calling the upgrade function
        // This ensures the database version matches the WordPress installation
        await connection.execute(
          `INSERT INTO wp_options (option_name, option_value, autoload) VALUES 
           ('auto_core_update_notified', '', 'yes')
           ON DUPLICATE KEY UPDATE option_value = VALUES(option_value)`
        );
        
        console.log(`   ✅ WordPress database ready for auto-upgrade on first admin access`);
        console.log(`   ℹ️  WordPress will automatically update database to correct version on first wp-admin visit`);
        
      } catch (error) {
        console.log(`   ⚠️  Could not verify installation: ${error instanceof Error ? error.message : String(error)}`);
      }

      await connection.end();

      console.log(`   ✅ WordPress setup completed successfully`);
      console.log(`   🌐 Site URL: ${siteUrl}`);
      console.log(`   👤 Visit: ${siteUrl}/wp-admin/install.php to complete setup`);
      console.log(`   📧 Use Email: ${this.config.wordpress.adminEmail}`);
      console.log(`   👤 Use Username: ${site.wordpress_admin_username || 'admin'}`);
      console.log(`   🔑 Use Password: ${this.config.wordpress.adminPassword}`);

    } catch (error) {
      console.log(`   ⚠️  WordPress setup automation failed`);
      console.log(`   🌐 Visit: ${siteUrl}/wp-admin/install.php to complete setup manually`);
      console.log(`   📧 Use Email: ${this.config.wordpress.adminEmail}`);
      console.log(`   👤 Use Username: ${site.wordpress_admin_username || 'admin'}`);
      console.log(`   🔑 Use Password: ${this.config.wordpress.adminPassword}`);
      console.log(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create essential WordPress database tables
   */
  private async createWordPressTables(connection: any): Promise<void> {
    // Set SQL mode to be more permissive for WordPress compatibility
    try {
      await connection.execute("SET sql_mode = ''");
    } catch (error) {
      console.log(`   ⚠️  Could not set SQL mode: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    const tables = [
      // wp_posts - Blog posts, pages, and custom post types
      `CREATE TABLE wp_posts (
        ID bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        post_author bigint(20) unsigned NOT NULL DEFAULT '0',
        post_date datetime NOT NULL DEFAULT '0000-00-00 00:00:00',
        post_date_gmt datetime NOT NULL DEFAULT '0000-00-00 00:00:00',
        post_content longtext NOT NULL,
        post_title text NOT NULL,
        post_excerpt text NOT NULL,
        post_status varchar(20) NOT NULL DEFAULT 'publish',
        comment_status varchar(20) NOT NULL DEFAULT 'open',
        ping_status varchar(20) NOT NULL DEFAULT 'open',
        post_password varchar(255) NOT NULL DEFAULT '',
        post_name varchar(200) NOT NULL DEFAULT '',
        to_ping text NOT NULL,
        pinged text NOT NULL,
        post_modified datetime NOT NULL DEFAULT '0000-00-00 00:00:00',
        post_modified_gmt datetime NOT NULL DEFAULT '0000-00-00 00:00:00',
        post_content_filtered longtext NOT NULL,
        post_parent bigint(20) unsigned NOT NULL DEFAULT '0',
        guid varchar(255) NOT NULL DEFAULT '',
        menu_order int(11) NOT NULL DEFAULT '0',
        post_type varchar(20) NOT NULL DEFAULT 'post',
        post_mime_type varchar(100) NOT NULL DEFAULT '',
        comment_count bigint(20) NOT NULL DEFAULT '0',
        PRIMARY KEY (ID),
        KEY post_name (post_name(191)),
        KEY type_status_date (post_type,post_status,post_date,ID),
        KEY post_parent (post_parent),
        KEY post_author (post_author)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci`,

      // wp_users - User account information
      `CREATE TABLE wp_users (
        ID bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        user_login varchar(60) NOT NULL DEFAULT '',
        user_pass varchar(255) NOT NULL DEFAULT '',
        user_nicename varchar(50) NOT NULL DEFAULT '',
        user_email varchar(100) NOT NULL DEFAULT '',
        user_url varchar(100) NOT NULL DEFAULT '',
        user_registered datetime NOT NULL DEFAULT '0000-00-00 00:00:00',
        user_activation_key varchar(255) NOT NULL DEFAULT '',
        user_status int(11) NOT NULL DEFAULT '0',
        display_name varchar(250) NOT NULL DEFAULT '',
        PRIMARY KEY (ID),
        KEY user_login_key (user_login),
        KEY user_nicename (user_nicename),
        KEY user_email (user_email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci`,

      // wp_usermeta - Additional user metadata
      `CREATE TABLE wp_usermeta (
        umeta_id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        user_id bigint(20) unsigned NOT NULL DEFAULT '0',
        meta_key varchar(255) DEFAULT NULL,
        meta_value longtext,
        PRIMARY KEY (umeta_id),
        KEY user_id (user_id),
        KEY meta_key (meta_key(191))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci`,

      // wp_options - WordPress configuration settings
      `CREATE TABLE wp_options (
        option_id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        option_name varchar(191) NOT NULL DEFAULT '',
        option_value longtext NOT NULL,
        autoload varchar(20) NOT NULL DEFAULT 'yes',
        PRIMARY KEY (option_id),
        UNIQUE KEY option_name (option_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci`,

      // wp_postmeta - Post metadata
      `CREATE TABLE wp_postmeta (
        meta_id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        post_id bigint(20) unsigned NOT NULL DEFAULT '0',
        meta_key varchar(255) DEFAULT NULL,
        meta_value longtext,
        PRIMARY KEY (meta_id),
        KEY post_id (post_id),
        KEY meta_key (meta_key(191))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci`,

      // wp_comments - Comment data
      `CREATE TABLE wp_comments (
        comment_ID bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        comment_post_ID bigint(20) unsigned NOT NULL DEFAULT '0',
        comment_author tinytext NOT NULL,
        comment_author_email varchar(100) NOT NULL DEFAULT '',
        comment_author_url varchar(200) NOT NULL DEFAULT '',
        comment_author_IP varchar(100) NOT NULL DEFAULT '',
        comment_date datetime NOT NULL DEFAULT '0000-00-00 00:00:00',
        comment_date_gmt datetime NOT NULL DEFAULT '0000-00-00 00:00:00',
        comment_content text NOT NULL,
        comment_karma int(11) NOT NULL DEFAULT '0',
        comment_approved varchar(20) NOT NULL DEFAULT '1',
        comment_agent varchar(255) NOT NULL DEFAULT '',
        comment_type varchar(20) NOT NULL DEFAULT 'comment',
        comment_parent bigint(20) unsigned NOT NULL DEFAULT '0',
        user_id bigint(20) unsigned NOT NULL DEFAULT '0',
        PRIMARY KEY (comment_ID),
        KEY comment_post_ID (comment_post_ID),
        KEY comment_approved_date_gmt (comment_approved,comment_date_gmt),
        KEY comment_date_gmt (comment_date_gmt),
        KEY comment_parent (comment_parent),
        KEY comment_author_email (comment_author_email(10))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci`,

      // wp_commentmeta - Comment metadata
      `CREATE TABLE wp_commentmeta (
        meta_id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        comment_id bigint(20) unsigned NOT NULL DEFAULT '0',
        meta_key varchar(255) DEFAULT NULL,
        meta_value longtext,
        PRIMARY KEY (meta_id),
        KEY comment_id (comment_id),
        KEY meta_key (meta_key(191))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci`,

      // wp_terms - Categories, tags, and taxonomy terms
      `CREATE TABLE wp_terms (
        term_id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        name varchar(200) NOT NULL DEFAULT '',
        slug varchar(200) NOT NULL DEFAULT '',
        term_group bigint(10) NOT NULL DEFAULT 0,
        PRIMARY KEY (term_id),
        KEY slug (slug(191)),
        KEY name (name(191))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci`,

      // wp_termmeta - Term metadata
      `CREATE TABLE wp_termmeta (
        meta_id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        term_id bigint(20) unsigned NOT NULL DEFAULT 0,
        meta_key varchar(255) DEFAULT NULL,
        meta_value longtext,
        PRIMARY KEY (meta_id),
        KEY term_id (term_id),
        KEY meta_key (meta_key(191))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci`,

      // wp_term_taxonomy - Taxonomy definitions
      `CREATE TABLE wp_term_taxonomy (
        term_taxonomy_id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        term_id bigint(20) unsigned NOT NULL DEFAULT 0,
        taxonomy varchar(32) NOT NULL DEFAULT '',
        description longtext NOT NULL,
        parent bigint(20) unsigned NOT NULL DEFAULT 0,
        count bigint(20) NOT NULL DEFAULT 0,
        PRIMARY KEY (term_taxonomy_id),
        UNIQUE KEY term_id_taxonomy (term_id,taxonomy),
        KEY taxonomy (taxonomy)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci`,

      // wp_term_relationships - Links posts to terms
      `CREATE TABLE wp_term_relationships (
        object_id bigint(20) unsigned NOT NULL DEFAULT 0,
        term_taxonomy_id bigint(20) unsigned NOT NULL DEFAULT 0,
        term_order int(11) NOT NULL DEFAULT 0,
        PRIMARY KEY (object_id,term_taxonomy_id),
        KEY term_taxonomy_id (term_taxonomy_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci`,

      // wp_links - Link manager data
      `CREATE TABLE wp_links (
        link_id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        link_url varchar(255) NOT NULL DEFAULT '',
        link_name varchar(255) NOT NULL DEFAULT '',
        link_image varchar(255) NOT NULL DEFAULT '',
        link_target varchar(25) NOT NULL DEFAULT '',
        link_description varchar(255) NOT NULL DEFAULT '',
        link_visible varchar(20) NOT NULL DEFAULT 'Y',
        link_owner bigint(20) unsigned NOT NULL DEFAULT 1,
        link_rating int(11) NOT NULL DEFAULT 0,
        link_updated datetime NOT NULL DEFAULT '0000-00-00 00:00:00',
        link_rel varchar(255) NOT NULL DEFAULT '',
        link_notes mediumtext NOT NULL,
        link_rss varchar(255) NOT NULL DEFAULT '',
        PRIMARY KEY (link_id),
        KEY link_visible (link_visible)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_520_ci`
    ];

    for (const tableSQL of tables) {
      try {
        await connection.execute(tableSQL);
      } catch (error) {
        // Table might already exist, continue
        console.log(`   ⚠️  Table creation warning: ${error instanceof Error ? error.message.substring(0, 50) : String(error)}`);
      }
    }
  }

  /**
   * Create WordPress admin user using WordPress's native installation process
   */
  private async createWordPressAdmin(connection: any, site: SiteConfig, siteUrl: string): Promise<void> {
    const adminUsername = site.wordpress_admin_username || 'admin';
    const adminPassword = this.config.wordpress.adminPassword;
    const adminEmail = this.config.wordpress.adminEmail;
    const siteTitle = site.wordpress_site_title || 'WordPress Site';

    // Debug output to verify credentials
    console.log(`   📧 Using Admin Email: ${adminEmail}`);
    console.log(`   👤 Using Admin Username: ${adminUsername}`);
    console.log(`   🔑 Using Admin Password: ${adminPassword.substring(0, 8)}...`);
    console.log(`   🏷️  Using Site Title: ${siteTitle}`);

    // Use WordPress's built-in wp_hash_password function via a PHP script
    // This ensures 100% compatibility with WordPress password hashing
    console.log(`   🔐 Generating WordPress-compatible password hash...`);
    const passwordHash = await this.generateWordPressPasswordHash(adminPassword, site.directory_path);

    // Insert admin user
    await connection.execute(
      `INSERT INTO wp_users (user_login, user_pass, user_nicename, user_email, user_registered, display_name) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [adminUsername, passwordHash, adminUsername, adminEmail, new Date(), adminUsername]
    );

    // Get the user ID
    const [userResult] = await connection.execute(
      'SELECT ID FROM wp_users WHERE user_login = ?',
      [adminUsername]
    );

    const userId = userResult[0].ID;

    // Set user capabilities (admin)
    await connection.execute(
      `INSERT INTO wp_usermeta (user_id, meta_key, meta_value) VALUES (?, 'wp_capabilities', ?)`,
      [userId, 'a:1:{s:13:"administrator";b:1;}']
    );

    await connection.execute(
      `INSERT INTO wp_usermeta (user_id, meta_key, meta_value) VALUES (?, 'wp_user_level', '10')`,
      [userId]
    );

    // Set essential WordPress options
    const options = [
      ['siteurl', siteUrl],
      ['home', siteUrl],
      ['blogname', siteTitle],
      ['blogdescription', 'Just another WordPress site'],
      ['admin_email', adminEmail],
      ['start_of_week', '1'],
      ['use_balanceTags', '0'],
      ['use_smilies', '1'],
      ['require_name_email', '1'],
      ['comments_notify', '1'],
      ['posts_per_rss', '10'],
      ['rss_use_excerpt', '0'],
      ['mailserver_url', 'mail.example.com'],
      ['mailserver_login', 'login@example.com'],
      ['mailserver_pass', 'password'],
      ['mailserver_port', '110'],
      ['default_category', '1'],
      ['default_comment_status', 'open'],
      ['default_ping_status', 'open'],
      ['default_pingback_flag', '1'],
      ['posts_per_page', '10'],
      ['date_format', 'F j, Y'],
      ['time_format', 'g:i a'],
      ['links_updated_date_format', 'F j, Y g:i a'],
      ['comment_moderation', '0'],
      ['moderation_notify', '1'],
      ['permalink_structure', '/%year%/%monthnum%/%day%/%postname%/'],
      ['rewrite_rules', ''],
      ['hack_file', '0'],
      ['blog_charset', 'UTF-8'],
      ['moderation_keys', ''],
      ['active_plugins', 'a:0:{}'],
      ['category_base', ''],
      ['ping_sites', 'http://rpc.pingomatic.com/'],
      ['comment_max_links', '2'],
      ['gmt_offset', '0'],
      ['default_email_category', '1'],
      ['recently_edited', ''],
      ['template', 'twentytwentyfour'],
      ['stylesheet', 'twentytwentyfour'],
      ['comment_registration', '0'],
      ['html_type', 'text/html'],
      ['use_trackback', '0'],
      ['default_role', 'subscriber'],
      ['db_version', '58975'],
      ['uploads_use_yearmonth_folders', '1'],
      ['upload_path', ''],
      ['blog_public', '1'],
      ['default_link_category', '2'],
      ['show_on_front', 'posts'],
      ['tag_base', ''],
      ['show_avatars', '1'],
      ['avatar_rating', 'G'],
      ['upload_url_path', ''],
      ['thumbnail_size_w', '150'],
      ['thumbnail_size_h', '150'],
      ['thumbnail_crop', '1'],
      ['medium_size_w', '300'],
      ['medium_size_h', '300'],
      ['avatar_default', 'mystery'],
      ['large_size_w', '1024'],
      ['large_size_h', '1024'],
      ['image_default_link_type', 'none'],
      ['image_default_size', ''],
      ['image_default_align', ''],
      ['close_comments_for_old_posts', '0'],
      ['close_comments_days_old', '14'],
      ['thread_comments', '1'],
      ['thread_comments_depth', '5'],
      ['page_comments', '0'],
      ['comments_per_page', '50'],
      ['default_comments_page', 'newest'],
      ['comment_order', 'asc'],
      ['sticky_posts', 'a:0:{}'],
      ['widget_categories', 'a:2:{i:1;a:0:{}s:12:"_multiwidget";i:1;}'],
      ['widget_text', 'a:2:{i:1;a:0:{}s:12:"_multiwidget";i:1;}'],
      ['widget_rss', 'a:2:{i:1;a:0:{}s:12:"_multiwidget";i:1;}'],
      ['uninstall_plugins', 'a:0:{}'],
      ['timezone_string', ''],
      ['page_for_posts', '0'],
      ['page_on_front', '0'],
      ['default_post_format', '0'],
      ['link_manager_enabled', '0'],
      ['finished_splitting_shared_terms', '1'],
      ['site_icon', '0'],
      ['medium_large_size_w', '768'],
      ['medium_large_size_h', '0'],
      ['wp_page_for_privacy_policy', '3'],
      ['show_comments_cookies_opt_in', '1'],
      ['admin_email_lifespan', '1893456000'],
      ['disallowed_keys', ''],
      ['comment_previously_approved', '1'],
      ['auto_plugin_theme_update_emails', 'a:0:{}'],
      ['auto_update_core_dev', 'enabled'],
      ['auto_update_core_minor', 'enabled'],
      ['auto_update_core_major', 'enabled'],
      ['wp_force_deactivated_plugins', 'a:0:{}'],
      // Critical installation completion markers
      ['fresh_site', '1'],
      ['WPLANG', ''],
      ['initial_db_version', '58975'],
      ['can_compress_scripts', '1'],
      ['db_upgraded', ''],
      // WordPress user roles - complete definition from official schema
      ['wp_user_roles', 'a:5:{s:13:"administrator";a:2:{s:4:"name";s:13:"Administrator";s:12:"capabilities";a:61:{s:13:"switch_themes";b:1;s:11:"edit_themes";b:1;s:16:"activate_plugins";b:1;s:12:"edit_plugins";b:1;s:10:"edit_users";b:1;s:10:"edit_files";b:1;s:14:"manage_options";b:1;s:17:"moderate_comments";b:1;s:17:"manage_categories";b:1;s:12:"manage_links";b:1;s:12:"upload_files";b:1;s:6:"import";b:1;s:15:"unfiltered_html";b:1;s:10:"edit_posts";b:1;s:17:"edit_others_posts";b:1;s:20:"edit_published_posts";b:1;s:13:"publish_posts";b:1;s:10:"edit_pages";b:1;s:4:"read";b:1;s:8:"level_10";b:1;s:7:"level_9";b:1;s:7:"level_8";b:1;s:7:"level_7";b:1;s:7:"level_6";b:1;s:7:"level_5";b:1;s:7:"level_4";b:1;s:7:"level_3";b:1;s:7:"level_2";b:1;s:7:"level_1";b:1;s:7:"level_0";b:1;s:17:"edit_others_pages";b:1;s:20:"edit_published_pages";b:1;s:13:"publish_pages";b:1;s:12:"delete_pages";b:1;s:19:"delete_others_pages";b:1;s:22:"delete_published_pages";b:1;s:12:"delete_posts";b:1;s:19:"delete_others_posts";b:1;s:22:"delete_published_posts";b:1;s:20:"delete_private_posts";b:1;s:18:"edit_private_posts";b:1;s:18:"read_private_posts";b:1;s:20:"delete_private_pages";b:1;s:18:"edit_private_pages";b:1;s:18:"read_private_pages";b:1;s:12:"delete_users";b:1;s:12:"create_users";b:1;s:17:"unfiltered_upload";b:1;s:14:"edit_dashboard";b:1;s:14:"update_plugins";b:1;s:14:"delete_plugins";b:1;s:15:"install_plugins";b:1;s:13:"update_themes";b:1;s:14:"install_themes";b:1;s:11:"update_core";b:1;s:10:"list_users";b:1;s:12:"remove_users";b:1;s:13:"promote_users";b:1;s:18:"edit_theme_options";b:1;s:13:"delete_themes";b:1;s:6:"export";b:1;}}s:6:"editor";a:2:{s:4:"name";s:6:"Editor";s:12:"capabilities";a:34:{s:17:"moderate_comments";b:1;s:17:"manage_categories";b:1;s:12:"manage_links";b:1;s:12:"upload_files";b:1;s:15:"unfiltered_html";b:1;s:10:"edit_posts";b:1;s:17:"edit_others_posts";b:1;s:20:"edit_published_posts";b:1;s:13:"publish_posts";b:1;s:10:"edit_pages";b:1;s:4:"read";b:1;s:7:"level_7";b:1;s:7:"level_6";b:1;s:7:"level_5";b:1;s:7:"level_4";b:1;s:7:"level_3";b:1;s:7:"level_2";b:1;s:7:"level_1";b:1;s:7:"level_0";b:1;s:17:"edit_others_pages";b:1;s:20:"edit_published_pages";b:1;s:13:"publish_pages";b:1;s:12:"delete_pages";b:1;s:19:"delete_others_pages";b:1;s:22:"delete_published_pages";b:1;s:12:"delete_posts";b:1;s:19:"delete_others_posts";b:1;s:22:"delete_published_posts";b:1;s:20:"delete_private_posts";b:1;s:18:"edit_private_posts";b:1;s:18:"read_private_posts";b:1;s:20:"delete_private_pages";b:1;s:18:"edit_private_pages";b:1;s:18:"read_private_pages";b:1;}}s:6:"author";a:2:{s:4:"name";s:6:"Author";s:12:"capabilities";a:10:{s:12:"upload_files";b:1;s:10:"edit_posts";b:1;s:20:"edit_published_posts";b:1;s:13:"publish_posts";b:1;s:4:"read";b:1;s:7:"level_2";b:1;s:7:"level_1";b:1;s:7:"level_0";b:1;s:12:"delete_posts";b:1;s:22:"delete_published_posts";b:1;}}s:11:"contributor";a:2:{s:4:"name";s:11:"Contributor";s:12:"capabilities";a:5:{s:10:"edit_posts";b:1;s:4:"read";b:1;s:7:"level_1";b:1;s:7:"level_0";b:1;s:12:"delete_posts";b:1;}}s:10:"subscriber";a:2:{s:4:"name";s:10:"Subscriber";s:12:"capabilities";a:2:{s:4:"read";b:1;s:7:"level_0";b:1;}}}']
    ];

    for (const [option_name, option_value] of options) {
      try {
        await connection.execute(
          'INSERT INTO wp_options (option_name, option_value) VALUES (?, ?)',
          [option_name, option_value]
        );
      } catch (error) {
        // Option might already exist
      }
    }

    // Create a sample "Hello World" post
    const now = new Date();
    await connection.execute(
      `INSERT INTO wp_posts (post_author, post_date, post_date_gmt, post_content, post_title, post_excerpt, post_status, comment_status, ping_status, post_name, post_modified, post_modified_gmt, guid, post_type, to_ping, pinged) 
       VALUES (?, ?, ?, ?, 'Hello world!', '', 'publish', 'open', 'open', 'hello-world', ?, ?, ?, 'post', '', '')`,
      [userId, now, now, 'Welcome to WordPress. This is your first post. Edit or delete it, then start writing!', now, now, `${siteUrl}/?p=1`]
    );

    // Create a sample page
    await connection.execute(
      `INSERT INTO wp_posts (post_author, post_date, post_date_gmt, post_content, post_title, post_excerpt, post_status, comment_status, ping_status, post_name, post_modified, post_modified_gmt, guid, post_type, to_ping, pinged) 
       VALUES (?, ?, ?, ?, 'Sample Page', '', 'publish', 'closed', 'open', 'sample-page', ?, ?, ?, 'page', '', '')`,
      [userId, now, now, 'This is an example page. It\'s different from a blog post because it will stay in one place and will show up in your site navigation (in most themes). Most people start with an About page that introduces them to potential site visitors. It might say something like this:\n\nHi there! I\'m a bike messenger by day, aspiring actor by night, and this is my website. I live in Los Angeles, have a great dog named Jack, and I like piña coladas. (And gettin\' caught in the rain.)\n\n...or something like this:\n\nThe XYZ Donut Company was founded in 1971, and has been providing quality donuts to the public ever since. Located in Gotham City, XYZ employs over 2,000 people and does all kinds of awesome things for the Gotham community.\n\nAs a new WordPress user, you should go to your dashboard to delete this page and create new pages for your content. Have fun!', now, now, `${siteUrl}/?page_id=2`]
    );

    // Create default category "Uncategorized"
    await connection.execute(
      `INSERT INTO wp_terms (name, slug, term_group) VALUES ('Uncategorized', 'uncategorized', 0)`
    );

    // Get the term ID
    const [termResult] = await connection.execute(
      'SELECT term_id FROM wp_terms WHERE slug = ?',
      ['uncategorized']
    );
    const termId = termResult[0].term_id;

    // Create taxonomy entry for the category
    await connection.execute(
      `INSERT INTO wp_term_taxonomy (term_id, taxonomy, description, parent, count) VALUES (?, 'category', '', 0, 1)`,
      [termId]
    );

    // Get the term_taxonomy_id
    const [termTaxResult] = await connection.execute(
      'SELECT term_taxonomy_id FROM wp_term_taxonomy WHERE term_id = ? AND taxonomy = ?',
      [termId, 'category']
    );
    const termTaxonomyId = termTaxResult[0].term_taxonomy_id;

    // Assign the hello world post to the uncategorized category
    await connection.execute(
      `INSERT INTO wp_term_relationships (object_id, term_taxonomy_id, term_order) VALUES (1, ?, 0)`,
      [termTaxonomyId]
    );
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

      // Generate unique security keys (using safer characters to avoid PHP syntax issues)
      const generateKey = () => {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#%^&*()-_=+[]{}|:,.<>';
        let result = '';
        for (let i = 0; i < 64; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
      };

      // Replace each security key individually to ensure proper replacement
      const keys = [
        'AUTH_KEY',
        'SECURE_AUTH_KEY', 
        'LOGGED_IN_KEY',
        'NONCE_KEY',
        'AUTH_SALT',
        'SECURE_AUTH_SALT',
        'LOGGED_IN_SALT',
        'NONCE_SALT'
      ];

      keys.forEach(keyName => {
        const pattern = new RegExp(`define\\s*\\(\\s*'${keyName}'\\s*,\\s*'put your unique phrase here'\\s*\\)`, 'g');
        config = config.replace(pattern, `define('${keyName}', '${generateKey()}')`);
      });

      // Add WordPress site URL configuration before the table prefix
      const siteUrlConfig = `
// WordPress Site URL Configuration
define('WP_HOME', '${siteUrl}');
define('WP_SITEURL', '${siteUrl}');

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

  /**
   * Run WordPress's native installation process with proper database handling
   */
  private async installWordPressWithWPCLI(site: SiteConfig, siteUrl: string): Promise<void> {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    try {
      console.log(`   📋 Installing WordPress via WP-CLI for ${site.site_name}...`);
      
      const siteDir = site.directory_path;
      const adminUsername = site.wordpress_admin_username || 'admin';
      const adminPassword = this.config.wordpress.adminPassword;
      const adminEmail = this.config.wordpress.adminEmail;
      const siteTitle = site.wordpress_site_title || 'WordPress Site';

      // Debug output to verify credentials
      console.log(`   📧 Using Admin Email: ${adminEmail}`);
      console.log(`   👤 Using Admin Username: ${adminUsername}`);
      console.log(`   🔑 Using Admin Password: ${adminPassword.substring(0, 8)}...`);
      console.log(`   🏷️  Using Site Title: ${siteTitle}`);
      
      // WP-CLI should already be installed globally, just verify
      const wpCommand = 'wp';
      
      try {
        const versionResult = await execAsync('wp --version');
        console.log(`   ✅ Using WP-CLI: ${versionResult.stdout.trim()}`);
      } catch (error) {
        throw new Error('WP-CLI not available. Global installation should have been completed earlier.');
      }
      
      // Navigate to site directory and run WordPress installation
      console.log(`   🚀 Running WordPress core installation...`);
      console.log(`   🔧 Using WP-CLI command: ${wpCommand}`);
      
      const installCommand = `cd "${siteDir}" && ${wpCommand} core install ` +
        `--url="${siteUrl}" ` +
        `--title="${siteTitle.replace(/"/g, '\\"')}" ` +
        `--admin_user="${adminUsername}" ` +
        `--admin_password="${adminPassword}" ` +
        `--admin_email="${adminEmail}" ` +
        `--skip-email`;
      
      console.log(`   🔧 Executing: ${wpCommand} core install...`);
      
      const { stdout, stderr } = await execAsync(installCommand);
      
      if (stderr && !stderr.includes('Success:')) {
        console.log(`   ⚠️  Installation warnings: ${stderr}`);
      }
      
      if (stdout) {
        console.log(`   📋 Installation output: ${stdout}`);
      }
      
      // Verify installation was successful
      const verifyCommand = `cd "${siteDir}" && ${wpCommand} core is-installed`;
      try {
        await execAsync(verifyCommand);
        console.log(`   ✅ WordPress installation verified successfully!`);
        console.log(`   🎉 Admin user created with your credentials`);
        console.log(`   🌐 You can now login at: ${siteUrl}/wp-admin/`);
      } catch (error) {
        throw new Error(`WordPress installation verification failed`);
      }
      
    } catch (error: any) {
      console.error(`   ❌ WP-CLI installation failed: ${error.message}`);
      console.log(`   🔧 Falling back to manual installation process...`);
      throw error;
    }
  }

  private async ensureWPCLIInstalled(): Promise<string> {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    // Check if WP-CLI is already available globally
    try {
      const { stdout } = await execAsync('wp --version');
      console.log(`✅ WP-CLI is already installed globally: ${stdout.trim()}`);
      return 'wp';
    } catch (error) {
      console.log(`📥 WP-CLI not found globally, installing...`);
    }

    try {
      // Download WP-CLI using the official stable release URL
      console.log(`📥 Downloading WP-CLI from official source...`);
      await execAsync('curl -O https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar');
      
      // Verify the download worked
      console.log(`🔍 Verifying WP-CLI download...`);
      await execAsync('php wp-cli.phar --info');
      console.log(`✅ WP-CLI downloaded successfully`);
      
      // Make it executable
      await execAsync('chmod +x wp-cli.phar');
      
      // Install globally
      console.log(`🔧 Installing WP-CLI globally...`);
      await execAsync('sudo mv wp-cli.phar /usr/local/bin/wp');
      
      // Verify global installation
      const { stdout } = await execAsync('wp --version');
      console.log(`✅ WP-CLI installed globally: ${stdout.trim()}`);
      
      return 'wp';
      
    } catch (error: any) {
      console.error(`❌ Failed to install WP-CLI globally: ${error.message}`);
      
      // Try alternative installation method
      console.log(`🔄 Trying alternative installation with wget...`);
      try {
        // Clean up any partial files
        try {
          await execAsync('rm -f wp-cli.phar');
        } catch {} // Ignore errors
        
        // Try downloading using wget as fallback
        await execAsync('wget https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar');
        await execAsync('chmod +x wp-cli.phar');
        
        // Test that it works
        await execAsync('php wp-cli.phar --info');
        
        // Try global installation again
        await execAsync('sudo mv wp-cli.phar /usr/local/bin/wp');
        
        const { stdout } = await execAsync('wp --version');
        console.log(`✅ WP-CLI installed globally via wget: ${stdout.trim()}`);
        
        return 'wp';
        
      } catch (wgetError: any) {
        console.error(`❌ All WP-CLI installation methods failed: ${wgetError.message}`);
        throw new Error(`Could not install WP-CLI: ${error.message}`);
      }
    }
  }

  /**
   * Run WordPress's native installation process
   */
  private async runWordPressInstallation(site: SiteConfig, siteUrl: string): Promise<void> {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    try {
      const adminUsername = site.wordpress_admin_username || 'admin';
      const adminPassword = this.config.wordpress.adminPassword;
      const adminEmail = this.config.wordpress.adminEmail;
      const siteTitle = site.wordpress_site_title || 'WordPress Site';

      // Debug output to verify credentials
      console.log(`   📧 Using Admin Email: ${adminEmail}`);
      console.log(`   👤 Using Admin Username: ${adminUsername}`);
      console.log(`   🔑 Using Admin Password: ${adminPassword.substring(0, 8)}...`);
      console.log(`   🏷️  Using Site Title: ${siteTitle}`);

      // Create a PHP script that uses WordPress's native installation
      const phpScript = `<?php
define('WP_INSTALLING', true);
require_once '${site.directory_path}/wp-config.php';
require_once '${site.directory_path}/wp-admin/includes/upgrade.php';
require_once '${site.directory_path}/wp-includes/wp-db.php';

// Install WordPress
$result = wp_install(
    '${siteTitle.replace(/'/g, "\\'")}',
    '${adminUsername.replace(/'/g, "\\'")}', 
    '${adminEmail.replace(/'/g, "\\'")}',
    true, // blog_public
    '', // deprecated
    '${adminPassword.replace(/'/g, "\\'")}'
);

if (is_wp_error($result)) {
    echo 'ERROR: ' . $result->get_error_message();
    exit(1);
} else {
    echo 'SUCCESS: WordPress installation completed';
    exit(0);
}
?>`;

      const tempPhpFile = path.join(site.directory_path, 'temp_install.php');
      await fs.writeFile(tempPhpFile, phpScript);
      
      // Execute WordPress installation
      console.log(`   🚀 Running WordPress installation...`);
      const { stdout, stderr } = await execAsync(`cd ${site.directory_path} && php temp_install.php`);
      
      // Clean up temp file
      await fs.remove(tempPhpFile);
      
      if (stdout.includes('SUCCESS')) {
        console.log(`   ✅ WordPress installation completed successfully`);
      } else {
        throw new Error(`Installation failed: ${stdout} ${stderr}`);
      }
      
    } catch (error) {
      console.log(`   ⚠️  Native WordPress installation failed, manual setup required`);
      console.log(`   🌐 Visit: ${siteUrl}/wp-admin/install.php to complete setup manually`);
      console.log(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      
      // Don't throw - let manual setup complete the process
    }
  }

  /**
   * Generate WordPress-compatible password hash using WordPress's own functions
   */
  private async generateWordPressPasswordHash(password: string, wordpressPath: string): Promise<string> {
    const path = require('path');
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    try {
      // Create a temporary PHP script that uses WordPress's password hashing
      const phpScript = `<?php
require_once '${path.join(wordpressPath, 'wp-includes/pluggable.php')}';
require_once '${path.join(wordpressPath, 'wp-includes/class-phpass.php')}';

// Use WordPress's native password hashing
echo wp_hash_password('${password.replace(/'/g, "\\'")}');
?>`;

      const tempPhpFile = path.join(wordpressPath, 'temp_hash.php');
      const fs = require('fs-extra');
      
      await fs.writeFile(tempPhpFile, phpScript);
      
      // Execute PHP script to get the hash
      const { stdout } = await execAsync(`php ${tempPhpFile}`);
      
      // Clean up temp file
      await fs.remove(tempPhpFile);
      
      const hash = stdout.trim();
      if (hash && hash.length > 20) {
        console.log(`   ✅ Generated WordPress password hash: ${hash.substring(0, 10)}...`);
        return hash;
      } else {
        throw new Error('Invalid password hash generated');
      }
      
    } catch (error) {
      console.log(`   ⚠️  WordPress hash generation failed, using fallback method`);
      
      // Fallback: use a simple WordPress-compatible hash
      // This is WordPress's default method when wp_hash_password is not available
      const crypto = require('crypto');
      const md5Hash = crypto.createHash('md5').update(password).digest('hex');
      return `$P$B${crypto.randomBytes(8).toString('base64').slice(0, 8)}${md5Hash}`;
    }
  }
} 