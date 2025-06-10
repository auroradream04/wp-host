# WordPress Hosting Automation Tool

A terminal-based batch deployment tool for creating multiple WordPress instances with MySQL databases. This tool automates the process of setting up WordPress sites, creating databases, and configuring everything needed for hosting multiple WordPress instances.

## 🚀 Features

- **Batch WordPress Installation**: Deploy multiple WordPress sites at once
- **Database Creation**: Automatically creates MySQL databases and users
- **Configuration Management**: Supports both CSV and JSON configuration files
- **Domain Inference**: Automatically detects domain names from directory paths
- **Comprehensive Setup**: Creates proper wp-config.php with correct database settings and URLs
- **Validation**: Validates configurations before deployment
- **Progress Tracking**: Detailed logging and progress reporting

## 📋 Prerequisites

Before using this tool, ensure your server has:

### Required Software
- **Node.js** (v18+)
- **MySQL Server** (v5.7+ or v8.0+)
- **Web Server** (Apache or Nginx)
- **PHP** (v7.4+ or v8.0+)

### Required PHP Extensions
```bash
# Ubuntu/Debian
sudo apt install php-mysql php-curl php-gd php-zip php-xml php-mbstring

# CentOS/RHEL
sudo yum install php-mysql php-curl php-gd php-zip php-xml php-mbstring
```

## 🛠️ Installation

1. **Clone the repository:**
```bash
git clone https://github.com/auroradream04/wp-hosting-automation.git
cd wp-hosting-automation
```

2. **Install dependencies:**
```bash
npm install
```

3. **Build the project:**
```bash
npm run build
```

## 📁 Configuration

### Configuration File Format

The tool supports both CSV and JSON formats. CSV is recommended for ease of editing.

#### CSV Format (Recommended)
Download the `template.csv` file and fill in your sites:

```csv
site_name,directory_path
example.com,/var/www/html/example.com
myblog,/var/www/html/myblog
portfolio.net,/var/www/html/portfolio.net
```

#### JSON Format
```json
{
  "mysql": {
    "host": "localhost",
    "port": 3306,
    "rootUser": "root",
    "rootPassword": "your_mysql_root_password",
    "sharedDbPassword": "shared_password_for_all_sites"
  },
  "wordpress": {
    "adminPassword": "shared_admin_password",
    "adminEmail": "admin@example.com"
  },
  "sites": [
    {
      "site_name": "example.com",
      "directory_path": "/var/www/html/example.com"
    },
    {
      "site_name": "myblog",
      "directory_path": "/var/www/html/myblog"
    }
  ]
}
```

### Auto-Generated Values

The tool automatically generates:
- **Database names**: `{site_name}_db` (e.g., `example_com_db`)
- **Database users**: `{site_name}_user` (e.g., `example_com_user`)
- **Site URLs**: Inferred from directory path (e.g., `/var/www/html/example.com` → `https://example.com`)

## 🚀 Usage

### Deploy WordPress Sites
```bash
# Using CSV configuration (recommended)
npm start deploy -c sites.csv

# Using JSON configuration
npm start deploy -c sites.json

# With verbose logging
npm start deploy -c sites.csv -v

# Auto-clean existing directories (careful!)
npm start deploy -c sites.csv --auto-clean
```

### Validate Configuration
```bash
# Test configuration without deploying
npm start validate -c sites.csv
```

### Command Options
- `-c, --config <file>`: Path to configuration file (CSV or JSON)
- `-v, --verbose`: Enable verbose logging
- `--auto-clean`: Automatically clean existing directories (use with caution)

## ⚙️ Server Configuration

After running the deployment tool, you need to configure your web server to properly serve the WordPress sites.

### Apache Configuration

#### 1. Enable Required Modules
```bash
sudo a2enmod rewrite
sudo a2enmod php8.1  # or your PHP version
sudo systemctl restart apache2
```

#### 2. Virtual Host Configuration
Create a virtual host file for each site:

```bash
sudo nano /etc/apache2/sites-available/example.com.conf
```

```apache
<VirtualHost *:80>
    ServerName example.com
    ServerAlias www.example.com
    DocumentRoot /var/www/html/example.com
    
    <Directory /var/www/html/example.com>
        AllowOverride All
        Require all granted
    </Directory>
    
    ErrorLog ${APACHE_LOG_DIR}/example.com_error.log
    CustomLog ${APACHE_LOG_DIR}/example.com_access.log combined
</VirtualHost>

<VirtualHost *:443>
    ServerName example.com
    ServerAlias www.example.com
    DocumentRoot /var/www/html/example.com
    
    SSLEngine on
    SSLCertificateFile /path/to/your/certificate.crt
    SSLCertificateKeyFile /path/to/your/private.key
    
    <Directory /var/www/html/example.com>
        AllowOverride All
        Require all granted
    </Directory>
    
    ErrorLog ${APACHE_LOG_DIR}/example.com_ssl_error.log
    CustomLog ${APACHE_LOG_DIR}/example.com_ssl_access.log combined
</VirtualHost>
```

