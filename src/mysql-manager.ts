import mysql from "mysql2/promise";
import { MySQLConfig } from "./types";

export class MySQLManager {
  private config: MySQLConfig;
  private connection: mysql.Connection | null = null;

  constructor(config: MySQLConfig) {
    this.config = config;
  }

  /**
   * Establish connection to MySQL server as root user
   */
  async connect(): Promise<void> {
    try {
      console.log(
        `🔌 Connecting to MySQL at ${this.config.host}:${this.config.port}...`,
      );

      this.connection = await mysql.createConnection({
        host: this.config.host,
        port: this.config.port,
        user: this.config.rootUser,
        password: this.config.rootPassword,
        // Don't specify a database - we're connecting as root to create databases
      });

      // Test the connection
      await this.connection.ping();
      console.log(
        `✅ Successfully connected to MySQL as ${this.config.rootUser}`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed to connect to MySQL: ${errorMessage}`);

      // Provide helpful error messages for common issues
      if (errorMessage.includes("ECONNREFUSED")) {
        throw new Error(
          `Cannot connect to MySQL server at ${this.config.host}:${this.config.port}. Is MySQL running?`,
        );
      } else if (errorMessage.includes("Access denied")) {
        throw new Error(
          `Access denied for user '${this.config.rootUser}'. Check your MySQL root password.`,
        );
      } else if (errorMessage.includes("ENOTFOUND")) {
        throw new Error(
          `MySQL host '${this.config.host}' not found. Check your host configuration.`,
        );
      } else {
        throw new Error(`MySQL connection failed: ${errorMessage}`);
      }
    }
  }

  /**
   * Test MySQL connection without storing it
   */
  async testConnection(): Promise<boolean> {
    let testConnection: mysql.Connection | null = null;

    try {
      console.log(`🧪 Testing MySQL connection...`);

      testConnection = await mysql.createConnection({
        host: this.config.host,
        port: this.config.port,
        user: this.config.rootUser,
        password: this.config.rootPassword,
      });

      await testConnection.ping();
      console.log(`✅ MySQL connection test successful`);
      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`❌ MySQL connection test failed: ${errorMessage}`);
      return false;
    } finally {
      if (testConnection) {
        await testConnection.end();
      }
    }
  }

  /**
   * Check if a database exists
   */
  async databaseExists(databaseName: string): Promise<boolean> {
    if (!this.connection) {
      throw new Error("Not connected to MySQL. Call connect() first.");
    }

    try {
      const [rows] = await this.connection.execute(
        "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?",
        [databaseName],
      );

      return Array.isArray(rows) && rows.length > 0;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to check if database exists: ${errorMessage}`);
    }
  }

