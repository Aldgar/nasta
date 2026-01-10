/**
 * Test MongoDB Atlas connection
 * Run with: npx ts-node scripts/test-db-connection.ts
 */

import { PrismaClient } from '@prisma/client';

async function testConnection() {
  const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
  });

  try {
    console.log('🔌 Attempting to connect to MongoDB...');
    console.log('Connection string format:', process.env.DATABASE_URL?.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));
    
    await prisma.$connect();
    console.log('✅ Successfully connected to MongoDB!');
    
    // Test a simple query
    const userCount = await prisma.user.count();
    console.log(`📊 Found ${userCount} users in database`);
    
  } catch (error: any) {
    console.error('❌ Connection failed:', error.message);
    
    if (error.message.includes('fatal alert')) {
      console.error('\n💡 This is a TLS/SSL handshake error. Common fixes:');
      console.error('1. Check MongoDB Atlas Network Access - ensure your IP is whitelisted');
      console.error('2. Verify connection string format includes SSL/TLS parameters');
      console.error('3. Try using mongodb+srv:// format instead of mongodb://');
      console.error('4. Check if MongoDB Atlas cluster is paused or has connectivity issues');
    }
    
    if (error.code === 'P2010') {
      console.error('\n💡 Prisma connection error. Check:');
      console.error('- DATABASE_URL environment variable is set correctly');
      console.error('- Connection string format is valid');
      console.error('- Network/firewall is not blocking the connection');
    }
    
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

testConnection();

