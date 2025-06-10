export interface MySQLConfig {
  host: string;
  port: number;
  adminUser: string;
  adminPassword: string;
}

export interface SiteConfig {
  site_name: string;
  directory_path: string;
  database_name: string;
  db_user?: string;
  admin_email?: string;
}

export interface Config {
  mysql?: MySQLConfig;
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
  wordpress_path?: string;
  errors?: string[];
}

export interface ValidationError {
  field: string;
  message: string;
  siteIndex?: number;
} 