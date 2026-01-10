import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Get configuration from environment
  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12');
  const nodeEnv = process.env.NODE_ENV || 'development';

  // Only seed default users in development
  if (nodeEnv === 'production') {
    console.log('⚠️  Skipping seed in production environment');
    console.log('ℹ️  To seed in production, set NODE_ENV=development');
    return;
  }

  try {
    // Hash passwords using environment variables
    const adminPassword = await bcrypt.hash(
      process.env.DEFAULT_ADMIN_PASSWORD ||
        process.env.FALLBACK_ADMIN_PASSWORD ||
        '',
      saltRounds,
    );
    const userPassword = await bcrypt.hash(
      process.env.DEFAULT_USER_PASSWORD ||
        process.env.FALLBACK_USER_PASSWORD ||
        '',
      saltRounds,
    );
    const employerPassword = await bcrypt.hash(
      process.env.DEFAULT_EMPLOYER_PASSWORD ||
        process.env.FALLBACK_EMPLOYER_PASSWORD ||
        '',
      saltRounds,
    );

    // Create admin user - ALL values from environment
    const admin = await prisma.user.upsert({
      where: {
        email: process.env.DEFAULT_ADMIN_EMAIL || process.env.ADMIN_EMAIL || '',
      },
      update: {
        password: adminPassword,
        firstName:
          process.env.DEFAULT_ADMIN_FIRST_NAME ||
          process.env.ADMIN_FIRST_NAME ||
          '',
        lastName:
          process.env.DEFAULT_ADMIN_LAST_NAME ||
          process.env.ADMIN_LAST_NAME ||
          '',
        role: 'ADMIN',
        isActive: process.env.ADMIN_IS_ACTIVE === 'true',
        // Admin verification status from environment
        isVerified: process.env.ADMIN_IS_VERIFIED === 'true',
        isIdVerified: process.env.ADMIN_IS_ID_VERIFIED === 'true',
        idVerificationStatus:
          (process.env.ADMIN_ID_VERIFICATION_STATUS as any) || 'PENDING',
        isBusinessVerified: process.env.ADMIN_IS_BUSINESS_VERIFIED === 'true',
        businessVerificationStatus:
          (process.env.ADMIN_BUSINESS_VERIFICATION_STATUS as any) || 'PENDING',
        isBackgroundVerified:
          process.env.ADMIN_IS_BACKGROUND_VERIFIED === 'true',
        backgroundCheckStatus:
          (process.env.ADMIN_BACKGROUND_CHECK_STATUS as any) || 'PENDING',
        backgroundCheckResult:
          (process.env.ADMIN_BACKGROUND_CHECK_RESULT as any) || undefined,
        canWorkWithChildren:
          process.env.ADMIN_CAN_WORK_WITH_CHILDREN === 'true',
        canWorkWithElderly: process.env.ADMIN_CAN_WORK_WITH_ELDERLY === 'true',
        canWorkGeneralJobs: process.env.ADMIN_CAN_WORK_GENERAL_JOBS === 'true',
      },
      create: {
        email: process.env.DEFAULT_ADMIN_EMAIL || process.env.ADMIN_EMAIL || '',
        password: adminPassword,
        firstName:
          process.env.DEFAULT_ADMIN_FIRST_NAME ||
          process.env.ADMIN_FIRST_NAME ||
          '',
        lastName:
          process.env.DEFAULT_ADMIN_LAST_NAME ||
          process.env.ADMIN_LAST_NAME ||
          '',
        role: 'ADMIN',
        isActive: process.env.ADMIN_IS_ACTIVE === 'true',
        isVerified: process.env.ADMIN_IS_VERIFIED === 'true',
        isIdVerified: process.env.ADMIN_IS_ID_VERIFIED === 'true',
        idVerificationStatus:
          (process.env.ADMIN_ID_VERIFICATION_STATUS as any) || 'PENDING',
        isBusinessVerified: process.env.ADMIN_IS_BUSINESS_VERIFIED === 'true',
        businessVerificationStatus:
          (process.env.ADMIN_BUSINESS_VERIFICATION_STATUS as any) || 'PENDING',
        isBackgroundVerified:
          process.env.ADMIN_IS_BACKGROUND_VERIFIED === 'true',
        backgroundCheckStatus:
          (process.env.ADMIN_BACKGROUND_CHECK_STATUS as any) || 'PENDING',
        backgroundCheckResult:
          (process.env.ADMIN_BACKGROUND_CHECK_RESULT as any) || undefined,
        canWorkWithChildren:
          process.env.ADMIN_CAN_WORK_WITH_CHILDREN === 'true',
        canWorkWithElderly: process.env.ADMIN_CAN_WORK_WITH_ELDERLY === 'true',
        canWorkGeneralJobs: process.env.ADMIN_CAN_WORK_GENERAL_JOBS === 'true',
      },
    });

    // Create job seeker user - ALL values from environment
    const user = await prisma.user.upsert({
      where: {
        email: process.env.DEFAULT_USER_EMAIL || process.env.USER_EMAIL || '',
      },
      update: {
        password: userPassword,
        firstName:
          process.env.DEFAULT_USER_FIRST_NAME ||
          process.env.USER_FIRST_NAME ||
          '',
        lastName:
          process.env.DEFAULT_USER_LAST_NAME ||
          process.env.USER_LAST_NAME ||
          '',
        role: 'JOB_SEEKER',
        isActive: process.env.USER_IS_ACTIVE !== 'false', // Default to true unless explicitly false
      },
      create: {
        email: process.env.DEFAULT_USER_EMAIL || process.env.USER_EMAIL || '',
        password: userPassword,
        firstName:
          process.env.DEFAULT_USER_FIRST_NAME ||
          process.env.USER_FIRST_NAME ||
          '',
        lastName:
          process.env.DEFAULT_USER_LAST_NAME ||
          process.env.USER_LAST_NAME ||
          '',
        role: 'JOB_SEEKER',
        isActive: process.env.USER_IS_ACTIVE !== 'false',
      },
    });

    // Create employer user - ALL values from environment
    const employer = await prisma.user.upsert({
      where: {
        email:
          process.env.DEFAULT_EMPLOYER_EMAIL ||
          process.env.EMPLOYER_EMAIL ||
          '',
      },
      update: {
        password: employerPassword,
        firstName:
          process.env.DEFAULT_EMPLOYER_FIRST_NAME ||
          process.env.EMPLOYER_FIRST_NAME ||
          '',
        lastName:
          process.env.DEFAULT_EMPLOYER_LAST_NAME ||
          process.env.EMPLOYER_LAST_NAME ||
          '',
        role: 'EMPLOYER',
        isActive: process.env.EMPLOYER_IS_ACTIVE !== 'false',
      },
      create: {
        email:
          process.env.DEFAULT_EMPLOYER_EMAIL ||
          process.env.EMPLOYER_EMAIL ||
          '',
        password: employerPassword,
        firstName:
          process.env.DEFAULT_EMPLOYER_FIRST_NAME ||
          process.env.EMPLOYER_FIRST_NAME ||
          '',
        lastName:
          process.env.DEFAULT_EMPLOYER_LAST_NAME ||
          process.env.EMPLOYER_LAST_NAME ||
          '',
        role: 'EMPLOYER',
        isActive: process.env.EMPLOYER_IS_ACTIVE !== 'false',
      },
    });

    console.log('✅ Admin user created/updated:', {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      name: `${admin.firstName} ${admin.lastName}`,
      isActive: admin.isActive,
      isVerified: admin.isVerified,
      isIdVerified: admin.isIdVerified,
      isBackgroundVerified: admin.isBackgroundVerified,
    });

    console.log('✅ Job seeker created/updated:', {
      id: user.id,
      email: user.email,
      role: user.role,
      name: `${user.firstName} ${user.lastName}`,
      isActive: user.isActive,
    });

    console.log('✅ Employer created/updated:', {
      id: employer.id,
      email: employer.email,
      role: employer.role,
      name: `${employer.firstName} ${employer.lastName}`,
      isActive: employer.isActive,
    });

    console.log('\n🎉 Database seeding completed successfully!');
    console.log(`📊 Environment: ${nodeEnv}`);
    console.log(`🔐 Salt rounds used: ${saltRounds}`);
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('❌ Seed script failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
