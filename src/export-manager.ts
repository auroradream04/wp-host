import * as fs from 'fs-extra';
import * as path from 'path';
import { Config, SiteConfig, DeploymentResult } from './types';
import { AppPasswordResult } from './app-password-manager';

export interface ExportData {
  site_name: string;
  site_title: string;
  site_url: string;
  directory_path: string;
  admin_login_url: string;
  admin_username: string;
  admin_password: string;
  admin_email: string;
  database_name: string;
  database_user: string;
  database_password: string;
  database_host: string;
  app_password?: string;
  app_name?: string;
  deployment_status: string;
  deployment_errors?: string;
  api_endpoint: string;
  created_date: string;
}

export class ExportManager {
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  /**
   * Generate comprehensive deployment export
   */
  async generateDeploymentExport(
    deploymentResults: DeploymentResult[],
    appPasswordResults?: AppPasswordResult[],
    exportPath?: string
  ): Promise<string> {
    console.log('\n📊 Generating deployment export...');

    const exportData = this.prepareExportData(deploymentResults, appPasswordResults);
    const csvContent = this.generateCSV(exportData);
    
    // Determine export file path
    const defaultFileName = `wordpress-deployment-${new Date().toISOString().split('T')[0]}.csv`;
    const finalExportPath = exportPath || path.join(process.cwd(), defaultFileName);

    // Write CSV file
    await fs.writeFile(finalExportPath, csvContent, 'utf8');

    console.log(`✅ Export saved to: ${finalExportPath}`);
    this.displayExportSummary(exportData, finalExportPath);

    return finalExportPath;
  }

  /**
   * Prepare export data by combining all deployment information
   */
  private prepareExportData(
    deploymentResults: DeploymentResult[],
    appPasswordResults?: AppPasswordResult[]
  ): ExportData[] {
    const exportData: ExportData[] = [];

    this.config.sites.forEach(site => {
      const deploymentResult = deploymentResults.find(r => r.site_name === site.site_name);
      const appPasswordResult = appPasswordResults?.find(r => r.site_name === site.site_name);

      const siteUrl = this.generateSiteUrl(site.directory_path);
      const adminLoginUrl = `${siteUrl}/wp-admin/`;
      const apiEndpoint = `${siteUrl}/wp-json/wp/v2/`;

      const exportRow: ExportData = {
        site_name: site.site_name,
        site_title: site.wordpress_site_title || 'WordPress Site',
        site_url: siteUrl,
        directory_path: site.directory_path,
        admin_login_url: adminLoginUrl,
        admin_username: site.wordpress_admin_username || 'admin',
        admin_password: this.config.wordpress.adminPassword,
        admin_email: this.config.wordpress.adminEmail,
        database_name: site.database_name || `${site.site_name}_db`,
        database_user: site.db_user || `${site.site_name}_user`,
        database_password: this.config.mysql.sharedDbPassword,
        database_host: `${this.config.mysql.host}:${this.config.mysql.port}`,
        deployment_status: deploymentResult?.status || 'unknown',
        deployment_errors: deploymentResult?.errors?.join('; '),
        api_endpoint: apiEndpoint,
        created_date: new Date().toISOString(),
      };

      // Add app password data if available
      if (appPasswordResult) {
        exportRow.app_password = appPasswordResult.app_password;
        exportRow.app_name = appPasswordResult.app_name;
      }

      exportData.push(exportRow);
    });

    return exportData;
  }

  /**
   * Generate CSV content from export data
   */
  private generateCSV(data: ExportData[]): string {
    // Define headers in a user-friendly order
    const headers = [
      'Site Name',
      'Site Title', 
      'Site URL',
      'Admin Login URL',
      'Admin Username',
      'Admin Password',
      'Admin Email',
      'Database Name',
      'Database User',
      'Database Password',
      'Database Host',
      'App Password',
      'App Name',
      'API Endpoint',
      'Directory Path',
      'Deployment Status',
      'Deployment Errors',
      'Created Date'
    ];

    // Map headers to data keys
    const headerMap: { [key: string]: keyof ExportData } = {
      'Site Name': 'site_name',
      'Site Title': 'site_title',
      'Site URL': 'site_url',
      'Admin Login URL': 'admin_login_url',
      'Admin Username': 'admin_username',
      'Admin Password': 'admin_password',
      'Admin Email': 'admin_email',
      'Database Name': 'database_name',
      'Database User': 'database_user',
      'Database Password': 'database_password',
      'Database Host': 'database_host',
      'App Password': 'app_password',
      'App Name': 'app_name',
      'API Endpoint': 'api_endpoint',
      'Directory Path': 'directory_path',
      'Deployment Status': 'deployment_status',
      'Deployment Errors': 'deployment_errors',
      'Created Date': 'created_date'
    };

    // Generate CSV
    let csv = headers.join(',') + '\n';

    data.forEach(row => {
      const csvRow = headers.map(header => {
        const key = headerMap[header];
        let value = row[key] || '';
        
        // Handle CSV escaping
        if (typeof value === 'string') {
          // Escape quotes and wrap in quotes if contains comma, quote, or newline
          if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            value = '"' + value.replace(/"/g, '""') + '"';
          }
        }
        
        return value;
      });
      
      csv += csvRow.join(',') + '\n';
    });

    return csv;
  }

