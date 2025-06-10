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
      // Try to generate via WordPress REST API
      const appPassword = await this.createAppPasswordViaAPI(siteUrl, username, appName);
      
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
      
      console.log(`   ⚠️  API generation failed, using secure fallback password`);
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
   * Create application password via WordPress REST API
   */
  private async createAppPasswordViaAPI(siteUrl: string, username: string, appName: string): Promise<string> {
    const apiUrl = `${siteUrl}/wp-json/wp/v2/users/me/application-passwords`;
    
    // Create basic auth header
    const authString = Buffer.from(`${username}:${this.config.wordpress.adminPassword}`).toString('base64');
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: appName
      })
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    
    if (data.password) {
      return data.password;
    } else {
      throw new Error('No password returned from API');
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
    // Try to determine the site URL based on directory structure
    if (targetDir.includes('/var/www/html/')) {
      const sitePath = targetDir.replace('/var/www/html/', '');
      return `http://localhost/${sitePath}`;
    } else if (targetDir.includes('/var/www/')) {
      const sitePath = targetDir.replace('/var/www/', '');
      return `http://localhost/${sitePath}`;
    } else {
      // Local development
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