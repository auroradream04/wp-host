#!/usr/bin/env node

/**
 * Debug script to test database creation fix
 * Tests the clean slate reset logic with non-existent databases
 */

const mysql = require('mysql2/promise');

async function testDatabaseCreation() {
  const config = {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'your_root_password' // Update this
  };

  let connection;
  
  try {
    console.log('🔌 Connecting to MySQL...');
    connection = await mysql.createConnection(config);
    
    const testDbName = 'test_wp_host_db';
    const testUser = 'test_wp_host_user';
    
    console.log('\n📊 Testing database creation with clean slate approach...');
    
    // This should work even if database doesn't exist
    console.log('1️⃣ Dropping database (if exists)...');
    await connection.execute(`DROP DATABASE IF EXISTS \`${testDbName}\``);
    console.log('   ✅ DROP DATABASE IF EXISTS completed');
    
    console.log('2️⃣ Dropping user (if exists)...');
    await connection.execute(`DROP USER IF EXISTS \`${testUser}\`@\`localhost\``);
    console.log('   ✅ DROP USER IF EXISTS completed');
    
    console.log('3️⃣ Creating fresh database...');
    await connection.execute(`CREATE DATABASE \`${testDbName}\``);
    console.log('   ✅ Database created');
    
    console.log('4️⃣ Creating fresh user...');
    await connection.execute(`CREATE USER \`${testUser}\`@\`localhost\` IDENTIFIED BY 'test_password'`);
    console.log('   ✅ User created');
    
    console.log('5️⃣ Granting privileges...');
    await connection.execute(`GRANT ALL PRIVILEGES ON \`${testDbName}\`.* TO \`${testUser}\`@\`localhost\``);
    await connection.execute('FLUSH PRIVILEGES');
    console.log('   ✅ Privileges granted');
    
    console.log('\n🧹 Cleaning up test resources...');
    await connection.execute(`DROP DATABASE IF EXISTS \`${testDbName}\``);
    await connection.execute(`DROP USER IF EXISTS \`${testUser}\`@\`localhost\``);
    await connection.execute('FLUSH PRIVILEGES');
    console.log('   ✅ Cleanup completed');
    
    console.log('\n✅ All tests passed! The fix works correctly.');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nThis might mean:');
    console.error('1. MySQL is not running');
    console.error('2. Root credentials are incorrect');
    console.error('3. There\'s still an issue with the SQL commands');
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Disconnected from MySQL');
    }
  }
}

// Run the test
console.log('🧪 Database Creation Fix Test\n');
console.log('This script tests the fix for the "database doesn\'t exist" error.\n');
console.log('⚠️  Note: Update the MySQL root password in the script before running!\n');

testDatabaseCreation();