  /**
   * Generate site URL based on directory path
   */
  private generateSiteUrl(targetDir: string): string {
    if (targetDir.includes('/var/www/html/')) {
      const sitePath = targetDir.replace('/var/www/html/', '');
      return `http://localhost/${sitePath}`;
    } else if (targetDir.includes('/var/www/')) {
      const sitePath = targetDir.replace('/var/www/', '');
      return `http://localhost/${sitePath}`;
    } else {
      return `http://localhost:8080`;
    }
  }

  /**
   * Display export summary
   */
  private displayExportSummary(data: ExportData[], exportPath: string): void {
    console.log('\n📋 Export Summary');
    console.log('================');
    console.log(`📁 File: ${exportPath}`);
    console.log(`📊 Sites: ${data.length}`);
    
    const successful = data.filter(d => d.deployment_status === 'success').length;
    const failed = data.filter(d => d.deployment_status === 'failed').length;
    
    console.log(`✅ Successful: ${successful}`);
    console.log(`❌ Failed: ${failed}`);
    
    const hasAppPasswords = data.some(d => d.app_password && d.app_password !== 'MANUAL_GENERATION_REQUIRED');
    if (hasAppPasswords) {
      const appPasswordCount = data.filter(d => d.app_password && d.app_password !== 'MANUAL_GENERATION_REQUIRED').length;
      console.log(`🔑 App Passwords: ${appPasswordCount}/${data.length}`);
    }

    console.log('\n💡 Export includes:');
    console.log('   • Site URLs and admin login links');
    console.log('   • WordPress admin credentials');
    console.log('   • Database connection details');
    if (hasAppPasswords) {
      console.log('   • Application passwords for API access');
    }
    console.log('   • WordPress REST API endpoints');
    console.log('   • Deployment status and error details');
    
    console.log('\n📱 Perfect for:');
    console.log('   • Client handoff documentation');
    console.log('   • Team credential sharing');
    console.log('   • Development environment setup');
    console.log('   • API integration projects');
  }

  /**
   * Generate export template
   */
  async generateExportTemplate(templatePath?: string): Promise<string> {
    const defaultPath = templatePath || path.join(process.cwd(), 'deployment-export-template.csv');
    
    const templateHeaders = [
      'Site Name',
      'Site Title', 
      'Site URL',
      'Admin Login URL',
      'Admin Username',
      'Admin Password',
      'Admin Email',
      'Database Name',
      'Database User', 
      'Database Password',
      'Database Host',
      'App Password',
      'App Name',
      'API Endpoint',
      'Directory Path',
      'Deployment Status',
      'Deployment Errors',
      'Created Date'
    ];

    const sampleRow = [
      'example_site',
      'Example WordPress Site',
      'http://localhost/example',
      'http://localhost/example/wp-admin/',
      'admin',
      'wp_admin_password_123',
      'admin@example.com',
      'example_site_db',
      'example_site_user',
      'shared_db_password_123',
      'localhost:3306',
      'abcd efgh ijkl mnop qrst uvwx',
      'example_site_automation',
      'http://localhost/example/wp-json/wp/v2/',
      '/var/www/html/example',
      'success',
      '',
      '2023-12-07T10:30:00.000Z'
    ];

    const csvContent = templateHeaders.join(',') + '\n' + sampleRow.join(',') + '\n';
    
    await fs.writeFile(defaultPath, csvContent, 'utf8');
    console.log(`📄 Export template saved to: ${defaultPath}`);
    
    return defaultPath;
  }
} 