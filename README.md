# WordPress Batch Hosting Automation Tool

🚀 **Automate the deployment of multiple WordPress sites with dedicated MySQL databases**

This tool creates MySQL databases and deploys WordPress instances automatically from a simple configuration file. Perfect for developers, agencies, and hosting providers who need to manage multiple WordPress sites efficiently.

📊 **NEW: Spreadsheet-Based Configuration!** Use the included `template.csv` file with Excel, Google Sheets, or any spreadsheet application - no more complex JSON editing!

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Commands](#commands)
- [Troubleshooting](#troubleshooting)
- [Examples](#examples)

## 🔧 Prerequisites

Before using this tool, you need to have the following installed and configured:

### 1. **Node.js** (Required)
- **Version**: Node.js 16 or higher
- **Install**: Download from [nodejs.org](https://nodejs.org/)
- **Verify**: Run `node --version` in terminal

### 2. **MySQL Server** (Required)
- **Version**: MySQL 5.7 or higher (or MariaDB 10.3+)
- **Install Options**:
  - **macOS**: `brew install mysql` or download from [mysql.com](https://dev.mysql.com/downloads/mysql/)
  - **Ubuntu/Debian**: `sudo apt install mysql-server`
  - **Windows**: Download from [mysql.com](https://dev.mysql.com/downloads/mysql/)
- **Start MySQL**: 
  - **macOS**: `brew services start mysql`
  - **Linux**: `sudo systemctl start mysql`
  - **Windows**: Start MySQL service from Services panel

### 3. **MySQL Root Access** (Required)
- You need the MySQL root username and password
- **Test access**: `mysql -u root -p` (should connect successfully)
- **If you forgot root password**: [Reset MySQL root password guide](https://dev.mysql.com/doc/refman/8.0/en/resetting-permissions.html)

### 4. **Web Server** (Optional but Recommended)
- **Apache** or **Nginx** for serving WordPress sites
- **PHP 7.4+** with required extensions (mysql, curl, gd, mbstring, xml, zip)

## 📦 Installation

### Option 1: Clone and Install Locally
```bash
# Clone the repository
git clone https://github.com/auroradream04/wp-hosting-automation.git
cd wp-hosting-automation

# Install dependencies
npm install

# Build the project
npm run build
```

### Option 2: Install Globally (Coming Soon)
```bash
# Will be available via npm
npm install -g wp-hosting-automation
```

## ⚙️ Configuration

### Why Use the Spreadsheet Template? 📊

The **spreadsheet template approach** offers several advantages:

✅ **User-Friendly**: No need to understand JSON syntax or worry about formatting errors  
✅ **Familiar Interface**: Use Excel, Google Sheets, or any spreadsheet app you already know  
✅ **Copy & Paste Friendly**: Easily copy sites, credentials, and configuration across rows  
✅ **Bulk Editing**: Change multiple sites at once using spreadsheet features  
✅ **No Escaping Issues**: No need to worry about special characters or quotes  
✅ **Visual Organization**: See all your sites and their configuration in one organized view  
✅ **Easy Sharing**: Share with team members who prefer spreadsheets over technical files  

### Step 1: Create Configuration File

The easiest way to configure the tool is using the included **spreadsheet template**. You can open this in Excel, Google Sheets, or any spreadsheet application.

#### **📊 Spreadsheet Template** (Recommended)

1. **Copy the template**: Use the included `template.csv` file as your starting point
   ```bash
   cp template.csv my-sites.csv
   ```

2. **Edit in your favorite spreadsheet app**:
   - **Excel**: Open `my-sites.csv` directly
   - **Google Sheets**: Import the CSV file
   - **LibreOffice Calc**: Open `my-sites.csv` directly

3. **Fill in your details**:

| Column | Description | Example |
|--------|-------------|---------|
| `Site Name` | Unique identifier for the site (no spaces!) | `acme_corp_site` |
| `Directory Path` | Where WordPress will be installed | `/var/www/html/acme-corp` |
| `WordPress Site Title` | The display name of your website | `Acme Corp Website` |
| `WordPress Admin Username` | Admin username for this site | `admin` |
| `MySQL Host` | MySQL server hostname | `localhost` |
| `MySQL Port` | MySQL server port | `3306` |
| `MySQL Username` | MySQL root username | `root` |
| `MySQL Password` | MySQL root password | `CHANGE_THIS_MYSQL_ROOT_PASSWORD` |
| `Database Password` | Password for all site databases | `secure_shared_password_2024` |
| `WordPress Admin Password` | WordPress admin password for all sites | `strong_wp_admin_password` |
| `WordPress Admin Email` | WordPress admin email for all sites | `admin@yourcompany.com` |

**Template Example:**
```csv
Site Name,Directory Path,WordPress Site Title,WordPress Admin Username,MySQL Host,MySQL Port,MySQL Username,MySQL Password,Database Password,WordPress Admin Password,WordPress Admin Email
acme_corp_site,/var/www/html/acme-corp,Acme Corp Website,admin,localhost,3306,root,CHANGE_THIS_MYSQL_ROOT_PASSWORD,secure_shared_password_2024,strong_wp_admin_password,admin@yourcompany.com
johns_restaurant,/var/www/html/johns-restaurant,John's Italian Restaurant,johnadmin,localhost,3306,root,CHANGE_THIS_MYSQL_ROOT_PASSWORD,secure_shared_password_2024,strong_wp_admin_password,admin@yourcompany.com
beauty_salon_site,/var/www/html/beauty-salon,Beauty & Wellness Salon,beautyadmin,localhost,3306,root,CHANGE_THIS_MYSQL_ROOT_PASSWORD,secure_shared_password_2024,strong_wp_admin_password,admin@yourcompany.com
```

4. **Save as CSV**: Make sure to save/export as CSV format

#### **📄 JSON Format** (Alternative)
If you prefer JSON, create `sites.json`:
```json
{
  "mysql": {
    "host": "localhost",
    "port": 3306,
    "rootUser": "root",
    "rootPassword": "your_mysql_root_password",
    "sharedDbPassword": "shared_password_for_all_databases"
  },
  "wordpress": {
    "adminPassword": "wordpress_admin_password",
    "adminEmail": "admin@yourdomain.com"
  },
  "sites": [
    {
      "site_name": "client1_site",
      "directory_path": "/var/www/html/client1"
    },
    {
      "site_name": "client2_site",
      "directory_path": "/var/www/html/client2"
    },
    {
      "site_name": "test_site",
      "directory_path": "./test_wordpress"
    }
  ]
}
```

#### **📋 Simple CSV Format** (Legacy)
For backwards compatibility, simple CSV files are still supported:
```csv
site_name,directory_path
client1_site,/var/www/html/client1
client2_site,/var/www/html/client2
test_site,./test_wordpress
```

> **Note**: When using simple CSV, the tool will use default MySQL and WordPress credentials. You'll need to set these via environment variables.

### Step 2: Update Your Credentials

**🔐 Important**: Replace the following in your configuration:

- `your_mysql_root_password` → Your actual MySQL root password
- `shared_password_for_all_databases` → A strong password for all WordPress databases
- `wordpress_admin_password` → A strong password for all WordPress admin accounts
- `admin@yourdomain.com` → Your email address

### Step 3: Prepare Directory Paths

Ensure the parent directories exist and have proper permissions:

```bash
# Create directories (example)
sudo mkdir -p /var/www/html/client1
sudo mkdir -p /var/www/html/client2
mkdir -p ./test_wordpress

# Set permissions (adjust as needed for your setup)
sudo chown -R $USER:$USER /var/www/html/
chmod -R 755 /var/www/html/
```

## 🚀 Usage

### Step 1: Test Your MySQL Connection
Before deploying, always test your MySQL connection:

```bash
node dist/index.js test-connection -c my-sites.csv
# or if installed globally: wp-hosting-automation test-connection -c my-sites.csv
```

**Expected Output:**
```
🧪 MySQL Connection Tester
==========================
📋 Reading MySQL configuration from: /path/to/my-sites.csv
🔌 Connecting to MySQL at localhost:3306...
✅ Successfully connected to MySQL as root
🧪 Testing MySQL connection...
✅ MySQL connection test successful

📊 MySQL Server Information:
   Version: 8.0.35
   Host: localhost:3306

✅ MySQL connection is working correctly!
🚀 You can now run deployment commands.
```

### Step 2: Validate Your Configuration
Check your configuration file for errors:

```bash
node dist/index.js validate -c my-sites.csv -v
# or: wp-hosting-automation validate -c my-sites.csv -v
```

### Step 3: Deploy Complete Sites (Recommended)
Run the full deployment process (creates databases, installs WordPress, generates config, sets permissions):

```bash
node dist/index.js deploy -c my-sites.csv -v
# or: wp-hosting-automation deploy -c my-sites.csv -v
```

### Alternative: Step-by-Step Process

If you prefer to run each step individually:

#### Create Databases
Create MySQL databases and users for all sites:

```bash
node dist/index.js create-databases -c my-sites.csv -v
# or: wp-hosting-automation create-databases -c my-sites.csv -v
```

#### Check Database Status
Verify that databases and users were created successfully:

```bash
node dist/index.js check-databases -c my-sites.csv
# or: wp-hosting-automation check-databases -c my-sites.csv
```

#### Install WordPress
Download and install WordPress for all sites:

```bash
node dist/index.js install-wordpress -c my-sites.csv -v
# or: wp-hosting-automation install-wordpress -c my-sites.csv -v
```

#### Check WordPress Status
Verify that WordPress installations completed successfully:

```bash
node dist/index.js check-wordpress -c my-sites.csv
# or: wp-hosting-automation check-wordpress -c my-sites.csv
```

> **Note**: The `deploy` command now automatically creates databases and installs WordPress as part of the process. You can run `create-databases` and `install-wordpress` separately for more control or to test each step individually.

## 📖 Commands

### `validate`
Validate your configuration file without deploying:
```bash
npm run deploy validate [options]

Options:
  -c, --config <file>  Configuration file path (default: sites.json)
  -v, --verbose        Show detailed information
```

### `test-connection`
Test MySQL connection:
```bash
npm run deploy test-connection [options]

Options:
  -c, --config <file>  Configuration file path (default: sites.json)
```

### `create-databases`
Create MySQL databases and users for all sites:
```bash
npm run deploy create-databases [options]

Options:
  -c, --config <file>  Configuration file path (default: sites.json)
  -v, --verbose        Show detailed creation progress
```

### `check-databases`
Check status of databases and users:
```bash
npm run deploy check-databases [options]

Options:
  -c, --config <file>  Configuration file path (default: sites.json)
```

### `cleanup-databases`
⚠️ **DESTRUCTIVE**: Remove all databases and users:
```bash
npm run deploy cleanup-databases [options]

Options:
  -c, --config <file>  Configuration file path (default: sites.json)
  --confirm           Required flag to confirm destructive operation
```

### `install-wordpress`
Download and install WordPress for all sites:
```bash
npm run deploy install-wordpress [options]

Options:
  -c, --config <file>  Configuration file path (default: sites.json)
  -v, --verbose        Show detailed installation progress
```

### `check-wordpress`
Check status of WordPress installations:
```bash
npm run deploy check-wordpress [options]

Options:
  -c, --config <file>  Configuration file path (default: sites.json)
```

### `cleanup-wordpress`
⚠️ **DESTRUCTIVE**: Remove all WordPress installations:
```bash
npm run deploy cleanup-wordpress [options]

Options:
  -c, --config <file>  Configuration file path (default: sites.json)
  --confirm           Required flag to confirm destructive operation
```

### `generate-config`
Generate wp-config.php files for all sites:
```bash
npm run deploy generate-config [options]

Options:
  -c, --config <file>  Configuration file path (default: sites.json)
  -v, --verbose        Show detailed generation progress
```

### `check-config`
Check status of wp-config.php files:
```bash
npm run deploy check-config [options]

Options:
  -c, --config <file>  Configuration file path (default: sites.json)
```

### `cleanup-config`
⚠️ **DESTRUCTIVE**: Remove all wp-config.php files:
```bash
npm run deploy cleanup-config [options]

Options:
  -c, --config <file>  Configuration file path (default: sites.json)
  --confirm           Required flag to confirm destructive operation
```

### `set-permissions`
Set appropriate file permissions for all WordPress sites:
```bash
npm run deploy set-permissions [options]

Options:
  -c, --config <file>  Configuration file path (default: sites.json)
  -v, --verbose        Show detailed permission setting progress
```

### `check-permissions`
Check file permissions status for all WordPress sites:
```bash
npm run deploy check-permissions [options]

Options:
  -c, --config <file>  Configuration file path (default: sites.json)
```

### `fix-permissions`
Fix file permissions for all WordPress sites:
```bash
npm run deploy fix-permissions [options]

Options:
  -c, --config <file>  Configuration file path (default: sites.json)
```

### `deploy`
Deploy WordPress sites (includes database creation, WordPress installation, wp-config.php generation, and file permissions):
```bash
npm run deploy deploy [options]

Options:
  -c, --config <file>  Configuration file path (default: sites.json)
  -v, --verbose        Show detailed deployment progress
```

### `help`
Show help information:
```bash
npm run deploy --help
```

## 🔍 What the Tool Does

### 🚀 **Complete WordPress Setup** - Yes, Everything!

For each site in your configuration, the tool will:

#### **📊 Database Setup**
1. **Create MySQL Database**: `{site_name}_db` (e.g., `acme_corp_site_db`)
2. **Create MySQL User**: `{site_name}_user` (e.g., `acme_corp_site_user`)
3. **Set Database Password**: Uses your "Database Password" for all databases
4. **Grant Permissions**: Full access to the database for the user

#### **🌐 WordPress Installation**
5. **Download WordPress**: Latest version from wordpress.org
6. **Extract WordPress**: Unzips and places files in your specified directory
7. **Generate wp-config.php**: Creates configuration file with:
   - Database connection settings
   - Unique security keys for each site
   - Site-specific table prefix
   - Site URL configuration

#### **👤 WordPress Admin Account**
8. **Create Admin User**: Sets up WordPress admin account with:
   - **Username**: Your "WordPress Admin Username" (per site)
   - **Password**: Your "WordPress Admin Password" 
   - **Email**: Your "WordPress Admin Email"
   - **Role**: Administrator (full access)
   - **Site Title**: Your "WordPress Site Title" (displayed to visitors)

#### **🔒 Security & Permissions**
9. **Set File Permissions**: Applies WordPress security best practices
   - Directories: 755 (readable/executable)
   - Files: 644 (readable)
   - wp-config.php: 600 (secure - owner only)
   - uploads directory: 755 (writable for media)

#### **✅ Ready to Use**
10. **Sites are fully functional**: 
    - Database connected ✅
    - WordPress installed ✅  
    - Admin account created ✅
    - Secure permissions set ✅
    - **Just visit your site URL to start using WordPress!**

### 🎯 **What You Get After Running the Tool:**

- **Fully functional WordPress sites** ready for content
- **Admin access** via `/wp-admin/` with your credentials
- **Secure database setup** with individual databases per site
- **Professional file permissions** following WordPress best practices
- **No manual configuration needed** - everything is automated!

## 🛠️ Troubleshooting

### MySQL Connection Issues

**Error**: `Cannot connect to MySQL server`
```bash
# Check if MySQL is running
# macOS:
brew services list | grep mysql

# Linux:
sudo systemctl status mysql

# Start MySQL if not running
# macOS:
brew services start mysql

# Linux:
sudo systemctl start mysql
```

**Error**: `Access denied for user 'root'`
```bash
# Test your credentials manually
mysql -u root -p

# If you can't connect, reset your root password
# Follow: https://dev.mysql.com/doc/refman/8.0/en/resetting-permissions.html
```

### Permission Issues

**Error**: `Permission denied` when creating directories
```bash
# Fix directory permissions
sudo chown -R $USER:$USER /var/www/html/
chmod -R 755 /var/www/html/
```

### Configuration Issues

**Error**: `Configuration validation failed`
- Check your JSON syntax with a JSON validator
- Ensure all required fields are present
- Verify site names contain only letters, numbers, underscores, and hyphens

### File Permission Issues

**Error**: `Permission denied` when WordPress tries to write files
```bash
# Check current permissions
npm run deploy check-permissions

# Fix permissions automatically
npm run deploy fix-permissions

# Or manually set permissions
chmod -R 755 /var/www/html/your-site/wp-content/
chmod 600 /var/www/html/your-site/wp-config.php
```

**WordPress Upload Issues**
```bash
# Ensure uploads directory is writable
chmod 755 /var/www/html/your-site/wp-content/uploads/
chown -R www-data:www-data /var/www/html/your-site/wp-content/uploads/
```

## 📚 Examples

### Example 1: Basic Setup
```json
{
  "mysql": {
    "host": "localhost",
    "port": 3306,
    "rootUser": "root",
    "rootPassword": "mypassword123",
    "sharedDbPassword": "dbpass123"
  },
  "wordpress": {
    "adminPassword": "wppass123",
    "adminEmail": "admin@example.com"
  },
  "sites": [
    {
      "site_name": "myblog",
      "directory_path": "/var/www/html/myblog"
    }
  ]
}
```

### Example 2: Multiple Sites
```json
{
  "mysql": {
    "host": "localhost",
    "port": 3306,
    "rootUser": "root",
    "rootPassword": "mypassword123",
    "sharedDbPassword": "dbpass123"
  },
  "wordpress": {
    "adminPassword": "wppass123",
    "adminEmail": "admin@agency.com"
  },
  "sites": [
    {
      "site_name": "client_a",
      "directory_path": "/var/www/html/client-a"
    },
    {
      "site_name": "client_b",
      "directory_path": "/var/www/html/client-b"
    },
    {
      "site_name": "portfolio",
      "directory_path": "/var/www/html/portfolio"
    }
  ]
}
```

### Example 3: Remote MySQL Server
```json
{
  "mysql": {
    "host": "192.168.1.100",
    "port": 3306,
    "rootUser": "root",
    "rootPassword": "mypassword123",
    "sharedDbPassword": "dbpass123"
  },
  "wordpress": {
    "adminPassword": "wppass123",
    "adminEmail": "admin@example.com"
  },
  "sites": [
    {
      "site_name": "remote_site",
      "directory_path": "/var/www/html/remote"
    }
  ]
}
```

## 🔒 Security Notes

- **Never commit configuration files with real passwords to version control**
- Use strong passwords for all credentials
- Consider using environment variables for sensitive data
- Regularly update WordPress and MySQL for security patches
- Use HTTPS in production environments

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -m 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you encounter issues:

1. Check the [Troubleshooting](#troubleshooting) section
2. Ensure all [Prerequisites](#prerequisites) are met
3. Test your MySQL connection with `test-connection` command
4. Open an issue on [GitHub](https://github.com/auroradream04/wp-hosting-automation/issues)

---

**Made with ❤️ for WordPress developers and hosting providers** 