import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  RegisterDto,
  LoginDto,
  AdminLoginDto,
  AdminSelfRegisterDto,
} from './dto/auth.dto';
import * as bcrypt from 'bcryptjs';
import { NotificationsService } from '../notifications/notifications.service';
import { randomBytes } from 'crypto';
import { AdminCreateDto } from './dto/admin-create.dto';
import { AdminCapability } from '@prisma/client';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

interface VerificationTokenRecord {
  userId: string;
  type: 'EMAIL' | 'PHONE' | 'PASSWORD_RESET' | 'EMAIL_CHANGE';
  token: string;
  consumed: boolean;
  expiresAt: Date | null;
  payload?: unknown;
}

// Lightweight type for Admin records used in auth flows
type AdminRecord = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  password?: string;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private notifications: NotificationsService,
  ) {}

  // Temporary typed delegate shim for VerificationToken until Prisma types are refreshed
  // Centralizes the 'any' cast to one place to satisfy linting elsewhere
  private get verificationTokens() {
    // Cast prisma to a minimally typed shape to avoid unsafe member access
    const prisma = this.prisma as unknown as {
      verificationToken: {
        create: (args: { data: any }) => Promise<VerificationTokenRecord>;
        findUnique: (args: {
          where: { token: string };
        }) => Promise<VerificationTokenRecord | null>;
        update: (args: {
          where: { token: string };
          data: { consumed: boolean };
        }) => Promise<VerificationTokenRecord>;
      };
    };
    return prisma.verificationToken as {
      create: (args: { data: any }) => Promise<VerificationTokenRecord>;
      findUnique: (args: {
        where: { token: string };
      }) => Promise<VerificationTokenRecord | null>;
      update: (args: {
        where: { token: string };
        data: { consumed: boolean };
      }) => Promise<VerificationTokenRecord>;
    };
  }

  // Temporary typed delegate shim for Admin until Prisma types refresh in IDE/CI
  private get admins() {
    const prisma = this.prisma as unknown as {
      admin: {
        findUnique: (args: unknown) => Promise<AdminRecord | null>;
        findFirst: (args: unknown) => Promise<Pick<AdminRecord, 'id'> | null>;
        create: (args: unknown) => Promise<AdminRecord>;
        update: (args: unknown) => Promise<AdminRecord>;
      };
    };
    return prisma.admin;
  }

  // Hash password (fixed salt rounds handling)
  private async hashPassword(password: string): Promise<string> {
    // Get the environment variable and ensure it's converted to a proper number
    const saltRoundsStr: string = this.configService.get<string>(
      'BCRYPT_SALT_ROUNDS',
      '12',
    );
    const saltRounds = Number(saltRoundsStr);

    // Validate it's a proper number, fallback to 12 if invalid
    const validSaltRounds =
      Number.isInteger(saltRounds) && saltRounds >= 4 && saltRounds <= 31
        ? saltRounds
        : 12;

    this.logger.log('🔐 Salt rounds config value:', saltRoundsStr);
    this.logger.log('🔐 Salt rounds parsed:', saltRounds);
    this.logger.log(
      '🔐 Salt rounds final (type/value):',
      typeof validSaltRounds,
      validSaltRounds,
    );

    return bcrypt.hash(password, validSaltRounds);
  }

  // Admin registration is not exposed publicly; handled via internal tooling/admin actions.

  // Verify password
  private async verifyPassword(
    password: string,
    hash: string,
  ): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  // Generate JWT tokens (environment-based)
  private generateTokens(userId: string, email: string, role: string) {
    const payload: { sub: string; email: string; role: string } = {
      sub: userId,
      email,
      role,
    };

    const accessTokenExpiry = this.getJwtExpiresIn('JWT_EXPIRES_IN', '24h');
    const refreshTokenExpiry = this.getJwtExpiresIn(
      'JWT_REFRESH_EXPIRES_IN',
      '7d',
    );

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: accessTokenExpiry,
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: refreshTokenExpiry,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: accessTokenExpiry,
    };
  }

  private getJwtExpiresIn(
    key: 'JWT_EXPIRES_IN' | 'JWT_REFRESH_EXPIRES_IN',
    fallback: StringValue,
  ): number | StringValue {
    const raw = this.configService.get<string>(key) ?? fallback;
    return /^\d+$/.test(raw) ? Number(raw) : (raw as StringValue);
  }

  // Public helper for OAuth flows: find existing user by email+role
  async findRegisteredByEmailAndRole(
    email: string,
    role: 'JOB_SEEKER' | 'EMPLOYER',
  ) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
      },
    });
    if (!user || !user.isActive || user.role !== role) return null;
    return user;
  }

  // Public helper for OAuth flows: issue only access token (no refresh)
  issueAccessToken(userId: string, email: string, role: string) {
    const payload: { sub: string; email: string; role: string } = {
      sub: userId,
      email,
      role,
    };
    const accessTokenExpiry = this.getJwtExpiresIn('JWT_EXPIRES_IN', '24h');
    return this.jwtService.sign(payload, { expiresIn: accessTokenExpiry });
  }

  // Register new user
  async register(dto: RegisterDto, languageHint?: string) {
    this.logger.log('🔍 Registration attempt for:', dto.email);

    try {
      // Check if user already exists
      const existingUser = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });

      if (existingUser) {
        this.logger.log('❌ User already exists:', dto.email);
        throw new ConflictException('User with this email already exists');
      }

      this.logger.log('🔐 Hashing password...');
      // Hash password
      const hashedPassword = await this.hashPassword(dto.password);

      this.logger.log('💾 Creating user in database...');
      // Create user
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          password: hashedPassword,
          firstName: dto.firstName,
          lastName: dto.lastName,
          role: dto.role || 'JOB_SEEKER',
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          createdAt: true,
        },
      });

      const parsedLanguage = this.parseLanguageHint(languageHint);
      if (parsedLanguage) {
        try {
          await this.prisma.user.update({
            where: { id: user.id },
            data: { language: parsedLanguage },
          });
        } catch {
          // Best-effort only: registration must not fail due to language persistence.
        }
      }

      this.logger.log('🎫 Generating tokens...');
      // Generate tokens
      const tokens = this.generateTokens(user.id, user.email, user.role);

      this.logger.log('✅ Registration successful for:', user.email);

      // Send welcome email with verification
      const verificationToken = this.generateToken(16);
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour
      await this.verificationTokens.create({
        data: {
          userId: user.id,
          type: 'EMAIL',
          token: verificationToken,
          expiresAt,
        },
      });
      await this.notifications.sendWelcomeEmail(user.id, verificationToken);

      return {
        user,
        ...tokens,
        message:
          'User registered successfully. Please check your email for a welcome message and verification link.',
      };
    } catch (error) {
      this.logger.error('❌ Registration error:', error);
      if (
        error instanceof ConflictException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      throw new BadRequestException('Failed to create user');
    }
  }

  // First-admin-only self-registration (no hardcoded bootstrap). If any ADMIN exists, forbid.
  async adminSelfRegister(dto: AdminSelfRegisterDto) {
    // Check if any admin already exists
    const existingAdmin = await this.admins.findFirst({ select: { id: true } });
    if (existingAdmin) {
      throw new UnauthorizedException('Admin already initialized');
    }

    // Ensure email not in use
    const existingUser = await this.admins.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await this.hashPassword(dto.password);
    const admin = await this.admins.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        isActive: true,
        // First admin should be able to administer the platform
        adminCapabilities: ['SUPER_ADMIN'],
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      },
    });

    const tokens = this.generateTokens(admin.id, admin.email, 'ADMIN');
    return { admin, ...tokens, message: 'Admin registered successfully' };
  }

  private parseLanguageHint(languageHint?: string): 'en' | 'pt' | null {
    if (!languageHint) return null;
    const normalized = languageHint.toLowerCase().trim();
    if (normalized.startsWith('pt')) return 'pt';
    if (normalized.startsWith('en')) return 'en';
    // Accept-Language often looks like: "pt-PT,pt;q=0.9,en-US;q=0.8"
    if (normalized.includes('pt')) return 'pt';
    if (normalized.includes('en')) return 'en';
    return null;
  }

  // Login user
  async login(dto: LoginDto, languageHint?: string) {
    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: {
        id: true,
        email: true,
        password: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      const pendingDeletion = await this.prisma.deletionRequest.findFirst({
        where: { userId: user.id, status: 'PENDING' },
        select: { id: true },
      });
      if (pendingDeletion) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { isActive: true },
        });
      } else {
        throw new UnauthorizedException('Account is deactivated');
      }
    }

    const isPasswordValid = await this.verifyPassword(
      dto.password,
      user.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const parsedLanguage = this.parseLanguageHint(languageHint);
    if (parsedLanguage) {
      try {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { language: parsedLanguage },
        });
      } catch {
        // Best-effort only: login must not fail due to language persistence.
      }
    }

    // Generate tokens
    const tokens = this.generateTokens(user.id, user.email, user.role);

    // Shape a safe user payload without password
    const userWithoutPassword = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive,
    };

    return {
      user: userWithoutPassword,
      ...tokens,
      message: 'Login successful',
    };
  }

  private async loginWithRole(
    dto: LoginDto,
    role: 'JOB_SEEKER' | 'EMPLOYER',
    languageHint?: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: {
        id: true,
        email: true,
        password: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
      },
    });
    if (!user || user.role !== role) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.isActive) {
      const pendingDeletion = await this.prisma.deletionRequest.findFirst({
        where: { userId: user.id, status: 'PENDING' },
        select: { id: true },
      });
      if (pendingDeletion) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { isActive: true },
        });
      } else {
        throw new UnauthorizedException('Account is deactivated');
      }
    }
    const ok = await this.verifyPassword(dto.password, user.password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    const parsedLanguage = this.parseLanguageHint(languageHint);
    if (parsedLanguage) {
      try {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { language: parsedLanguage },
        });
      } catch {
        // Best-effort only.
      }
    }

    const tokens = this.generateTokens(user.id, user.email, user.role);
    const userWithoutPassword = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive,
    };
    return {
      user: userWithoutPassword,
      ...tokens,
      message: 'Login successful',
    };
  }

  async userLogin(dto: LoginDto, languageHint?: string) {
    return this.loginWithRole(dto, 'JOB_SEEKER', languageHint);
  }

  async employerLogin(dto: LoginDto, languageHint?: string) {
    return this.loginWithRole(dto, 'EMPLOYER', languageHint);
  }

  // Admin login (environment-based debug logging)
  async adminLogin(dto: AdminLoginDto) {
    const enableDebugLogs =
      this.configService.get<string>('NODE_ENV') === 'development';

    if (enableDebugLogs) {
      this.logger.log('🔍 AdminLogin attempt for:', dto.email);
    }

    // Find admin user - fix for MongoDB
    const admin = await this.admins.findUnique({
      where: {
        email: dto.email, // Only use email (which is unique)
      },
      select: {
        id: true,
        email: true,
        password: true,
        firstName: true,
        lastName: true,
        isActive: true,
      },
    });

    if (enableDebugLogs) {
      this.logger.log(
        '👤 Found user:',
        admin
          ? {
              email: admin.email,
              role: 'ADMIN',
              isActive: admin.isActive,
              hasPassword: !!admin.password,
            }
          : 'null',
      );
    }

    // Check if user exists and is admin
    if (!admin) {
      if (enableDebugLogs) this.logger.log('❌ No user found');
      throw new UnauthorizedException('Invalid admin credentials');
    }

    // role field comes from token we issue; persistence is separate Admin model

    if (!admin.isActive) {
      if (enableDebugLogs) this.logger.log('❌ Admin account is not active');
      throw new UnauthorizedException('Admin account is deactivated');
    }

    // Verify password
    if (enableDebugLogs) this.logger.log('🔐 Verifying password...');
    const isPasswordValid = await this.verifyPassword(
      dto.password,
      admin.password,
    );

    if (enableDebugLogs) this.logger.log('🔐 Password valid:', isPasswordValid);

    if (!isPasswordValid) {
      if (enableDebugLogs) this.logger.log('❌ Invalid password');
      throw new UnauthorizedException('Invalid admin credentials');
    }

    if (enableDebugLogs) this.logger.log('✅ Admin login successful');

    // Generate tokens with admin privileges
    const tokens = this.generateTokens(admin.id, admin.email, 'ADMIN');

    // Shape a safe admin payload without password
    const adminWithoutPassword = {
      id: admin.id,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      isActive: admin.isActive,
    };

    return {
      admin: adminWithoutPassword,
      ...tokens,
      message: 'Admin login successful',
    };
  }

  // SUPER_ADMIN: create another admin
  async createAdmin(dto: AdminCreateDto) {
    // Ensure email not in use
    const existing = await this.admins.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('Admin with this email already exists');
    }

    const hashedPassword = await this.hashPassword(dto.password);
    const caps =
      Array.isArray(dto.adminCapabilities) && dto.adminCapabilities.length
        ? dto.adminCapabilities
        : ['SUPER_ADMIN'];

    const admin = await this.admins.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        isActive: true,
        adminCapabilities: caps as AdminCapability[],
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        adminCapabilities: true,
        createdAt: true,
      },
    });

    // Send welcome email to the new admin
    try {
      await this.notifications.sendAdminWelcomeEmail({
        email: admin.email,
        firstName: admin.firstName,
        lastName: admin.lastName,
        password: dto.password,
        adminCapabilities: caps,
      });
    } catch (emailError) {
      // Log but don't fail the admin creation if email fails
      this.logger.warn(
        `Failed to send welcome email to ${admin.email}: ${(emailError as Error).message}`,
      );
    }

    return { admin, message: 'Admin created successfully' };
  }

  // SUPER_ADMIN: set capabilities for an admin
  async setAdminCapabilities(
    targetAdminId: string,
    dto: { adminCapabilities: string[] },
  ) {
    const caps = (dto.adminCapabilities || []).map((c) =>
      String(c).toUpperCase(),
    );
    if (!caps.length) {
      throw new BadRequestException(
        'adminCapabilities must be a non-empty array',
      );
    }

    // Minimal type mapping to Prisma enum
    const validCaps = caps.filter((c) =>
      [
        'SUPER_ADMIN',
        'BACKGROUND_CHECK_REVIEWER',
        'DELETION_REQUEST_REVIEWER',
        'SUPPORT',
      ].includes(c),
    );
    if (!validCaps.length) {
      throw new BadRequestException('No valid capabilities provided');
    }

    const prisma = this.prisma as unknown as {
      admin: {
        update: (args: unknown) => Promise<{
          id: string;
          email: string;
          adminCapabilities: string[];
          updatedAt: Date;
        }>;
      };
    };

    const updated = await prisma.admin.update({
      where: { id: targetAdminId },
      data: { adminCapabilities: validCaps },
      select: {
        id: true,
        email: true,
        adminCapabilities: true,
        updatedAt: true,
      },
    });

    return { admin: updated, message: 'Admin capabilities updated' };
  }

  // Validate user by ID for JWT strategy (no password needed)
  async validateUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        adminCapabilities: true,
        isActive: true,
        isBackgroundVerified: true,
        backgroundCheckStatus: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    return user;
  }

  // Validate user for local strategy (with email and password)
  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        isBackgroundVerified: true,
        backgroundCheckStatus: true,
      },
    });

    if (!user || !user.isActive) {
      return null;
    }

    // Verify password
    const isPasswordValid = await this.verifyPassword(password, user.password);
    if (!isPasswordValid) {
      return null;
    }

    const userWithoutPassword = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive,
      isBackgroundVerified: user.isBackgroundVerified,
      backgroundCheckStatus: user.backgroundCheckStatus,
    };
    return userWithoutPassword;
  }

  // Get user profile
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        isBackgroundVerified: true,
        backgroundCheckStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  // Validate JWT token
  async validateToken(token: string) {
    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      const user = await this.validateUserById(payload.sub);
      return user;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  // --- Email/Phone verification flows ---
  private generateToken(len = 24) {
    return randomBytes(len).toString('hex');
  }

  async requestEmailVerification(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const token = this.generateToken(16);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour
    await this.verificationTokens.create({
      data: { userId, type: 'EMAIL', token, expiresAt },
    });
    // Dev: log token (replace with mail provider later)
    await this.notifications.emitEmailVerificationToken({ userId, token });
    return { success: true, message: 'Verification email sent' };
  }

  async verifyEmail(token: string) {
    const rec = await this.verificationTokens.findUnique({
      where: { token },
    });
    if (
      !rec ||
      rec.type !== 'EMAIL' ||
      rec.consumed ||
      (rec.expiresAt && rec.expiresAt < new Date())
    ) {
      throw new BadRequestException('Invalid or expired token');
    }
    // mark token consumed and set user.emailVerifiedAt
    await this.prisma.user.update({
      where: { id: rec.userId },
      data: { emailVerifiedAt: new Date() },
    });
    await this.verificationTokens.update({
      where: { token },
      data: { consumed: true },
    });

    // Notify user of success
    await this.notifications.sendEmailVerifiedNotification(rec.userId);

    return { success: true, message: 'Email verified' };
  }

  async requestPhoneVerification(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');
    if (!user.phone) throw new BadRequestException('Phone number is required');

    // Use Vonage Verify v2 API – it handles OTP generation and SMS delivery
    const result = await this.notifications.requestVonageVerify(
      user.phone,
      userId,
    );

    if (result) {
      // Store the Vonage request_id as the token so we can check against it later
      const expiresAt = new Date(Date.now() + 1000 * 60 * 10); // 10 min
      await this.verificationTokens.create({
        data: {
          userId,
          type: 'PHONE',
          token: result.requestId,
          expiresAt,
        },
      });
      return { success: true, message: 'OTP sent to phone' };
    }

    // Fallback: generate our own code (for dev/testing when Vonage is unavailable)
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 10);
    await this.verificationTokens.create({
      data: { userId, type: 'PHONE', token: `local:${code}`, expiresAt },
    });
    await this.notifications.emitPhoneOtp({ userId, code });
    return { success: true, message: 'OTP sent to phone' };
  }

  async verifyPhone(userId: string, code: string) {
    // Find the latest unconsumed PHONE token
    const prismaAny = this.prisma as any;
    const rec = await prismaAny.verificationToken.findFirst({
      where: { userId, type: 'PHONE', consumed: false },
      orderBy: { expiresAt: 'desc' },
    });
    if (!rec || (rec.expiresAt && rec.expiresAt < new Date())) {
      throw new BadRequestException(
        'No active verification request. Please request a new code.',
      );
    }

    let valid = false;
    if (rec.token.startsWith('local:')) {
      // Fallback: code was generated locally
      valid = rec.token === `local:${code}`;
    } else {
      // Vonage Verify v2: check against their API
      valid = await this.notifications.checkVonageVerify(rec.token, code);
    }

    if (!valid) {
      throw new BadRequestException('Invalid or expired code');
    }

    // mark token consumed and set user.phoneVerifiedAt
    await this.prisma.user.update({
      where: { id: userId },
      data: { phoneVerifiedAt: new Date() },
    });
    await this.verificationTokens.update({
      where: { token: rec.token },
      data: { consumed: true },
    });
    return { success: true, message: 'Phone verified' };
  }

  // --- Password reset flows ---
  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Always return success to avoid account enumeration
    if (!user)
      return {
        success: true,
        message: 'If the email exists, a temporary password was sent',
      };

    const tempPassword = this.generateTemporaryPassword();
    const hashed = await this.hashPassword(tempPassword);

    const verifyBeforeSave = await this.verifyPassword(tempPassword, hashed);
    if (!verifyBeforeSave) {
      throw new Error('Password hash verification failed');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashed },
    });

    const updated = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { password: true },
    });
    const verifyAfterSave = await this.verifyPassword(
      tempPassword,
      updated!.password,
    );
    if (!verifyAfterSave) {
      throw new Error('Stored password does not match generated password');
    }

    const userProfile = await this.prisma.userProfile.findUnique({
      where: { userId: user.id },
    });

    if (userProfile) {
      const links = (userProfile.links as any) || {};
      links.hasTemporaryPassword = true;
      await this.prisma.userProfile.update({
        where: { userId: user.id },
        data: { links },
      });
    } else {
      await this.prisma.userProfile.create({
        data: {
          userId: user.id,
          links: { hasTemporaryPassword: true },
        },
      });
    }

    await this.notifications.emitTemporaryPassword({
      userId: user.id,
      tempPassword,
    });
    return {
      success: true,
      message: 'If the email exists, a temporary password was sent',
    };
  }

  private generateTemporaryPassword(): string {
    const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowercase = 'abcdefghijkmnpqrstuvwxyz';
    const numbers = '23456789';

    let password = '';
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];

    const allChars = uppercase + lowercase + numbers;
    for (let i = password.length; i < 10; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    return password
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('');
  }

  async resetPassword(token: string, newPassword: string) {
    const rec = await this.verificationTokens.findUnique({ where: { token } });
    if (
      !rec ||
      rec.type !== 'PASSWORD_RESET' ||
      rec.consumed ||
      (rec.expiresAt && rec.expiresAt < new Date())
    ) {
      throw new BadRequestException('Invalid or expired token');
    }
    const hashed = await this.hashPassword(newPassword);
    await this.prisma.user.update({
      where: { id: rec.userId },
      data: { password: hashed },
    });
    await this.verificationTokens.update({
      where: { token },
      data: { consumed: true },
    });
    return { success: true, message: 'Password reset successful' };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    role?: string,
  ) {
    // Admin users live in the admins collection
    if (role === 'ADMIN') {
      const admin = await this.admins.findUnique({
        where: { id: userId },
        select: { id: true, password: true, isActive: true },
      });
      if (!admin || !admin.isActive) {
        throw new UnauthorizedException('Admin not found or inactive');
      }
      const ok = await this.verifyPassword(currentPassword, admin.password);
      if (!ok) throw new BadRequestException('Current password is incorrect');
      const hashed = await this.hashPassword(newPassword);
      await this.admins.update({
        where: { id: userId },
        data: { password: hashed },
      });
      return { success: true, message: 'Password changed successfully' };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true, isActive: true },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }
    const ok = await this.verifyPassword(currentPassword, user.password);
    if (!ok) throw new BadRequestException('Current password is incorrect');
    const hashed = await this.hashPassword(newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashed },
    });

    // Clear temporary password flag when user changes password
    const userProfile = await this.prisma.userProfile.findUnique({
      where: { userId },
    });
    if (userProfile) {
      const links = (userProfile.links as any) || {};
      if (links.hasTemporaryPassword) {
        links.hasTemporaryPassword = false;
        await this.prisma.userProfile.update({
          where: { userId },
          data: { links },
        });
      }
    }

    return { success: true, message: 'Password changed successfully' };
  }

  // --- Email change flows ---
  async requestEmailChange(userId: string, newEmail: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }
    const exists = await this.prisma.user.findUnique({
      where: { email: newEmail },
    });
    if (exists) {
      throw new BadRequestException('Email already in use');
    }
    const token = this.generateToken(16);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60);
    await this.verificationTokens.create({
      data: {
        userId,
        type: 'EMAIL_CHANGE',
        token,
        expiresAt,
        payload: { newEmail },
      },
    });
    await this.notifications.emitEmailChangeToken({ userId, token, newEmail });
    return {
      success: true,
      message: 'If the email is valid, a confirmation was sent',
    };
  }

  async confirmEmailChange(token: string) {
    const rec = await this.verificationTokens.findUnique({ where: { token } });
    if (
      !rec ||
      rec.type !== 'EMAIL_CHANGE' ||
      rec.consumed ||
      (rec.expiresAt && rec.expiresAt < new Date())
    ) {
      throw new BadRequestException('Invalid or expired token');
    }
    const payload = rec.payload as { newEmail?: string } | undefined;
    const newEmail = payload?.newEmail;
    if (!newEmail) throw new BadRequestException('Invalid token payload');
    const exists = await this.prisma.user.findUnique({
      where: { email: newEmail },
    });
    if (exists) throw new BadRequestException('Email already in use');
    await this.prisma.user.update({
      where: { id: rec.userId },
      data: { email: newEmail },
    });
    await this.verificationTokens.update({
      where: { token },
      data: { consumed: true },
    });
    return { success: true, message: 'Email updated successfully' };
  }

  // --- Admin management helpers (SUPER_ADMIN guarded via controller) ---
  async listAdmins() {
    const prisma = this.prisma as unknown as {
      admin: {
        findMany: (args: unknown) => Promise<
          Array<{
            id: string;
            email: string;
            firstName: string;
            lastName: string;
            isActive: boolean;
            adminCapabilities: string[];
            createdAt: Date;
            updatedAt: Date;
          }>
        >;
      };
    };
    const admins = await prisma.admin.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        adminCapabilities: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    } as any);
    return { admins };
  }

  async deleteAdmin(
    targetAdminId: string,
    requestingAdminId: string,
    requestingAdminCapabilities: string[] = [],
  ) {
    if (targetAdminId === requestingAdminId) {
      throw new BadRequestException('You cannot delete your own admin account');
    }

    // Check if target admin is SUPER_ADMIN
    const prisma = this.prisma as unknown as {
      admin: {
        findUnique: (args: {
          where: { id: string };
          select: { adminCapabilities: true };
        }) => Promise<{ adminCapabilities: string[] } | null>;
      };
    };

    const targetAdmin = await prisma.admin.findUnique({
      where: { id: targetAdminId },
      select: { adminCapabilities: true },
    });

    if (targetAdmin) {
      const targetIsSuperAdmin =
        Array.isArray(targetAdmin.adminCapabilities) &&
        targetAdmin.adminCapabilities.includes('SUPER_ADMIN');
      const requestingIsSuperAdmin =
        Array.isArray(requestingAdminCapabilities) &&
        requestingAdminCapabilities.includes('SUPER_ADMIN');

      // Only SUPER_ADMIN can delete SUPER_ADMIN
      if (targetIsSuperAdmin && !requestingIsSuperAdmin) {
        throw new BadRequestException(
          'You cannot delete a SUPER_ADMIN user. Only SUPER_ADMIN users can delete other SUPER_ADMIN users.',
        );
      }
    }

    const prismaDelete = this.prisma as unknown as {
      admin: {
        delete: (args: unknown) => Promise<{ id: string; email: string }>;
      };
    };
    const deleted = await prismaDelete.admin.delete({
      where: { id: targetAdminId },
      select: { id: true, email: true },
    } as any);
    return { deleted, message: 'Admin deleted' };
  }
}
