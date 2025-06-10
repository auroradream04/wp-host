import * as fs from 'fs-extra';
import * as path from 'path';
import { Config, SiteConfig, MySQLConfig, ValidationError } from './types';

export class ConfigParser {
  
  /**
   * Parse configuration file (JSON or CSV)
   */
  static async parseConfig(configPath: string): Promise<Config> {
    const ext = path.extname(configPath).toLowerCase();
    
    if (ext === '.json') {
      return this.parseJsonConfig(configPath);
    } else if (ext === '.csv') {
      return this.parseCsvConfig(configPath);
    } else {
      throw new Error(`Unsupported configuration file format: ${ext}. Supported formats: .json, .csv`);
    }
  }

  /**
   * Parse JSON configuration file
   */
  private static async parseJsonConfig(configPath: string): Promise<Config> {
    try {
      const content = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(content) as Config;
      
      this.validateConfig(config);
      return config;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in configuration file: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Parse CSV configuration file
   */
  private static async parseCsvConfig(configPath: string): Promise<Config> {
    try {
      const content = await fs.readFile(configPath, 'utf-8');
      const lines = content.trim().split('\n');
      
      if (lines.length < 2) {
        throw new Error('CSV file must have at least a header row and one data row');
      }

      const headers = lines[0].split(',').map(h => h.trim());
      const requiredHeaders = ['site_name', 'directory_path', 'database_name'];
      
      // Validate headers
      for (const required of requiredHeaders) {
        if (!headers.includes(required)) {
          throw new Error(`Missing required CSV header: ${required}`);
        }
      }

      const sites: SiteConfig[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        
        if (values.length !== headers.length) {
          throw new Error(`Row ${i + 1}: Expected ${headers.length} columns, got ${values.length}`);
        }

        const site: SiteConfig = {
          site_name: '',
          directory_path: '',
          database_name: ''
        };

        headers.forEach((header, index) => {
          const value = values[index];
          switch (header) {
            case 'site_name':
              site.site_name = value;
              break;
            case 'directory_path':
              site.directory_path = value;
              break;
            case 'database_name':
              site.database_name = value;
              break;
            case 'db_user':
              site.db_user = value;
              break;
            case 'admin_email':
              site.admin_email = value;
              break;
          }
        });

        sites.push(site);
      }

      const config: Config = { sites };
      this.validateConfig(config);
      return config;
    } catch (error) {
      throw new Error(`Error parsing CSV file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validate configuration structure and data
   */
  private static validateConfig(config: Config): void {
    const errors: ValidationError[] = [];

    // Validate sites array exists
    if (!config.sites || !Array.isArray(config.sites)) {
      errors.push({
        field: 'sites',
        message: 'Configuration must contain a "sites" array'
      });
      throw new Error(`Configuration validation failed:\n${errors.map(e => `- ${e.field}: ${e.message}`).join('\n')}`);
    }

    // Validate sites array is not empty
    if (config.sites.length === 0) {
      errors.push({
        field: 'sites',
        message: 'Sites array cannot be empty'
      });
    }

    // Validate each site configuration
    config.sites.forEach((site, index) => {
      this.validateSiteConfig(site, index, errors);
    });

    // Validate MySQL config if provided
    if (config.mysql) {
      this.validateMySQLConfig(config.mysql, errors);
    }

    // Check for duplicate site names and database names
    this.checkDuplicates(config.sites, errors);

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.map(e => 
        e.siteIndex !== undefined 
          ? `- Site ${e.siteIndex + 1} (${e.field}): ${e.message}`
          : `- ${e.field}: ${e.message}`
      ).join('\n')}`);
    }
  }

  /**
   * Validate individual site configuration
   */
  private static validateSiteConfig(site: SiteConfig, index: number, errors: ValidationError[]): void {
    // Required fields
    if (!site.site_name || site.site_name.trim() === '') {
      errors.push({
        field: 'site_name',
        message: 'Site name is required and cannot be empty',
        siteIndex: index
      });
    }

    if (!site.directory_path || site.directory_path.trim() === '') {
      errors.push({
        field: 'directory_path',
        message: 'Directory path is required and cannot be empty',
        siteIndex: index
      });
    }

    if (!site.database_name || site.database_name.trim() === '') {
      errors.push({
        field: 'database_name',
        message: 'Database name is required and cannot be empty',
        siteIndex: index
      });
    }

    // Validate site name format (alphanumeric, underscore, hyphen)
    if (site.site_name && !/^[a-zA-Z0-9_-]+$/.test(site.site_name)) {
      errors.push({
        field: 'site_name',
        message: 'Site name can only contain letters, numbers, underscores, and hyphens',
        siteIndex: index
      });
    }

    // Validate database name format (MySQL naming rules)
    if (site.database_name && !/^[a-zA-Z0-9_]+$/.test(site.database_name)) {
      errors.push({
        field: 'database_name',
        message: 'Database name can only contain letters, numbers, and underscores',
        siteIndex: index
      });
    }

    // Validate directory path format
    if (site.directory_path) {
      const normalizedPath = path.normalize(site.directory_path);
      if (normalizedPath !== site.directory_path.replace(/\\/g, '/')) {
        // Allow both forward and backward slashes, but normalize for comparison
      }
    }

    // Validate email format if provided
    if (site.admin_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(site.admin_email)) {
      errors.push({
        field: 'admin_email',
        message: 'Invalid email format',
        siteIndex: index
      });
    }
  }

  /**
   * Validate MySQL configuration
   */
  private static validateMySQLConfig(mysql: MySQLConfig, errors: ValidationError[]): void {
    if (!mysql.host || mysql.host.trim() === '') {
      errors.push({
        field: 'mysql.host',
        message: 'MySQL host is required'
      });
    }

    if (!mysql.port || mysql.port < 1 || mysql.port > 65535) {
      errors.push({
        field: 'mysql.port',
        message: 'MySQL port must be between 1 and 65535'
      });
    }

    if (!mysql.adminUser || mysql.adminUser.trim() === '') {
      errors.push({
        field: 'mysql.adminUser',
        message: 'MySQL admin user is required'
      });
    }

    if (!mysql.adminPassword || mysql.adminPassword.trim() === '') {
      errors.push({
        field: 'mysql.adminPassword',
        message: 'MySQL admin password is required'
      });
    }
  }

  /**
   * Check for duplicate site names and database names
   */
  private static checkDuplicates(sites: SiteConfig[], errors: ValidationError[]): void {
    const siteNames = new Set<string>();
    const dbNames = new Set<string>();

    sites.forEach((site, index) => {
      if (siteNames.has(site.site_name)) {
        errors.push({
          field: 'site_name',
          message: `Duplicate site name: ${site.site_name}`,
          siteIndex: index
        });
      } else {
        siteNames.add(site.site_name);
      }

      if (dbNames.has(site.database_name)) {
        errors.push({
          field: 'database_name',
          message: `Duplicate database name: ${site.database_name}`,
          siteIndex: index
        });
      } else {
        dbNames.add(site.database_name);
      }
    });
  }

  /**
   * Get default MySQL configuration
   */
  static getDefaultMySQLConfig(): MySQLConfig {
    return {
      host: 'localhost',
      port: 3306,
      adminUser: 'root',
      adminPassword: ''
    };
  }
} 