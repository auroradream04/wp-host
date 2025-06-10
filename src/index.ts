#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs-extra';
import * as path from 'path';
import { ConfigParser } from './config-parser';
import { MySQLManager } from './mysql-manager';
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
      
      // TODO: Implement actual deployment logic
      for (const site of config.sites) {
        console.log(`\n📦 Processing site: ${site.site_name}`);
        console.log(`   Directory: ${site.directory_path}`);
        console.log(`   Database: ${site.database_name}`);
        
        if (options.verbose) {
          console.log(`   DB User: ${site.db_user || 'auto-generated'}`);
          console.log(`   DB Name: ${site.database_name || 'auto-generated'}`);
        }
        
        // Placeholder for actual deployment
        console.log(`   Status: ⏳ Ready for deployment`);
      }
      
      console.log('\n✅ Configuration validation complete!');
      console.log('🚧 Deployment functionality will be implemented in next tasks.');
      
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

// Add help examples
program.on('--help', () => {
  console.log('');
  console.log('Examples:');
  console.log('  $ wp-hosting-automation deploy');
  console.log('  $ wp-hosting-automation deploy -c my-sites.json -v');
  console.log('  $ wp-hosting-automation validate -c sites.csv');
  console.log('  $ wp-hosting-automation test-connection');
  console.log('');
  console.log('Configuration file formats:');
  console.log('  JSON: { "sites": [{"site_name": "...", "directory_path": "...", "database_name": "..."}] }');
  console.log('  CSV:  site_name,directory_path,database_name');
});

program.parse();
