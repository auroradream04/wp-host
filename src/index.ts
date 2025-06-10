#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs-extra';
import * as path from 'path';
import { ConfigParser } from './config-parser';
import { MySQLManager } from './mysql-manager';
import { DatabaseManager } from './database-manager';
import { WordPressManager } from './wordpress-manager';
import { Config } from './types';

const program = new Command();

program
  .name('wp-hosting-automation')
  .description('WordPress Batch Hosting Tool - Deploy multiple WordPress sites with MySQL databases')
  .version('1.0.0');

program
  .command('deploy')
  .description('Deploy WordPress sites from configuration file')
  .option('-c, --config <file>', 'Configuration file path (JSON or CSV)', 'sites.json')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (options) => {
    console.log('🚀 WordPress Batch Hosting Tool');
    console.log('================================');
    
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
      
      // Step 2: WordPress installation
      console.log('\n🌐 Step 2: Installing WordPress...');
      const wordpressManager = new WordPressManager(config);
      
      const wpResults = await wordpressManager.installAllSites();
      const wpSummary = wordpressManager.getSummary(wpResults);
      
      if (wpSummary.failed > 0) {
        console.error(`❌ WordPress installation failed for ${wpSummary.failed} sites. Deployment incomplete.`);
        process.exit(1);
      }
      
      console.log(`✅ WordPress installed successfully (${wpSummary.successful}/${wpSummary.total})`);
      
      console.log('\n📊 Deployment Summary:');
      console.log(`✅ Databases: ${dbSummary.successful}/${dbSummary.total} created`);
      console.log(`✅ WordPress: ${wpSummary.successful}/${wpSummary.total} installed`);
      console.log('🚧 Configuration: wp-config.php generation pending');
      
      for (const site of config.sites) {
        console.log(`\n📦 Site: ${site.site_name}`);
        console.log(`   Directory: ${site.directory_path} ✅`);
        console.log(`   Database: ${site.database_name} ✅`);
        console.log(`   WordPress: ✅ Installed`);
        console.log(`   Config: ⏳ Pending wp-config.php generation`);
        
        if (options.verbose) {
          console.log(`   DB User: ${site.db_user}`);
          console.log(`   DB Name: ${site.database_name}`);
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

// Add help examples
program.on('--help', () => {
  console.log('');
  console.log('Examples:');
  console.log('  $ wp-hosting-automation validate');
  console.log('  $ wp-hosting-automation test-connection');
  console.log('  $ wp-hosting-automation create-databases');
  console.log('  $ wp-hosting-automation check-databases');
  console.log('  $ wp-hosting-automation install-wordpress');
  console.log('  $ wp-hosting-automation check-wordpress');
  console.log('  $ wp-hosting-automation deploy');
  console.log('  $ wp-hosting-automation deploy -c my-sites.json -v');
  console.log('');
  console.log('Configuration file formats:');
  console.log('  JSON: { "sites": [{"site_name": "...", "directory_path": "...", "database_name": "..."}] }');
  console.log('  CSV:  site_name,directory_path,database_name');
});

program.parse();
