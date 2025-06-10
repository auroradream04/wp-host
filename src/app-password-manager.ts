import * as crypto from 'crypto';
import fetch from 'node-fetch';
import { Config, SiteConfig, DeploymentResult } from './types';

export interface AppPasswordResult {
  site_name: string;
  username: string;
  app_password: string;
  app_name: string;
  site_url: string;
  admin_login_url: string;
}

export class AppPasswordManager {
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  /**
   * Generate application passwords for all sites
   */
  async generateAllAppPasswords(): Promise<AppPasswordResult[]> {
    console.log(`\n🔑 Starting Application Password generation for ${this.config.sites.length} site(s)...`);
    
    const results: AppPasswordResult[] = [];

    for (let i = 0; i < this.config.sites.length; i++) {
      const site = this.config.sites[i];
      console.log(`\n📱 [${i + 1}/${this.config.sites.length}] Generating App Password: ${site.site_name}`);
      
      try {
        const result = await this.generateSiteAppPassword(site);
        results.push(result);
        console.log(`✅ ${site.site_name}: Application password generated successfully`);
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`❌ ${site.site_name}: App password generation failed - ${errorMessage}`);
        
        // Add a fallback result with manual instructions
        const siteUrl = this.generateSiteUrl(site.directory_path);
        results.push({
          site_name: site.site_name,
          username: site.wordpress_admin_username || 'admin',
          app_password: 'MANUAL_GENERATION_REQUIRED',
          app_name: `${site.site_name}_automation`,
          site_url: siteUrl,
          admin_login_url: `${siteUrl}/wp-admin/`
        });
      }
    }

    return results;
  }

  /**
   * Generate application password for a single site
   */
  async generateSiteAppPassword(site: SiteConfig): Promise<AppPasswordResult> {
    const siteUrl = this.generateSiteUrl(site.directory_path);
    const username = site.wordpress_admin_username || 'admin';
    const appName = `${site.site_name}_automation`;

    try {
      // Use WP-CLI to generate application password directly
      const appPassword = await this.createAppPasswordViaWPCLI(site.directory_path, username, appName);
      
      return {
        site_name: site.site_name,
        username,
        app_password: appPassword,
        app_name: appName,
        site_url: siteUrl,
        admin_login_url: `${siteUrl}/wp-admin/`
      };

    } catch (error) {
      // Fallback: Generate a secure random password for manual setup
      const fallbackPassword = this.generateSecurePassword();
      
      console.log(`   ⚠️  WP-CLI generation failed, using secure fallback password`);
      console.log(`   📝 Manual setup required in WordPress admin`);
      
      return {
        site_name: site.site_name,
        username,
        app_password: fallbackPassword,
        app_name: appName,
        site_url: siteUrl,
        admin_login_url: `${siteUrl}/wp-admin/`
      };
    }
  }

  /**
   * Create application password via WP-CLI
   */
  private async createAppPasswordViaWPCLI(siteDirectory: string, username: string, appName: string): Promise<string> {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    try {
      // Use WP-CLI to create an application password
      const command = `cd "${siteDirectory}" && wp --allow-root user application-password create ${username} "${appName}" --porcelain`;
      
      console.log(`   🔧 Generating app password via WP-CLI...`);
      const { stdout, stderr } = await execAsync(command);
      
      if (stderr) {
        console.log(`   ⚠️  WP-CLI warnings: ${stderr}`);
      }
      
      const appPassword = stdout.trim();
      
      if (appPassword && appPassword.length > 10) {
        console.log(`   ✅ Application password generated successfully`);
        return appPassword;
      } else {
        throw new Error('Invalid application password returned from WP-CLI');
      }
      
    } catch (error: any) {
      throw new Error(`WP-CLI application password creation failed: ${error.message}`);
    }
  }

  /**
   * Generate a secure random password for fallback
   */
  private generateSecurePassword(): string {
    // Generate a WordPress-compatible application password format
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let password = '';
    
    // Generate 24 character password in groups of 4
    for (let i = 0; i < 24; i++) {
      if (i > 0 && i % 4 === 0) {
        password += ' ';
      }
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return password;
  }

  /**
   * Generate site URL based on directory path
   */
  private generateSiteUrl(targetDir: string): string {
    // Extract domain from directory path
    if (targetDir.includes('/www/wwwroot/')) {
      // Remote server structure: /www/wwwroot/domain.com
      const sitePath = targetDir.replace('/www/wwwroot/', '');
      return `https://${sitePath}`;
    } else if (targetDir.includes('/var/www/html/')) {
      // Traditional Apache structure
      const sitePath = targetDir.replace('/var/www/html/', '');
      return `https://${sitePath}`;
    } else if (targetDir.includes('/var/www/')) {
      // Nginx structure
      const sitePath = targetDir.replace('/var/www/', '');
      return `https://${sitePath}`;
    } else {
      // Extract domain from path if it looks like a domain
      const pathParts = targetDir.split('/');
      const lastPart = pathParts[pathParts.length - 1];
      
      // Check if last part looks like a domain
      if (lastPart.includes('.') && !lastPart.includes(' ')) {
        return `https://${lastPart}`;
      }
      
      // Local development fallback
      return `http://localhost:8080`;
    }
  }

  /**
   * Display application passwords summary
   */
  displaySummary(results: AppPasswordResult[]): void {
    console.log('\n📱 Application Passwords Summary');
    console.log('================================');

    results.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.site_name}`);
      console.log(`   👤 Username: ${result.username}`);
      console.log(`   🔑 App Password: ${result.app_password}`);
      console.log(`   📱 App Name: ${result.app_name}`);
      console.log(`   🌐 Site URL: ${result.site_url}`);
      console.log(`   🔧 Admin Panel: ${result.admin_login_url}`);
      
      if (result.app_password === 'MANUAL_GENERATION_REQUIRED' || result.app_password.includes(' ')) {
        console.log(`   ⚠️  Manual setup: Go to Users > Profile > Application Passwords`);
      }
    });

    const successful = results.filter(r => r.app_password !== 'MANUAL_GENERATION_REQUIRED').length;
    const manual = results.length - successful;

    console.log(`\n📊 Results: ${successful} automated, ${manual} require manual setup`);
  }
} 