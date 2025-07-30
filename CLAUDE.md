# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

wp-host is a WordPress hosting automation tool for bulk site deployment with MySQL database management. It's published as an npm package under the name "wp-host" and provides a CLI for automating WordPress deployments with CSV-based configuration.

## Key Commands

### Development Commands
- `npm run dev` - Run in development mode with nodemon and ts-node
- `npm run build` - Compile TypeScript to JavaScript in `dist/` directory
- `npm start` - Run the compiled JavaScript from `dist/index.js`
- `npm run deploy` - Build and run the application

### CLI Commands (wp-host)
The main CLI commands after building or installing the package:

#### Primary Operations
- `wp-host deploy -c sites.csv` - Full deployment with interactive prompts
- `wp-host deploy --skip-prompts --app-passwords --export` - Non-interactive deployment
- `wp-host validate -c sites.csv` - Validate configuration without deploying
- `wp-host test-connection -c sites.csv` - Test MySQL connection

#### Individual Operations
- `wp-host create-databases -c sites.csv` - Create MySQL databases and users only
- `wp-host install-wordpress -c sites.csv` - Install WordPress files only
- `wp-host generate-config -c sites.csv` - Generate wp-config.php files only
- `wp-host set-permissions -c sites.csv` - Set file permissions only
- `wp-host generate-app-passwords -c sites.csv` - Generate API access passwords

#### Status Checking
- `wp-host check-databases -c sites.csv` - Check database status
- `wp-host check-wordpress -c sites.csv` - Check WordPress installations
- `wp-host check-config -c sites.csv` - Check wp-config.php files
- `wp-host check-permissions -c sites.csv` - Check file permissions

#### Maintenance
- `wp-host update-permalinks --confirm` - Update existing sites for wp-json API support
- `wp-host export-deployment -c sites.csv --include-app-passwords` - Export deployment info to CSV

## Architecture

### Core Manager Classes
The application follows a modular architecture with specialized manager classes in `src/`:

- **ConfigParser** (`config-parser.ts`) - Parses JSON/CSV configuration files
- **MySQLManager** (`mysql-manager.ts`) - Low-level MySQL connection handling
- **DatabaseManager** (`database-manager.ts`) - Database and user creation operations  
- **WordPressManager** (`wordpress-manager.ts`) - WordPress download, installation, and WP-CLI operations
- **ConfigManager** (`config-manager.ts`) - wp-config.php file generation with security keys
- **PermissionsManager** (`permissions-manager.ts`) - File permission management (755/644)
- **AppPasswordManager** (`app-password-manager.ts`) - WordPress application password generation for API access
- **ExportManager** (`export-manager.ts`) - CSV export functionality for deployment results
- **PromptService** (`prompt-service.ts`) - Interactive CLI prompts using inquirer

### Data Flow
1. **Configuration Parsing** - CSV/JSON files parsed into TypeScript interfaces
2. **Database Setup** - MySQL databases and users created with proper permissions
3. **WordPress Installation** - WordPress downloaded, extracted, and configured
4. **Security Configuration** - File permissions set, security keys generated
5. **WP-CLI Integration** - WordPress setup completed using WP-CLI commands
6. **Optional Features** - Application passwords and CSV exports generated

### Configuration Sources
- **CSV Files** (Primary) - Spreadsheet-friendly format with columns: site_name, directory_path, wordpress_site_title, wordpress_admin_username
- **JSON Files** (Legacy) - Structured configuration with mysql, wordpress, and sites sections
- **Environment Variables** - MySQL credentials, WordPress admin settings via .env file

### Key Features
- **CSV-First Approach** - Auto-detects sites.csv, template.csv, then sites.json
- **WP-CLI Integration** - Uses WordPress CLI for reliable installations and permalink management
- **Security Best Practices** - Unique security keys per site, proper file permissions, isolated database users
- **API-Ready Setup** - Configures permalinks for wp-json REST API support
- **Batch Operations** - Handles multiple sites simultaneously with progress reporting

### Error Handling
Each manager class provides summary reporting with success/failure counts. The main deployment process stops on critical failures (database creation) but continues with warnings for non-critical operations.

### Testing Strategy
The package includes no automated tests currently (`"test": "echo \"Error: no test specified\" && exit 1"`). Manual testing is done through deployment validation and status checking commands.

## Development Notes

### TypeScript Configuration
- Target: ES2020 with CommonJS modules
- Strict mode enabled with full type checking
- Source maps and declarations generated for debugging

### Dependencies
- **Core**: commander (CLI), fs-extra (file operations), mysql2 (database), inquirer (prompts)
- **WordPress**: Downloads WordPress via fetch, uses system WP-CLI for setup
- **Security**: bcryptjs for password hashing, unique salt generation per site

### File Structure
- `src/` - TypeScript source code
- `dist/` - Compiled JavaScript (git-ignored)
- `template.csv` - CSV template for user configuration
- Configuration files auto-detected in order: sites.csv, template.csv, sites.json