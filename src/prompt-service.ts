import inquirer from 'inquirer';

export interface DeploymentOptions {
  generateAppPasswords: boolean;
  generateExport: boolean;
  exportPath?: string;
  cleanAllDirectories?: boolean;
}

export class PromptService {
  
  /**
   * Prompt user for deployment options
   */
  async promptDeploymentOptions(): Promise<DeploymentOptions> {
    console.log('\n🚀 WordPress Hosting Automation');
    console.log('==============================');
    console.log('This tool will create databases, install WordPress, and configure your sites.');
    console.log('You can also optionally generate application passwords and export results.\n');

    const answers = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'cleanAllDirectories',
        message: '🧹 Automatically clean non-empty directories during installation?',
        default: false
      },
      {
        type: 'confirm',
        name: 'generateAppPasswords',
        message: '🔑 Generate application passwords for API access?',
        default: false
      },
      {
        type: 'confirm', 
        name: 'generateExport',
        message: '📊 Export deployment results to spreadsheet?',
        default: false
      },
      {
        type: 'input',
        name: 'exportPath',
        message: '📁 Export file path (optional):',
        when: (answers: any) => answers.generateExport,
        validate: (input: any) => {
          if (!input.trim()) return true; // Optional field
          if (!input.endsWith('.csv')) {
            return 'Export file must have .csv extension';
          }
          return true;
        }
      }
    ]);

    return {
      cleanAllDirectories: answers.cleanAllDirectories,
      generateAppPasswords: answers.generateAppPasswords,
      generateExport: answers.generateExport,
      exportPath: answers.exportPath?.trim() || undefined
    };
  }

  /**
   * Prompt for confirmation before destructive operations
   */
  async promptConfirmation(
    operation: string, 
    details: string[] = [],
    defaultValue: boolean = false
  ): Promise<boolean> {
    console.log(`\n⚠️  ${operation}`);
    if (details.length > 0) {
      console.log('This will:');
      details.forEach(detail => console.log(`   • ${detail}`));
    }

    const { confirmed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: 'Are you sure you want to continue?',
        default: defaultValue
      }
    ]);

    return confirmed;
  }

  /**
   * Prompt user to continue after showing results
   */
  async promptContinue(message: string = 'Press Enter to continue...'): Promise<void> {
    await inquirer.prompt([
      {
        type: 'input',
        name: 'continue',
        message
      }
    ]);
  }

  /**
   * Show deployment preview and get confirmation
   */
  async promptDeploymentPreview(
    sitesCount: number,
    options: DeploymentOptions
  ): Promise<boolean> {
    console.log('\n📋 Deployment Preview');
    console.log('=====================');
    console.log(`📊 Sites to deploy: ${sitesCount}`);
    console.log('🔧 Actions:');
    console.log('   • Create MySQL databases and users');
    console.log('   • Download and install WordPress');
    console.log('   • Generate wp-config.php with security keys');
    console.log('   • Set proper file permissions');
    console.log('   • Complete WordPress setup wizard automatically');
    
    if (options.generateAppPasswords) {
      console.log('   • Generate application passwords for API access');
    }
    
    if (options.generateExport) {
      console.log('   • Export all deployment information to spreadsheet');
    }

    const { confirmed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: 'Ready to start deployment?',
        default: true
      }
    ]);

    return confirmed;
  }

  /**
   * Choose from multiple options
   */
  async promptChoice<T>(
    message: string,
    choices: { name: string; value: T; description?: string }[]
  ): Promise<T> {
    const { choice } = await inquirer.prompt([
      {
        type: 'list',
        name: 'choice',
        message,
        choices: choices.map(c => ({
          name: c.description ? `${c.name} - ${c.description}` : c.name,
          value: c.value
        }))
      }
    ]);

    return choice;
  }

  /**
   * Get text input from user
   */
  async promptInput(
    message: string,
    defaultValue?: string,
    validator?: (input: string) => boolean | string
  ): Promise<string> {
    const { input } = await inquirer.prompt([
      {
        type: 'input',
        name: 'input',
        message,
        default: defaultValue,
        validate: validator
      }
    ]);

    return input.trim();
  }

  /**
   * Display completion summary with next steps
   */
  displayCompletionSummary(
    successful: number,
    total: number,
    hasAppPasswords: boolean,
    hasExport: boolean,
    exportPath?: string
  ): void {
    console.log('\n🎉 Deployment Complete!');
    console.log('========================');
    console.log(`✅ Successfully deployed: ${successful}/${total} sites`);

    if (successful > 0) {
      console.log('\n🌐 Your WordPress sites are ready!');
      console.log('📝 Next steps:');
      console.log('   1. Visit your site URLs to confirm everything works');
      console.log('   2. Log in to WordPress admin panels');
      console.log('   3. Install themes and plugins as needed');
      
      if (hasAppPasswords) {
        console.log('   4. Use application passwords for API/mobile access');
      }

      if (hasExport && exportPath) {
        console.log(`\n📊 All credentials saved to: ${exportPath}`);
        console.log('   • Share with your team or clients');
        console.log('   • Use for documentation and backups');
        console.log('   • Reference for API development');
      }
    }

    if (successful < total) {
      const failed = total - successful;
      console.log(`\n⚠️  ${failed} site(s) had issues - check the logs above for details`);
    }

    console.log('\n🛠️  Need help? Check the README.md for troubleshooting tips');
  }
} 