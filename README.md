# WP-Host - WordPress Hosting Automation

[![npm version](https://img.shields.io/npm/v/wp-host.svg)](https://www.npmjs.com/package/wp-host)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js CI](https://github.com/auroradream04/wp-host/workflows/Node.js%20CI/badge.svg)](https://github.com/auroradream04/wp-host/actions)

> **Professional WordPress batch deployment tool for hosting providers, developers, and system administrators**

Automate the deployment of multiple WordPress instances with MySQL databases using a simple spreadsheet. Perfect for hosting providers, development agencies, and anyone managing multiple WordPress sites. Features CSV-based configuration, automatic database creation, and production-ready security.

## ✨ Key Features

🚀 **Batch WordPress Deployment** - Deploy dozens of WordPress sites simultaneously  
📊 **Spreadsheet Configuration** - User-friendly CSV format that works with Excel/Google Sheets  
🗄️ **Automated Database Management** - Creates MySQL databases, users, and proper permissions  
🔐 **Production Security** - Generates unique security keys, proper file permissions, secure passwords  
🔑 **Application Password Generation** - Auto-creates API access credentials for each site  
📱 **WP-CLI Integration** - Uses WordPress CLI for reliable, scriptable installations  
🔗 **Permalink Management** - Automatically configures permalinks for wp-json API support  
🌐 **Smart Domain Detection** - Automatically detects domains from directory paths  
📋 **Deployment Reports** - Comprehensive CSV exports with all credentials and URLs  
⚡ **Performance Optimized** - Minimal logging, fast parallel processing  

## 🎯 Perfect For

- **Hosting Providers** - Bulk WordPress deployment for clients
- **Development Agencies** - Rapid staging/development environment setup  
- **System Administrators** - Automated WordPress infrastructure management
- **Freelancers** - Quick client site deployment and handoff
- **Educational Institutions** - Student/course WordPress instances

## 🏃‍♂️ Quick Start

### 1. Install
```bash
npm install -g wp-host
```

### 2. Create Configuration
Download the template spreadsheet:
```bash
wp-host init
# This creates template.csv - edit it with your sites
```

### 3. Deploy
```bash
wp-host deploy -c sites.csv
```

That's it! Your WordPress sites are ready with databases, admin users, and working wp-json APIs.

## 📋 Requirements

- **Node.js** 18+ 
- **MySQL** 5.7+ or 8.0+
- **PHP** 7.4+ with required extensions
- **Web Server** (Apache/Nginx)
- **Root/Sudo Access** for WP-CLI installation

## 🛠️ Installation

### Global Installation (Recommended)
```bash
npm install -g wp-host
wp-host --help
```

### Local Development
```bash
git clone https://github.com/auroradream04/wp-host.git
cd wp-host
npm install
npm run build
wp-host deploy -c sites.csv
```

## 📊 Configuration

### CSV Format (Simple Spreadsheet)
Edit the generated `template.csv` file in Excel, Google Sheets, or any spreadsheet application:

```csv
site_name,directory_path,wordpress_site_title,wordpress_admin_username
mybusiness.com,/var/www/html/mybusiness.com,My Business Website,admin
portfolio.net,/var/www/html/portfolio.net,Creative Portfolio,webmaster
techblog.org,/var/www/html/techblog.org,Tech Blog,blogger
```

**CSV Template Columns:**
- `site_name` - Unique identifier for the site
- `directory_path` - Where WordPress files will be installed
- `wordpress_site_title` - The site title shown in WordPress admin
- `wordpress_admin_username` - Admin username (optional, defaults to 'admin')

### Environment Configuration
Create a `.env` file with your MySQL and WordPress credentials:

```bash
# .env file
MYSQL_ROOT_PASSWORD=your_mysql_root_password
MYSQL_SHARED_DB_PASSWORD=shared_password_for_all_sites
WORDPRESS_ADMIN_PASSWORD=your_wordpress_admin_password
WORDPRESS_ADMIN_EMAIL=admin@yourdomain.com
```

### Auto-Generated Values
The tool intelligently generates:
- **Database Names**: `sitename_db`
- **Database Users**: `sitename_user` 
- **Site URLs**: Extracted from directory paths
- **Security Keys**: Unique WordPress authentication keys
- **Application Passwords**: For API/mobile access

## 🚀 Commands

### Main Deployment
```bash
# Basic deployment
wp-host deploy -c sites.csv

# With application passwords for API access
wp-host deploy -c sites.csv --app-passwords

# Export credentials to spreadsheet
wp-host deploy -c sites.csv --export

# Validate configuration first
wp-host validate -c sites.csv
```

### Individual Operations
```bash
# Database management
wp-host create-databases -c sites.csv
wp-host check-databases -c sites.csv

# WordPress installation
wp-host install-wordpress -c sites.csv
wp-host check-wordpress -c sites.csv

# Security & permissions
wp-host set-permissions -c sites.csv
wp-host check-permissions -c sites.csv

# Application passwords
wp-host generate-app-passwords -c sites.csv

# Export deployment info
wp-host export-deployment -c sites.csv --include-app-passwords
```

### Update Existing Sites
```bash
# Fix permalink structure for wp-json API support
wp-host update-permalinks --confirm

# Use custom permalink structure
wp-host update-permalinks --structure="/%year%/%monthnum%/%postname%/" --confirm
```

## 🔄 Updating Existing Sites

### Permalink Structure Update
If you have existing WordPress sites with "Plain" permalinks that need wp-json API access:

```bash
# Update all sites to use "Post name" permalinks (/%postname%/)
wp-host update-permalinks --confirm

# Use custom permalink structure
wp-host update-permalinks --structure="/%year%/%monthnum%/%postname%/" --confirm
```

**Why this matters:**
- WordPress wp-json API requires pretty permalinks to function
- Plain permalinks (/?p=123) break REST API endpoints
- Post name structure (/%postname%/) enables full API functionality
- All new deployments automatically use Post name structure

**What it does:**
- Uses WP-CLI to safely update permalink structures
- Flushes rewrite rules to ensure changes take effect
- Verifies the changes were applied correctly
- Only affects existing WordPress installations
- Skips sites without WordPress or missing configuration

## 📈 Deployment Workflow

1. **Configuration Validation** - Checks CSV format and required fields
2. **Database Creation** - Creates MySQL databases and users with proper permissions
3. **WordPress Installation** - Downloads, extracts, and configures WordPress
4. **Security Configuration** - Sets file permissions, generates security keys
5. **WP-CLI Setup** - Completes WordPress installation with admin users
6. **Permalink Configuration** - Sets up pretty permalinks for wp-json API
7. **Application Passwords** - Generates API access credentials (optional)
8. **Export Generation** - Creates comprehensive deployment report

## 🔐 Security Features

- **Unique Security Keys** - WordPress authentication salts for each site
- **Proper File Permissions** - 755 for directories, 644 for files
- **Isolated Database Users** - Each site gets its own MySQL user
- **Application Passwords** - Secure API access without exposing main passwords
- **Password Hashing** - WordPress-compatible password encryption
- **API-Ready Permalinks** - Configures permalink structure for REST API support

## 📊 Export & Reporting

After deployment, get a comprehensive CSV report containing:
- Site URLs and admin login links
- Database connection details  
- WordPress admin credentials
- Application passwords for API access
- REST API endpoints (wp-json)
- Deployment status and errors

Perfect for client handoff, team documentation, or development environment setup.

## 🌐 Web Server Configuration

The tool creates WordPress installations ready for production. Configure your web server:

### Apache Virtual Hosts
```apache
<VirtualHost *:80>
    ServerName yoursite.com
    DocumentRoot /var/www/html/yoursite.com
    <Directory /var/www/html/yoursite.com>
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
```

### Nginx Server Blocks
```nginx
server {
    listen 80;
    server_name yoursite.com;
    root /var/www/html/yoursite.com;
    index index.php index.html;
    
    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.1-fpm.sock;
        fastcgi_index index.php;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    }
    
    # WordPress pretty permalink support
    location / {
        try_files $uri $uri/ /index.php?$args;
    }
}
```

## 🛠️ Management Commands

### Database Operations
```bash
# Check database status
wp-host check-databases -c sites.csv

# Clean up databases (careful!)
wp-host cleanup-databases -c sites.csv
```

### WordPress Operations  
```bash
# Check WordPress installations
wp-host check-wordpress -c sites.csv

# Update permalink structures
wp-host update-permalinks --confirm

# Generate deployment report
wp-host report -c sites.csv
```

## 📁 CSV Template

The included `template.csv` provides a user-friendly spreadsheet format:

| site_name | directory_path | wordpress_site_title | wordpress_admin_username |
|-----------|----------------|---------------------|---------------------------|
| example.com | /var/www/html/example.com | Example Website | admin |
| portfolio.dev | /var/www/html/portfolio.dev | My Portfolio | webmaster |
| blog.site | /var/www/html/blog.site | Tech Blog | blogger |

Download this template, add your sites, and you're ready to deploy!

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup
```bash
git clone https://github.com/auroradream04/wp-host.git
cd wp-host
npm install
npm run dev
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙋‍♂️ Support

- **Documentation**: [GitHub Wiki](https://github.com/auroradream04/wp-host/wiki)
- **Issues**: [GitHub Issues](https://github.com/auroradream04/wp-host/issues)  
- **Discussions**: [GitHub Discussions](https://github.com/auroradream04/wp-host/discussions)

## 🌟 Related Projects

- [WP-CLI](https://wp-cli.org/) - WordPress command line interface
- [WordPress](https://wordpress.org/) - The WordPress content management system
- [MySQL](https://mysql.com/) - Database management system

---

**Keywords**: wordpress automation, bulk wordpress deployment, hosting provider tools, wordpress batch install, mysql automation, wordpress cli, hosting management, wordpress developer tools, site deployment automation, wordpress hosting solution, csv configuration, spreadsheet deployment 