  /**
   * Check if a user exists
   */
  async userExists(
    username: string,
    host: string = "localhost",
  ): Promise<boolean> {
    if (!this.connection) {
      throw new Error("Not connected to MySQL. Call connect() first.");
    }

    try {
      const [rows] = await this.connection.execute(
        "SELECT User FROM mysql.user WHERE User = ? AND Host = ?",
        [username, host],
      );

      return Array.isArray(rows) && rows.length > 0;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to check if user exists: ${errorMessage}`);
    }
  }

  /**
   * Create a new database
   */
  async createDatabase(databaseName: string): Promise<void> {
    if (!this.connection) {
      throw new Error("Not connected to MySQL. Call connect() first.");
    }

    try {
      console.log(`📊 Creating database: ${databaseName}`);

      // Check if database already exists
      if (await this.databaseExists(databaseName)) {
        console.log(
          `⚠️  Database ${databaseName} already exists, skipping creation`,
        );
        return;
      }

      await this.connection.execute(`CREATE DATABASE \`${databaseName}\``);
      console.log(`✅ Database ${databaseName} created successfully`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to create database ${databaseName}: ${errorMessage}`,
      );
    }
  }

  /**
   * Create a new MySQL user
   */
  async createUser(
    username: string,
    password: string,
    host: string = "localhost",
  ): Promise<void> {
    if (!this.connection) {
      throw new Error("Not connected to MySQL. Call connect() first.");
    }

    try {
      console.log(`👤 Creating user: ${username}@${host}`);

      // Check if user already exists
      if (await this.userExists(username, host)) {
        console.log(
          `⚠️  User ${username}@${host} already exists, skipping creation`,
        );
        return;
      }

      // For MySQL 5.7 compatibility, use string concatenation instead of parameterized password
      const createUserSQL = `CREATE USER \`${username}\`@\`${host}\` IDENTIFIED BY '${password.replace(/'/g, "''")}'`;
      console.log(
        `🔍 Executing SQL: ${createUserSQL.replace(password, "[PASSWORD_HIDDEN]")}`,
      );

      await this.connection.execute(createUserSQL);
      console.log(`✅ User ${username}@${host} created successfully`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to create user ${username}@${host}: ${errorMessage}`,
      );
    }
  }

  /**
   * Grant privileges to a user for a specific database
   */
  async grantPrivileges(
    username: string,
    databaseName: string,
    host: string = "localhost",
  ): Promise<void> {
    if (!this.connection) {
      throw new Error("Not connected to MySQL. Call connect() first.");
    }

    try {
      console.log(
        `🔑 Granting privileges on ${databaseName} to ${username}@${host}`,
      );

      await this.connection.execute(
        `GRANT ALL PRIVILEGES ON \`${databaseName}\`.* TO \`${username}\`@\`${host}\``,
      );

      // Flush privileges to ensure they take effect immediately
      await this.connection.execute("FLUSH PRIVILEGES");

      console.log(`✅ Privileges granted successfully`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to grant privileges: ${errorMessage}`);
    }
  }

  /**
   * Test connection with specific database credentials
   */
  async testDatabaseConnection(
    username: string,
    password: string,
    databaseName: string,
    host: string = "localhost",
  ): Promise<boolean> {
    let testConnection: mysql.Connection | null = null;

    try {
      testConnection = await mysql.createConnection({
        host: this.config.host,
        port: this.config.port,
        user: username,
        password: password,
        database: databaseName,
      });

      await testConnection.ping();
      return true;
    } catch (error) {
      return false;
    } finally {
      if (testConnection) {
        await testConnection.end();
      }
    }
  }

  /**
   * Get MySQL server version and info
   */
  async getServerInfo(): Promise<{
    version: string;
    host: string;
    port: number;
  }> {
    if (!this.connection) {
      throw new Error("Not connected to MySQL. Call connect() first.");
    }

    try {
      const [rows] = await this.connection.execute(
        "SELECT VERSION() as version",
      );
      const version =
        Array.isArray(rows) && rows.length > 0
          ? (rows[0] as any).version
          : "Unknown";

      return {
        version,
        host: this.config.host,
        port: this.config.port,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get server info: ${errorMessage}`);
    }
  }

  /**
   * Close the MySQL connection
   */
  async disconnect(): Promise<void> {
    if (this.connection) {
      try {
        await this.connection.end();
        this.connection = null;
        console.log(`🔌 Disconnected from MySQL`);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(`⚠️  Error disconnecting from MySQL: ${errorMessage}`);
      }
    }
  }

  /**
   * Execute a raw SQL query (for advanced operations)
   */
  async executeQuery(query: string, params?: any[]): Promise<any> {
    if (!this.connection) {
      throw new Error("Not connected to MySQL. Call connect() first.");
    }

    try {
      const [rows] = await this.connection.execute(query, params);
      return rows;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to execute query: ${errorMessage}`);
    }
  }

  /**
   * Drop database and user completely for a clean slate
   */
  async dropDatabaseAndUser(
    databaseName: string,
    username: string,
    host: string = "localhost",
  ): Promise<void> {
    if (!this.connection) {
      throw new Error("Not connected to MySQL. Call connect() first.");
    }

    try {
      // Drop database if it exists - using IF EXISTS to avoid errors
      await this.connection.execute(
        `DROP DATABASE IF EXISTS \`${databaseName}\``,
      );

      // Drop user if it exists - using IF EXISTS to avoid errors
      await this.connection.execute(
        `DROP USER IF EXISTS \`${username}\`@\`${host}\``,
      );

      // Flush privileges to ensure changes take effect
      await this.connection.execute("FLUSH PRIVILEGES");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to perform clean slate reset: ${errorMessage}`);
    }
  }

  /**
   * Create database and user with full permissions (clean slate approach)
   */
  async createDatabaseAndUserClean(
    databaseName: string,
    username: string,
    password: string,
    host: string = "localhost",
  ): Promise<void> {
    if (!this.connection) {
      throw new Error("Not connected to MySQL. Call connect() first.");
    }

    try {
      // First, ensure clean slate by dropping existing database and user
      await this.dropDatabaseAndUser(databaseName, username, host);

      // Create database
      await this.connection.execute(`CREATE DATABASE \`${databaseName}\``);

      // Create user
      const createUserSQL = `CREATE USER \`${username}\`@\`${host}\` IDENTIFIED BY '${password.replace(/'/g, "''")}'`;
      await this.connection.execute(createUserSQL);

      // Grant all privileges
      await this.connection.execute(
        `GRANT ALL PRIVILEGES ON \`${databaseName}\`.* TO \`${username}\`@\`${host}\``,
      );

      // Flush privileges
      await this.connection.execute("FLUSH PRIVILEGES");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to create database and user with clean slate: ${errorMessage}`,
      );
    }
  }
}
