# WordPress Hosting Automation

[![npm version](https://img.shields.io/npm/v/wp-hosting-automation.svg)](https://www.npmjs.com/package/wp-hosting-automation)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js CI](https://github.com/auroradream04/wp-hosting-automation/workflows/Node.js%20CI/badge.svg)](https://github.com/auroradream04/wp-hosting-automation/actions)

> **Professional WordPress batch deployment tool for hosting providers, developers, and system administrators**

Automate the deployment of multiple WordPress instances with MySQL databases, perfect for hosting providers, development agencies, and anyone managing multiple WordPress sites. Features spreadsheet-based configuration, automatic database creation, and production-ready security configurations.

## ✨ Key Features

🚀 **Batch WordPress Deployment** - Deploy dozens of WordPress sites simultaneously  
🗄️ **Automated Database Management** - Creates MySQL databases, users, and proper permissions  
📊 **Spreadsheet Configuration** - User-friendly CSV format that works with Excel/Google Sheets  
🔐 **Production Security** - Generates unique security keys, proper file permissions, secure passwords  
🔑 **Application Password Generation** - Auto-creates API access credentials for each site  
📱 **WP-CLI Integration** - Uses WordPress CLI for reliable, scriptable installations  
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
npm install -g wp-hosting-automation
```

### 2. Create Configuration
Download the template and add your sites:
```bash
wp-hosting-automation init
# Edit the generated template.csv with your sites
```

### 3. Deploy
```bash
wp-hosting-automation deploy -c sites.csv
```

That's it! Your WordPress sites are ready with databases, admin users, and application passwords.

## 📋 Requirements

- **Node.js** 18+ 
- **MySQL** 5.7+ or 8.0+
- **PHP** 7.4+ with required extensions
- **Web Server** (Apache/Nginx)
- **Root/Sudo Access** for WP-CLI installation

## 🛠️ Installation Methods

### Global Installation (Recommended)
```bash
npm install -g wp-hosting-automation
wp-hosting-automation --help
```

### Local Development
```bash
git clone https://github.com/auroradream04/wp-hosting-automation.git
cd wp-hosting-automation
npm install
npm run build
npm start deploy -c sites.csv
```

## 📊 Configuration

### CSV Format (Recommended)
Perfect for non-technical users. Works with Excel, Google Sheets, or any spreadsheet application:

```csv
site_name,directory_path,wordpress_site_title,wordpress_admin_username
phjilibetfree100.online,/www/wwwroot/wordpress.phjilibetfree100.online,Cherry Blossom Casino,TTBSEO
jilibet88.site,/www/wwwroot/wordpress.jilibet88.site,Cherry Blossom Casino,TTBSEO
jilibet88.store,/www/wwwroot/wordpress.jilibet88.store,Cherry Blossom Casino,TTBSEO
```

### Environment Configuration
Set your MySQL and WordPress credentials:

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

## 🚀 Usage Examples

### Basic Deployment
```bash
wp-hosting-automation deploy -c sites.csv
```

### Advanced Options
```bash
# Interactive mode with prompts
wp-hosting-automation deploy -c sites.csv

# Generate application passwords for API access
wp-hosting-automation deploy -c sites.csv --app-passwords

# Export all credentials to spreadsheet
wp-hosting-automation deploy -c sites.csv --export

# Validate configuration without deploying
wp-hosting-automation validate -c sites.csv
```

### Standalone Commands
```bash
# Only create databases
wp-hosting-automation create-databases -c sites.csv

# Generate application passwords for existing sites
wp-hosting-automation generate-app-passwords -c sites.csv

# Export deployment information
wp-hosting-automation export-deployment -c sites.csv --include-app-passwords
```

## 📈 Deployment Workflow

1. **Configuration Validation** - Checks CSV/JSON format and required fields
2. **Database Creation** - Creates MySQL databases and users with proper permissions
3. **WordPress Installation** - Downloads, extracts, and configures WordPress
4. **Security Configuration** - Sets file permissions, generates security keys
5. **WP-CLI Installation** - Completes WordPress setup with admin users
6. **Application Passwords** - Generates API access credentials
7. **Export Generation** - Creates comprehensive deployment report

## 🔐 Security Features

- **Unique Security Keys** - WordPress authentication salts for each site
- **Proper File Permissions** - 755 for directories, 644 for files
- **Isolated Database Users** - Each site gets its own MySQL user
- **Application Passwords** - Secure API access without exposing main passwords
- **Password Hashing** - WordPress-compatible password encryption

## 📊 Export & Reporting

After deployment, get a comprehensive CSV report containing:
- Site URLs and admin login links
- Database connection details  
- WordPress admin credentials
- Application passwords for API access
- REST API endpoints
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
}
```

## 🛠️ Management Commands

### Database Operations
```bash
# Check database status
wp-hosting-automation check-databases -c sites.csv

# Clean up databases (careful!)
wp-hosting-automation cleanup-databases -c sites.csv
```

### WordPress Operations  
```bash
# Check WordPress installations
wp-hosting-automation check-wordpress -c sites.csv

# Generate deployment report
wp-hosting-automation report -c sites.csv
```

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup
```bash
git clone https://github.com/auroradream04/wp-hosting-automation.git
cd wp-hosting-automation
npm install
npm run dev
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙋‍♂️ Support

- **Documentation**: [GitHub Wiki](https://github.com/auroradream04/wp-hosting-automation/wiki)
- **Issues**: [GitHub Issues](https://github.com/auroradream04/wp-hosting-automation/issues)  
- **Discussions**: [GitHub Discussions](https://github.com/auroradream04/wp-hosting-automation/discussions)

## 🌟 Related Projects

- [WP-CLI](https://wp-cli.org/) - WordPress command line interface
- [WordPress](https://wordpress.org/) - The WordPress content management system
- [MySQL](https://mysql.com/) - Database management system

---

**Keywords**: wordpress automation, bulk wordpress deployment, hosting provider tools, wordpress batch install, mysql automation, wordpress cli, hosting management, wordpress developer tools, site deployment automation, wordpress hosting solution 