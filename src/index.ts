#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs-extra';
import * as path from 'path';
import { ConfigParser } from './config-parser';
import { MySQLManager } from './mysql-manager';
import { DatabaseManager } from './database-manager';
import { WordPressManager } from './wordpress-manager';
import { ConfigManager } from './config-manager';
import { PermissionsManager } from './permissions-manager';
import { AppPasswordManager } from './app-password-manager';
import { ExportManager } from './export-manager';
import { PromptService } from './prompt-service';
import { Config } from './types';

const program = new Command();

program
  .name('wp-hosting-automation')
  .description('WordPress Batch Hosting Tool - Deploy multiple WordPress sites with MySQL databases')
  .version('1.0.0');

program
  .command('deploy')
  .description('Deploy WordPress sites with interactive options')
  .option('-c, --config <file>', 'Configuration file path (JSON or CSV)', 'sites.json')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--skip-prompts', 'Skip interactive prompts (non-interactive mode)')
  .option('--app-passwords', 'Generate application passwords automatically')
  .option('--export [path]', 'Export deployment results to CSV')
  .action(async (options) => {
    const configPath = path.resolve(options.config);
    
    if (!await fs.pathExists(configPath)) {
      console.error(`❌ Configuration file not found: ${configPath}`);
      console.log('\n💡 Create a configuration file with your site details:');
      console.log('   - JSON format: sites.json');
      console.log('   - CSV format: sites.csv');
      process.exit(1);
    }

    try {
      console.log(`📋 Reading configuration from: ${configPath}`);
      const config = await ConfigParser.parseConfig(configPath);
      
      if (options.verbose) {
        console.log(`✅ Configuration loaded successfully:`);
        console.log(`   - Found ${config.sites.length} site(s) to deploy`);
        console.log(`   - MySQL: ${config.mysql.host}:${config.mysql.port}`);
        console.log(`   - WordPress Admin: ${config.wordpress.adminEmail}`);
      }

      // Initialize prompt service
      const promptService = new PromptService();
      
      // Get deployment options (interactive or from CLI flags)
      let deploymentOptions;
      if (options.skipPrompts) {
        deploymentOptions = {
          cleanAllDirectories: false, // Default to false for non-interactive mode
          generateAppPasswords: !!options.appPasswords,
          generateExport: !!options.export,
          exportPath: typeof options.export === 'string' ? options.export : undefined
        };
      } else {
        deploymentOptions = await promptService.promptDeploymentOptions();
      }

      // Show deployment preview and get confirmation
      if (!options.skipPrompts) {
        const confirmed = await promptService.promptDeploymentPreview(config.sites.length, deploymentOptions);
        if (!confirmed) {
          console.log('❌ Deployment cancelled by user');
          process.exit(0);
        }
      }

      console.log('\n🔄 Starting deployment process...');
      
      // Step 1: Create databases
      console.log('\n📊 Step 1: Creating databases and users...');
      const databaseManager = new DatabaseManager(config);
      await databaseManager.initialize();
      
      const dbResults = await databaseManager.createAllDatabases();
      const dbSummary = databaseManager.getSummary(dbResults);
      
      if (dbSummary.failed > 0) {
        console.error(`❌ Database creation failed for ${dbSummary.failed} sites. Aborting deployment.`);
        await databaseManager.close();
        process.exit(1);
      }
      
      console.log(`✅ Databases created successfully (${dbSummary.successful}/${dbSummary.total})`);
      await databaseManager.close();
      
      // Step 2: WordPress installation and setup
      console.log('\n🌐 Step 2: Installing and configuring WordPress...');
      const wordpressManager = new WordPressManager(config);
      
      const wpResults = await wordpressManager.installAllSites(deploymentOptions.cleanAllDirectories);
      const wpSummary = wordpressManager.getSummary(wpResults);
      
      if (wpSummary.failed > 0) {
        console.error(`❌ WordPress installation failed for ${wpSummary.failed} sites. Deployment incomplete.`);
        process.exit(1);
      }
      
      console.log(`✅ WordPress installed and configured successfully (${wpSummary.successful}/${wpSummary.total})`);
      
      // Step 3: Set file permissions
      console.log('\n🔒 Step 3: Setting file permissions...');
      const permissionsManager = new PermissionsManager(config);
      
      const permissionResults = await permissionsManager.setAllPermissions();
      const permissionSummary = permissionsManager.getSummary(permissionResults);
      
      if (permissionSummary.failed > 0) {
        console.error(`❌ Permission setting failed for ${permissionSummary.failed} sites. Deployment incomplete.`);
        process.exit(1);
      }
      
      console.log(`✅ File permissions set successfully (${permissionSummary.successful}/${permissionSummary.total})`);
      
      // Step 4: Generate application passwords (optional)
      let appPasswordResults;
      if (deploymentOptions.generateAppPasswords) {
        console.log('\n🔑 Step 4: Generating application passwords...');
        const appPasswordManager = new AppPasswordManager(config);
        
        appPasswordResults = await appPasswordManager.generateAllAppPasswords();
        appPasswordManager.displaySummary(appPasswordResults);
      }
      
      // Step 5: Export deployment results (optional)
      let exportPath;
      if (deploymentOptions.generateExport) {
        console.log('\n📊 Step 5: Exporting deployment results...');
        const exportManager = new ExportManager(config);
        
        exportPath = await exportManager.generateDeploymentExport(
          wpResults,
          appPasswordResults,
          deploymentOptions.exportPath
        );
      }
      
      // Show completion summary
      const totalSuccessful = Math.min(dbSummary.successful, wpSummary.successful, permissionSummary.successful);
      
      promptService.displayCompletionSummary(
        totalSuccessful,
        config.sites.length,
        !!appPasswordResults,
        !!exportPath,
        exportPath
      );
      
      if (options.verbose) {
        console.log('\n📋 Detailed Results:');
        for (const site of config.sites) {
          const siteResult = wpResults.find(r => r.site_name === site.site_name);
          console.log(`\n📦 Site: ${site.site_name}`);
          console.log(`   Directory: ${site.directory_path}`);
          console.log(`   Database: ${site.database_name}`);
          console.log(`   DB User: ${site.db_user}`);
          console.log(`   Admin User: ${site.wordpress_admin_username || 'admin'}`);
          console.log(`   Admin Email: ${config.wordpress.adminEmail}`);
          
          if (siteResult?.wordpress_info) {
            console.log(`   Site URL: ${siteResult.wordpress_info.site_url}`);
          }
          
          if (appPasswordResults) {
            const appResult = appPasswordResults.find(r => r.site_name === site.site_name);
            if (appResult) {
              console.log(`   App Password: ${appResult.app_password}`);
            }
          }
        }
      }
      
    } catch (error) {
      console.error(`❌ Configuration error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('Validate configuration file without deploying')
  .option('-c, --config <file>', 'Configuration file path (JSON or CSV)', 'sites.json')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (options) => {
    console.log('🔍 WordPress Configuration Validator');
    console.log('===================================');
    
    const configPath = path.resolve(options.config);
    
    if (!await fs.pathExists(configPath)) {
      console.error(`❌ Configuration file not found: ${configPath}`);
      process.exit(1);
    }

    try {
      console.log(`📋 Validating configuration: ${configPath}`);
      const config = await ConfigParser.parseConfig(configPath);
      
      console.log('✅ Configuration is valid!');
      console.log(`\n📊 Summary:`);
      console.log(`   - Sites to deploy: ${config.sites.length}`);
      console.log(`   - MySQL: ${config.mysql.host}:${config.mysql.port}`);
      console.log(`   - WordPress Admin: ${config.wordpress.adminEmail}`);
      
      if (options.verbose) {
        console.log('\n📋 Site Details:');
        config.sites.forEach((site, index) => {
          console.log(`   ${index + 1}. ${site.site_name}`);
          console.log(`      Path: ${site.directory_path}`);
          console.log(`      Database: ${site.database_name}`);
          if (site.db_user) console.log(`      DB User: ${site.db_user}`);
        });
        
        console.log('\n🗄️  MySQL Configuration:');
        console.log(`      Host: ${config.mysql.host}`);
        console.log(`      Port: ${config.mysql.port}`);
        console.log(`      Root User: ${config.mysql.rootUser}`);
        console.log(`      Root Password: ${'*'.repeat(config.mysql.rootPassword.length)}`);
        console.log(`      Shared DB Password: ${'*'.repeat(config.mysql.sharedDbPassword.length)}`);
        
        console.log('\n🌐 WordPress Configuration:');
        console.log(`      Admin Email: ${config.wordpress.adminEmail}`);
        console.log(`      Admin Password: ${'*'.repeat(config.wordpress.adminPassword.length)}`);
      }
      
    } catch (error) {
      console.error(`❌ Validation failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

program
  .command('test-connection')
  .description('Test MySQL connection using configuration file')
  .option('-c, --config <file>', 'Configuration file path (JSON or CSV)', 'sites.json')
  .action(async (options) => {
    console.log('🧪 MySQL Connection Tester');
    console.log('==========================');
    
    const configPath = path.resolve(options.config);
    
    if (!await fs.pathExists(configPath)) {
      console.error(`❌ Configuration file not found: ${configPath}`);
      process.exit(1);
    }

    try {
      console.log(`📋 Reading MySQL configuration from: ${configPath}`);
      const config = await ConfigParser.parseConfig(configPath);
      
      const mysqlManager = new MySQLManager(config.mysql);
      
      // Test connection
      const isConnected = await mysqlManager.testConnection();
      
      if (isConnected) {
        // Get server info if connection successful
        await mysqlManager.connect();
        const serverInfo = await mysqlManager.getServerInfo();
        await mysqlManager.disconnect();
        
        console.log('\n📊 MySQL Server Information:');
        console.log(`   Version: ${serverInfo.version}`);
        console.log(`   Host: ${serverInfo.host}:${serverInfo.port}`);
        console.log('\n✅ MySQL connection is working correctly!');
        console.log('🚀 You can now run deployment commands.');
      } else {
        console.log('\n❌ MySQL connection failed!');
        console.log('💡 Please check:');
        console.log('   - MySQL server is running');
        console.log('   - Host and port are correct');
        console.log('   - Root username and password are correct');
        process.exit(1);
      }
      
    } catch (error) {
      console.error(`❌ Connection test failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

program
  .command('create-databases')
  .description('Create MySQL databases and users for all sites')
  .option('-c, --config <file>', 'Configuration file path (JSON or CSV)', 'sites.json')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (options) => {
    console.log('🗄️  WordPress Database Creator');
    console.log('==============================');
    
    const configPath = path.resolve(options.config);
    
    if (!await fs.pathExists(configPath)) {
      console.error(`❌ Configuration file not found: ${configPath}`);
      process.exit(1);
    }

    let databaseManager: DatabaseManager | null = null;

    try {
      console.log(`📋 Reading configuration from: ${configPath}`);
      const config = await ConfigParser.parseConfig(configPath);
      
      if (options.verbose) {
        console.log(`✅ Configuration loaded: ${config.sites.length} site(s) found`);
      }

      // Initialize database manager
      databaseManager = new DatabaseManager(config);
      await databaseManager.initialize();

      // Create all databases
      const results = await databaseManager.createAllDatabases();

      // Show summary
      const summary = databaseManager.getSummary(results);
      console.log('\n📊 Database Creation Summary');
      console.log('============================');
      console.log(`Total Sites: ${summary.total}`);
      console.log(`✅ Successful: ${summary.successful}`);
      console.log(`❌ Failed: ${summary.failed}`);
      console.log(`⏭️  Skipped: ${summary.skipped}`);

      if (summary.failed > 0) {
        console.log('\n⚠️  Some databases failed to create. Check the errors above.');
        process.exit(1);
      } else {
        console.log('\n🎉 All databases created successfully!');
        console.log('✅ Ready for WordPress installation.');
      }
      
    } catch (error) {
      console.error(`❌ Database creation failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    } finally {
      if (databaseManager) {
        await databaseManager.close();
      }
    }
  });

program
  .command('check-databases')
  .description('Check status of databases and users for all sites')
  .option('-c, --config <file>', 'Configuration file path (JSON or CSV)', 'sites.json')
  .action(async (options) => {
    console.log('🔍 WordPress Database Status Checker');
    console.log('====================================');
    
    const configPath = path.resolve(options.config);
    
    if (!await fs.pathExists(configPath)) {
      console.error(`❌ Configuration file not found: ${configPath}`);
      process.exit(1);
    }

    let databaseManager: DatabaseManager | null = null;

    try {
      console.log(`📋 Reading configuration from: ${configPath}`);
      const config = await ConfigParser.parseConfig(configPath);

      // Initialize database manager
      databaseManager = new DatabaseManager(config);
      await databaseManager.initialize();

      // Generate report
      await databaseManager.generateReport();
      
    } catch (error) {
      console.error(`❌ Database check failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    } finally {
      if (databaseManager) {
        await databaseManager.close();
      }
    }
  });

program
  .command('reset-wordpress')
  .description('Reset WordPress tables in databases (keeps databases and users intact)')
  .option('-c, --config <file>', 'Configuration file path (JSON or CSV)', 'sites.json')
  .option('--confirm', 'Skip confirmation prompt')
  .action(async (options) => {
    console.log('🔄 WordPress Table Reset');
    console.log('========================');
    console.log('⚠️  WARNING: This will delete all WordPress data but keep databases and users!');
    
    if (!options.confirm) {
      console.log('\n❌ This is a destructive operation. Use --confirm flag to proceed.');
      console.log('Example: wp-hosting-automation reset-wordpress --confirm');
      process.exit(1);
    }
    
    const configPath = path.resolve(options.config);
    
    if (!await fs.pathExists(configPath)) {
      console.error(`❌ Configuration file not found: ${configPath}`);
      process.exit(1);
    }

    let databaseManager: DatabaseManager | null = null;

    try {
      console.log(`📋 Reading configuration from: ${configPath}`);
      const config = await ConfigParser.parseConfig(configPath);

      // Initialize database manager
      databaseManager = new DatabaseManager(config);
      await databaseManager.initialize();

      // Reset WordPress tables
      await databaseManager.resetWordPressTables();
      
      console.log('\n✅ WordPress reset completed successfully!');
      console.log('🚀 You can now run deployment again for a fresh WordPress setup.');
      
    } catch (error) {
      console.error(`❌ WordPress reset failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    } finally {
      if (databaseManager) {
        await databaseManager.close();
      }
    }
  });

program
  .command('cleanup-databases')
  .description('Remove all databases and users (WARNING: DESTRUCTIVE!)')
  .option('-c, --config <file>', 'Configuration file path (JSON or CSV)', 'sites.json')
  .option('--confirm', 'Skip confirmation prompt')
  .action(async (options) => {
    console.log('🧹 WordPress Database Cleanup');
    console.log('=============================');
    console.log('⚠️  WARNING: This will permanently delete all databases and users!');
    
    if (!options.confirm) {
      console.log('\n❌ This is a destructive operation. Use --confirm flag to proceed.');
      console.log('Example: wp-hosting-automation cleanup-databases --confirm');
      process.exit(1);
    }
    
    const configPath = path.resolve(options.config);
    
    if (!await fs.pathExists(configPath)) {
      console.error(`❌ Configuration file not found: ${configPath}`);
      process.exit(1);
    }

    let databaseManager: DatabaseManager | null = null;

    try {
      console.log(`📋 Reading configuration from: ${configPath}`);
      const config = await ConfigParser.parseConfig(configPath);

      // Initialize database manager
      databaseManager = new DatabaseManager(config);
      await databaseManager.initialize();

      // Cleanup all databases
      await databaseManager.cleanupAllDatabases();
      
    } catch (error) {
      console.error(`❌ Database cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    } finally {
      if (databaseManager) {
        await databaseManager.close();
      }
    }
  });

program
  .command('install-wordpress')
  .description('Download and install WordPress for all sites')
  .option('-c, --config <file>', 'Configuration file path (JSON or CSV)', 'sites.json')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (options) => {
    console.log('🌐 WordPress Installer');
    console.log('======================');
    
    const configPath = path.resolve(options.config);
    
    if (!await fs.pathExists(configPath)) {
      console.error(`❌ Configuration file not found: ${configPath}`);
      process.exit(1);
    }

    let wordpressManager: WordPressManager | null = null;

    try {
      console.log(`📋 Reading configuration from: ${configPath}`);
      const config = await ConfigParser.parseConfig(configPath);
      
      if (options.verbose) {
        console.log(`✅ Configuration loaded: ${config.sites.length} site(s) found`);
      }

      // Initialize WordPress manager
      wordpressManager = new WordPressManager(config);

      // Install WordPress for all sites
      const results = await wordpressManager.installAllSites();

      // Show summary
      const summary = wordpressManager.getSummary(results);
      console.log('\n📊 WordPress Installation Summary');
      console.log('==================================');
      console.log(`Total Sites: ${summary.total}`);
      console.log(`✅ Successful: ${summary.successful}`);
      console.log(`❌ Failed: ${summary.failed}`);
      console.log(`⏭️  Skipped: ${summary.skipped}`);

      if (summary.failed > 0) {
        console.log('\n⚠️  Some WordPress installations failed. Check the errors above.');
        process.exit(1);
      } else {
        console.log('\n🎉 All WordPress installations completed successfully!');
        console.log('✅ Ready for configuration.');
      }
      
    } catch (error) {
      console.error(`❌ WordPress installation failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

program
  .command('check-wordpress')
  .description('Check status of WordPress installations for all sites')
  .option('-c, --config <file>', 'Configuration file path (JSON or CSV)', 'sites.json')
  .action(async (options) => {
    console.log('🔍 WordPress Status Checker');
    console.log('===========================');
    
    const configPath = path.resolve(options.config);
    
    if (!await fs.pathExists(configPath)) {
      console.error(`❌ Configuration file not found: ${configPath}`);
      process.exit(1);
    }

    try {
      console.log(`📋 Reading configuration from: ${configPath}`);
      const config = await ConfigParser.parseConfig(configPath);

      // Initialize WordPress manager
      const wordpressManager = new WordPressManager(config);

      // Generate report
      await wordpressManager.generateReport();
      
    } catch (error) {
      console.error(`❌ WordPress check failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

program
  .command('cleanup-wordpress')
  .description('Remove all WordPress installations (WARNING: DESTRUCTIVE!)')
  .option('-c, --config <file>', 'Configuration file path (JSON or CSV)', 'sites.json')
  .option('--confirm', 'Skip confirmation prompt')
  .action(async (options) => {
    console.log('🧹 WordPress Cleanup');
    console.log('====================');
    console.log('⚠️  WARNING: This will permanently delete all WordPress installations!');
    
    if (!options.confirm) {
      console.log('\n❌ This is a destructive operation. Use --confirm flag to proceed.');
      console.log('Example: wp-hosting-automation cleanup-wordpress --confirm');
      process.exit(1);
    }
    
    const configPath = path.resolve(options.config);
    
    if (!await fs.pathExists(configPath)) {
      console.error(`❌ Configuration file not found: ${configPath}`);
      process.exit(1);
    }

    try {
      console.log(`📋 Reading configuration from: ${configPath}`);
      const config = await ConfigParser.parseConfig(configPath);

      // Initialize WordPress manager
      const wordpressManager = new WordPressManager(config);

      // Cleanup all installations
      await wordpressManager.cleanupAllInstallations();
      
    } catch (error) {
      console.error(`❌ WordPress cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

program
  .command('generate-config')
  .description('Generate wp-config.php files for all sites')
  .option('-c, --config <file>', 'Configuration file path (JSON or CSV)', 'sites.json')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (options) => {
    console.log('⚙️  WordPress Configuration Generator');
    console.log('====================================');
    
    const configPath = path.resolve(options.config);
    
    if (!await fs.pathExists(configPath)) {
      console.error(`❌ Configuration file not found: ${configPath}`);
      process.exit(1);
    }

    try {
      console.log(`📋 Reading configuration from: ${configPath}`);
      const config = await ConfigParser.parseConfig(configPath);
      
      if (options.verbose) {
        console.log(`✅ Configuration loaded: ${config.sites.length} site(s) found`);
      }

      // Initialize config manager
      const configManager = new ConfigManager(config);

      // Generate wp-config.php for all sites
      const results = await configManager.generateAllConfigs();

      // Show summary
      const summary = configManager.getSummary(results);
      console.log('\n📊 wp-config.php Generation Summary');
      console.log('===================================');
      console.log(`Total Sites: ${summary.total}`);
      console.log(`✅ Successful: ${summary.successful}`);
      console.log(`❌ Failed: ${summary.failed}`);
      console.log(`⏭️  Skipped: ${summary.skipped}`);

      if (summary.failed > 0) {
        console.log('\n⚠️  Some wp-config.php files failed to generate. Check the errors above.');
        process.exit(1);
      } else {
        console.log('\n🎉 All wp-config.php files generated successfully!');
        console.log('✅ WordPress sites are ready to use.');
      }
      
    } catch (error) {
      console.error(`❌ Configuration generation failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

program
  .command('check-config')
  .description('Check status of wp-config.php files for all sites')
  .option('-c, --config <file>', 'Configuration file path (JSON or CSV)', 'sites.json')
  .action(async (options) => {
    console.log('🔍 wp-config.php Status Checker');
    console.log('=================================');
    
    const configPath = path.resolve(options.config);
    
    if (!await fs.pathExists(configPath)) {
      console.error(`❌ Configuration file not found: ${configPath}`);
      process.exit(1);
    }

    try {
      console.log(`📋 Reading configuration from: ${configPath}`);
      const config = await ConfigParser.parseConfig(configPath);

      // Initialize config manager
      const configManager = new ConfigManager(config);

      // Generate report
      await configManager.checkAllConfigs();
      
    } catch (error) {
      console.error(`❌ Configuration check failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

program
  .command('cleanup-config')
  .description('Remove all wp-config.php files (WARNING: DESTRUCTIVE!)')
  .option('-c, --config <file>', 'Configuration file path (JSON or CSV)', 'sites.json')
  .option('--confirm', 'Skip confirmation prompt')
  .action(async (options) => {
    console.log('🧹 wp-config.php Cleanup');
    console.log('=========================');
    console.log('⚠️  WARNING: This will permanently delete all wp-config.php files!');
    
    if (!options.confirm) {
      console.log('\n❌ This is a destructive operation. Use --confirm flag to proceed.');
      console.log('Example: wp-hosting-automation cleanup-config --confirm');
      process.exit(1);
    }
    
    const configPath = path.resolve(options.config);
    
    if (!await fs.pathExists(configPath)) {
      console.error(`❌ Configuration file not found: ${configPath}`);
      process.exit(1);
    }

    try {
      console.log(`📋 Reading configuration from: ${configPath}`);
      const config = await ConfigParser.parseConfig(configPath);

      // Initialize config manager
      const configManager = new ConfigManager(config);

      // Cleanup all configurations
      await configManager.cleanupAllConfigs();
      
    } catch (error) {
      console.error(`❌ Configuration cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

program
  .command('set-permissions')
  .description('Set appropriate file permissions for all WordPress sites')
  .option('-c, --config <file>', 'Configuration file path (JSON or CSV)', 'sites.json')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (options) => {
    console.log('🔒 WordPress Permissions Manager');
    console.log('================================');
    
    const configPath = path.resolve(options.config);
    
    if (!await fs.pathExists(configPath)) {
      console.error(`❌ Configuration file not found: ${configPath}`);
      process.exit(1);
    }

    try {
      console.log(`📋 Reading configuration from: ${configPath}`);
      const config = await ConfigParser.parseConfig(configPath);
      
      if (options.verbose) {
        console.log(`✅ Configuration loaded: ${config.sites.length} site(s) found`);
      }

      // Initialize permissions manager
      const permissionsManager = new PermissionsManager(config);

      // Set permissions for all sites
      const results = await permissionsManager.setAllPermissions();

      // Show summary
      const summary = permissionsManager.getSummary(results);
      console.log('\n📊 Permissions Setting Summary');
      console.log('==============================');
      console.log(`Total Sites: ${summary.total}`);
      console.log(`✅ Successful: ${summary.successful}`);
      console.log(`❌ Failed: ${summary.failed}`);

      if (summary.failed > 0) {
        console.log('\n⚠️  Some sites failed permission setting. Check the errors above.');
        process.exit(1);
      } else {
        console.log('\n🎉 All file permissions set successfully!');
        console.log('✅ WordPress sites are properly secured.');
      }
      
    } catch (error) {
      console.error(`❌ Permission setting failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

program
  .command('check-permissions')
  .description('Check file permissions status for all WordPress sites')
  .option('-c, --config <file>', 'Configuration file path (JSON or CSV)', 'sites.json')
  .action(async (options) => {
    console.log('🔍 WordPress Permissions Checker');
    console.log('=================================');
    
    const configPath = path.resolve(options.config);
    
    if (!await fs.pathExists(configPath)) {
      console.error(`❌ Configuration file not found: ${configPath}`);
      process.exit(1);
    }

    try {
      console.log(`📋 Reading configuration from: ${configPath}`);
      const config = await ConfigParser.parseConfig(configPath);

      // Initialize permissions manager
      const permissionsManager = new PermissionsManager(config);

      // Generate report
      await permissionsManager.checkAllPermissions();
      
    } catch (error) {
      console.error(`❌ Permission check failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

program
  .command('fix-permissions')
  .description('Fix file permissions for all WordPress sites')
  .option('-c, --config <file>', 'Configuration file path (JSON or CSV)', 'sites.json')
  .action(async (options) => {
    console.log('🔧 WordPress Permissions Fixer');
    console.log('===============================');
    
    const configPath = path.resolve(options.config);
    
    if (!await fs.pathExists(configPath)) {
      console.error(`❌ Configuration file not found: ${configPath}`);
      process.exit(1);
    }

    try {
      console.log(`📋 Reading configuration from: ${configPath}`);
      const config = await ConfigParser.parseConfig(configPath);

      // Initialize permissions manager
      const permissionsManager = new PermissionsManager(config);

      // Fix all permissions
      await permissionsManager.fixAllPermissions();
      
    } catch (error) {
      console.error(`❌ Permission fix failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

program
  .command('generate-app-passwords')
  .description('Generate WordPress application passwords for API access')
  .option('-c, --config <file>', 'Configuration file path (JSON or CSV)', 'sites.json')
  .action(async (options) => {
    console.log('🔑 WordPress Application Password Generator');
    console.log('===========================================');
    
    const configPath = path.resolve(options.config);
    
    if (!await fs.pathExists(configPath)) {
      console.error(`❌ Configuration file not found: ${configPath}`);
      process.exit(1);
    }

    try {
      console.log(`📋 Reading configuration from: ${configPath}`);
      const config = await ConfigParser.parseConfig(configPath);

      // Initialize app password manager
      const appPasswordManager = new AppPasswordManager(config);

      // Generate application passwords
      const results = await appPasswordManager.generateAllAppPasswords();
      appPasswordManager.displaySummary(results);
      
    } catch (error) {
      console.error(`❌ Application password generation failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

program
  .command('export-deployment')
  .description('Export deployment information to CSV spreadsheet')
  .option('-c, --config <file>', 'Configuration file path (JSON or CSV)', 'sites.json')
  .option('-o, --output <file>', 'Export file path (must end with .csv)')
  .option('--include-app-passwords', 'Include application passwords in export')
  .action(async (options) => {
    console.log('📊 Deployment Export Generator');
    console.log('==============================');
    
    const configPath = path.resolve(options.config);
    
    if (!await fs.pathExists(configPath)) {
      console.error(`❌ Configuration file not found: ${configPath}`);
      process.exit(1);
    }

    try {
      console.log(`📋 Reading configuration from: ${configPath}`);
      const config = await ConfigParser.parseConfig(configPath);

      // Initialize export manager
      const exportManager = new ExportManager(config);
      
      // Mock deployment results (since this is a standalone export)
      const mockResults = config.sites.map(site => ({
        site_name: site.site_name,
        status: 'success' as const,
        wordpress_path: site.directory_path,
        wordpress_info: {
          site_url: exportManager['generateSiteUrl'](site.directory_path),
          admin_user: site.wordpress_admin_username || 'admin',
          admin_password: config.wordpress.adminPassword,
          admin_email: config.wordpress.adminEmail
        }
      }));

      // Generate app passwords if requested
      let appPasswordResults;
      if (options.includeAppPasswords) {
        console.log('\n🔑 Generating application passwords for export...');
        const appPasswordManager = new AppPasswordManager(config);
        appPasswordResults = await appPasswordManager.generateAllAppPasswords();
      }

      // Generate export
      const exportPath = await exportManager.generateDeploymentExport(
        mockResults,
        appPasswordResults,
        options.output
      );

      console.log('\n✅ Export completed successfully!');
      console.log(`📁 File saved to: ${exportPath}`);
      
    } catch (error) {
      console.error(`❌ Export failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

program
  .command('update-permalinks')
  .description('Update permalink structure for all WordPress sites (for existing sites only)')
  .option('-c, --config <file>', 'Configuration file path (JSON or CSV)', 'sites.json')
  .option('-s, --structure <structure>', 'Permalink structure pattern', '/%postname%/')
  .option('--confirm', 'Skip confirmation prompt')
  .action(async (options) => {
    console.log('🔗 WordPress Permalink Structure Updater');
    console.log('========================================');
    console.log(`📝 New structure: ${options.structure}`);
    
    if (!options.confirm) {
      console.log('\n⚠️  This will update the permalink structure for all sites in your configuration.');
      console.log('   This is designed for existing WordPress installations only.');
      console.log('   Future deployments will automatically use the Post name structure.');
      console.log('\n❌ Use --confirm flag to proceed.');
      console.log(`Example: wp-hosting-automation update-permalinks --confirm`);
      console.log(`Custom: wp-hosting-automation update-permalinks --structure="/%year%/%postname%/" --confirm`);
      process.exit(1);
    }
    
    const configPath = path.resolve(options.config);
    
    if (!await fs.pathExists(configPath)) {
      console.error(`❌ Configuration file not found: ${configPath}`);
      process.exit(1);
    }

    try {
      console.log(`📋 Reading configuration from: ${configPath}`);
      const config = await ConfigParser.parseConfig(configPath);

      // Initialize WordPress manager
      const wordpressManager = new WordPressManager(config);

      // Update permalinks for all sites
      const results = await wordpressManager.updateAllPermalinks(options.structure);
      
      const summary = wordpressManager.getSummary(results);
      
      if (summary.failed > 0) {
        console.log('\n⚠️  Some sites failed to update. Check the errors above.');
        console.log('💡 Note: This only works on existing WordPress installations.');
        process.exit(1);
      } else if (summary.successful === 0) {
        console.log('\n⚠️  No sites were updated.');
        console.log('💡 Make sure your sites have WordPress installed and configured.');
        process.exit(1);
      } else {
        console.log('\n🎉 Permalink structure updated successfully!');
        console.log(`✅ ${summary.successful} sites now use: ${options.structure}`);
        console.log('\n💡 Your wp-json API endpoints should now work properly.');
        console.log('   Example: https://yoursite.com/wp-json/wp/v2/posts');
      }
      
    } catch (error) {
      console.error(`❌ Permalink update failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// Add help examples
program.on('--help', () => {
  console.log('');
  console.log('Examples:');
  console.log('  # Validation and testing');
  console.log('  $ wp-hosting-automation validate');
  console.log('  $ wp-hosting-automation test-connection');
  console.log('');
  console.log('  # Full deployment (interactive)');
  console.log('  $ wp-hosting-automation deploy');
  console.log('  $ wp-hosting-automation deploy -c my-sites.csv -v');
  console.log('');
  console.log('  # Non-interactive deployment with options');
  console.log('  $ wp-hosting-automation deploy --skip-prompts --app-passwords --export');
  console.log('  $ wp-hosting-automation deploy --skip-prompts --export /path/to/results.csv');
  console.log('');
  console.log('  # Individual operations');
  console.log('  $ wp-hosting-automation create-databases');
  console.log('  $ wp-hosting-automation install-wordpress');
  console.log('  $ wp-hosting-automation generate-config');
  console.log('  $ wp-hosting-automation set-permissions');
  console.log('');
  console.log('  # Update existing sites');
  console.log('  $ wp-hosting-automation update-permalinks --confirm');
  console.log('  $ wp-hosting-automation update-permalinks --structure="/%year%/%postname%/" --confirm');
  console.log('');
  console.log('  # Optional features');
  console.log('  $ wp-hosting-automation generate-app-passwords');
  console.log('  $ wp-hosting-automation export-deployment --include-app-passwords');
  console.log('  $ wp-hosting-automation export-deployment -o my-deployment.csv');
  console.log('');
  console.log('  # Status checking');
  console.log('  $ wp-hosting-automation check-databases');
  console.log('  $ wp-hosting-automation check-wordpress');
  console.log('  $ wp-hosting-automation check-config');
  console.log('  $ wp-hosting-automation check-permissions');
  console.log('');
  console.log('Configuration file formats:');
  console.log('  📄 CSV (recommended): Use template.csv for user-friendly column headers');
  console.log('  📄 JSON: { "mysql": {...}, "wordpress": {...}, "sites": [...] }');
  console.log('');
  console.log('Features:');
  console.log('  🔧 Complete WordPress automation (databases + installation + configuration)');
  console.log('  🔑 Application password generation for API access');
  console.log('  📊 Export deployment results to spreadsheet');
  console.log('  💬 Interactive prompts for optional features');
  console.log('  🛡️ Security best practices (file permissions, unique keys)');
});

program.parse();
