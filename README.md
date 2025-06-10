# WordPress Batch Hosting Automation Tool

🚀 **Automate the deployment of multiple WordPress sites with dedicated MySQL databases**

This tool creates MySQL databases and deploys WordPress instances automatically from a simple configuration file. Perfect for developers, agencies, and hosting providers who need to manage multiple WordPress sites efficiently.

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

### Step 1: Create Configuration File

Create a configuration file with your sites and credentials. You can use either JSON or CSV format:

#### **JSON Format** (Recommended)
Create `sites.json`:
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

#### **CSV Format** (Simple)
Create `sites.csv`:
```csv
site_name,directory_path
client1_site,/var/www/html/client1
client2_site,/var/www/html/client2
test_site,./test_wordpress
```

> **Note**: When using CSV, the tool will use default MySQL and WordPress credentials. You'll need to update them in the generated configuration.

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
npm run deploy test-connection
# or if installed globally: wp-hosting-automation test-connection
```

**Expected Output:**
```
🧪 MySQL Connection Tester
==========================
📋 Reading MySQL configuration from: /path/to/sites.json
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
npm run deploy validate -v
# or: wp-hosting-automation validate -v
```

### Step 3: Create Databases
Create MySQL databases and users for all sites:

```bash
npm run deploy create-databases -v
# or: wp-hosting-automation create-databases -v
```

### Step 4: Check Database Status
Verify that databases and users were created successfully:

```bash
npm run deploy check-databases
# or: wp-hosting-automation check-databases
```

### Step 5: Install WordPress
Download and install WordPress for all sites:

```bash
npm run deploy install-wordpress -v
# or: wp-hosting-automation install-wordpress -v
```

### Step 6: Check WordPress Status
Verify that WordPress installations completed successfully:

```bash
npm run deploy check-wordpress
# or: wp-hosting-automation check-wordpress
```

### Step 7: Deploy Complete Sites
Run the full deployment (includes database creation and WordPress installation):

```bash
npm run deploy deploy -v
# or: wp-hosting-automation deploy -v
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

### `deploy`
Deploy WordPress sites (includes database creation and WordPress installation):
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

For each site in your configuration, the tool will:

1. **Create MySQL Database**: `{site_name}_db` (e.g., `client1_site_db`)
2. **Create MySQL User**: `{site_name}_user` (e.g., `client1_site_user`)
3. **Set Database Password**: Uses your `sharedDbPassword` for all databases
4. **Grant Permissions**: Full access to the database for the user
5. **Download WordPress**: Latest version to the specified directory
6. **Configure WordPress**: Creates `wp-config.php` with database settings
7. **Set Admin Credentials**: Uses your shared WordPress admin credentials

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