#### 3. Enable Sites
```bash
sudo a2ensite example.com.conf
sudo systemctl reload apache2
```

### Nginx Configuration

#### 1. Server Block Configuration
Create a server block for each site:

```bash
sudo nano /etc/nginx/sites-available/example.com
```

```nginx
server {
    listen 80;
    listen 443 ssl;
    server_name example.com www.example.com;
    
    root /var/www/html/example.com;
    index index.php index.html index.htm;
    
    # SSL configuration (if using SSL)
    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;
    
    # PHP handling
    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/php8.1-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }
    
    # WordPress pretty permalinks
    location / {
        try_files $uri $uri/ /index.php?$args;
    }
    
    # Security
    location ~ /\. {
        deny all;
    }
    
    location ~* \.(log|binary|pem|enc|crt|conf|cnf|sql|sh|key)$ {
        deny all;
    }
    
    # WordPress specific security
    location = /wp-config.php {
        deny all;
    }
    
    location = /wp-admin/install.php {
        fastcgi_pass unix:/var/run/php/php8.1-fpm.sock;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    }
}
```

#### 2. Enable Sites
```bash
sudo ln -s /etc/nginx/sites-available/example.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### PHP Configuration

#### 1. Check PHP-FPM Status
```bash
sudo systemctl status php8.1-fpm
```

#### 2. Important PHP Settings
Edit your PHP configuration:

```bash
sudo nano /etc/php/8.1/fpm/php.ini
```

Key settings for WordPress:
```ini
max_execution_time = 300
memory_limit = 256M
post_max_size = 64M
upload_max_filesize = 64M
max_file_uploads = 20
```

#### 3. Restart PHP-FPM
```bash
sudo systemctl restart php8.1-fpm
```

## 🔍 Troubleshooting

### Common Issues

#### 1. PHP Files Download Instead of Execute
**Cause**: Web server not configured to process PHP files

**Solution**:
- **Apache**: Ensure `php` module is enabled (`sudo a2enmod php8.1`)
- **Nginx**: Check PHP-FPM configuration and socket path
- Verify PHP-FPM is running: `sudo systemctl status php8.1-fpm`

#### 2. WordPress Shows "Error establishing database connection"
**Cause**: Database connection issues

**Solution**:
- Verify MySQL is running: `sudo systemctl status mysql`
- Check database credentials in `wp-config.php`
- Test database connection manually:
```bash
mysql -u root -p
SHOW DATABASES;
```

#### 3. Permission Denied Error (wp-config.php)
**Cause**: WordPress files don't have proper permissions for web server access

**Error**: `Failed to open stream: Permission denied in wp-load.php`

**Solution**:
```bash
# Fix WordPress permissions automatically using the tool
npm start deploy fix-permissions -c sites.csv

# OR manually fix permissions:
# Set directory permissions
sudo find /var/www/html/your-site/ -type d -exec chmod 755 {} \;

# Set file permissions  
sudo find /var/www/html/your-site/ -type f -exec chmod 644 {} \;

# Ensure wp-config.php is readable by web server
sudo chmod 644 /var/www/html/your-site/wp-config.php

# Set correct ownership (Ubuntu/Debian)
sudo chown -R www-data:www-data /var/www/html/your-site/

# Set correct ownership (CentOS/RHEL)
sudo chown -R apache:apache /var/www/html/your-site/
```

#### 4. 403 Forbidden Error
**Cause**: Directory access restrictions or missing index files

**Solution**:
- Check that your web server virtual host is properly configured
- Ensure DirectoryIndex includes index.php
- Verify the document root path is correct

#### 5. WordPress Shows Localhost URLs
**Cause**: Incorrect URL configuration

**Solution**:
- The tool should create correct URLs automatically
- Manually update in WordPress admin: Settings → General
- Or update wp-config.php:
```php
define('WP_HOME', 'https://yourdomain.com');
define('WP_SITEURL', 'https://yourdomain.com');
```

### Logs to Check

- **Apache**: `/var/log/apache2/error.log`
- **Nginx**: `/var/log/nginx/error.log`
- **PHP**: `/var/log/php8.1-fpm.log`
- **MySQL**: `/var/log/mysql/error.log`

## 📝 Example Workflow

1. **Prepare configuration file:**
```bash
cp template.csv sites.csv
# Edit sites.csv with your sites
```

2. **Validate configuration:**
```bash
npm start validate -c sites.csv
```

3. **Deploy WordPress sites:**
```bash
npm start deploy -c sites.csv -v
```

4. **Configure web server** (see server configuration section above)

5. **Set up SSL certificates** (recommended):
```bash
sudo certbot --apache -d example.com -d www.example.com
# or for nginx:
sudo certbot --nginx -d example.com -d www.example.com
```

6. **Complete WordPress setup:**
   - Visit each site to complete the installation wizard
   - Or use the auto-configuration (if network allows)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -am 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review server logs
3. Open an issue on GitHub with detailed error information

---

**Note**: This tool creates the WordPress files and database structure. Proper server configuration (Apache/Nginx + PHP) is required for the sites to function correctly. Always test in a development environment first! 