export interface MySQLConfig {
  host: string;
  port: number;
  rootUser: string;
  rootPassword: string;
  // Shared database password for all created databases
  sharedDbPassword: string;
}

export interface WordPressConfig {
  // Shared WordPress admin credentials for all sites
  adminPassword: string;
  adminEmail: string;
}

export interface SiteConfig {
  site_name: string;
  directory_path: string;
  // Optional: if not provided, will be auto-generated as {site_name}_db
  database_name?: string;
  // Optional: if not provided, will be auto-generated as {site_name}_user
  db_user?: string;
}

export interface Config {
  mysql: MySQLConfig;
  wordpress: WordPressConfig;
  sites: SiteConfig[];
}

export interface DeploymentResult {
  site_name: string;
  status: 'success' | 'failed' | 'skipped';
  database_info?: {
    database_name: string;
    username: string;
    password: string;
    host: string;
    port: number;
  };
  wordpress_info?: {
    site_url: string;
    admin_user: string;
    admin_password: string;
    admin_email: string;
  };
  wordpress_path?: string;
  errors?: string[];
}

export interface ValidationError {
  field: string;
  message: string;
  siteIndex?: number;
} 