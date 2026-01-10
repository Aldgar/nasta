import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Lightweight doc types to satisfy linting until Prisma types are regenerated
type UserLite = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  avatar?: string | null;
  phone?: string | null;
  location?: string | null;
  city?: string | null;
  country?: string | null;
  emailVerifiedAt?: Date | null;
  phoneVerifiedAt?: Date | null;
  isIdVerified?: boolean;
  idVerificationStatus?: string;
  isBackgroundVerified?: boolean;
  backgroundCheckStatus?: string;
};
type UserProfileDoc = {
  id: string;
  userId: string;
  bio?: string | null;
  headline?: string | null;
  avatarUrl?: string | null;
  links?: unknown;
  skillsSummary?: string[];
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  lat?: number | null;
  lng?: number | null;
  createdAt: Date;
  updatedAt: Date;
};
type EmployerProfileDoc = {
  id: string;
  employerId: string;
  contactName?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  website?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  lat?: number | null;
  lng?: number | null;
  createdAt: Date;
  updatedAt: Date;
};
type AdminProfileDoc = {
  id: string;
  adminId: string;
  bio?: string | null;
  avatarUrl?: string | null;
  contact?: unknown;
  createdAt: Date;
  updatedAt: Date;
};

type AddressPatch = {
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  lat?: number;
  lng?: number;
};

@Injectable()
export class ProfilesService {
  constructor(private prisma: PrismaService) {}

  // Temporary typed delegates to avoid IDE type lag; safe at runtime
  private get userProfiles() {
    const prisma = this.prisma as unknown as {
      userProfile: {
        findUnique: (args: {
          where: { userId: string };
        }) => Promise<UserProfileDoc | null>;
        upsert: (args: {
          where: { userId: string };
          create: Partial<UserProfileDoc> & { userId: string };
          update: Partial<UserProfileDoc>;
        }) => Promise<UserProfileDoc>;
      };
    };
    return prisma.userProfile;
  }

  private get employerProfiles() {
    const prisma = this.prisma as unknown as {
      employerProfile: {
        findUnique: (args: {
          where: { employerId: string };
        }) => Promise<EmployerProfileDoc | null>;
        upsert: (args: {
          where: { employerId: string };
          create: Partial<EmployerProfileDoc> & { employerId: string };
          update: Partial<EmployerProfileDoc>;
        }) => Promise<EmployerProfileDoc>;
      };
    };
    return prisma.employerProfile;
  }

  private get adminProfiles() {
    const prisma = this.prisma as unknown as {
      adminProfile: {
        findUnique: (args: {
          where: { adminId: string };
        }) => Promise<AdminProfileDoc | null>;
        upsert: (args: {
          where: { adminId: string };
          create: Partial<AdminProfileDoc> & { adminId: string };
          update: Partial<AdminProfileDoc>;
        }) => Promise<AdminProfileDoc>;
      };
    };
    return prisma.adminProfile;
  }

  // --- User (Job Seeker) ---
  async getUserProfile(userId: string) {
    const userPromise = this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        avatar: true,
        phone: true,
        location: true,
        city: true,
        country: true,
        emailVerifiedAt: true,
        phoneVerifiedAt: true,
        isIdVerified: true,
        idVerificationStatus: true,
        isBackgroundVerified: true,
        backgroundCheckStatus: true,
        skills: {
          select: {
            skill: {
              select: {
                id: true,
                name: true,
              },
            },
            yearsExp: true,
            proficiency: true,
          },
        },
      },
    }) as unknown as Promise<(UserLite & { skills?: Array<{ skill: { id: string; name: string }; yearsExp: number | null; proficiency: string }> }) | null>;
    const profilePromise = this.userProfiles.findUnique({ where: { userId } });
    const [user, profile] = await Promise.all([userPromise, profilePromise]);
    if (!user) throw new UnauthorizedException('User not found');
    
    // Check if user has temporary password
    const hasTemporaryPassword = profile?.links && 
      typeof profile.links === 'object' && 
      'hasTemporaryPassword' in profile.links &&
      (profile.links as any).hasTemporaryPassword === true;
    
    return { user, profile, hasTemporaryPassword };
  }

  async updateUserProfile(
    userId: string,
    data: Partial<{
      bio: string;
      headline: string;
      avatarUrl: string;
      links: unknown;
      dateOfBirth?: string;
    }>,
  ) {
    // Prepare update data, converting dateOfBirth string to Date if provided
    const updateData: any = { ...data };
    if (data.dateOfBirth) {
      updateData.dateOfBirth = new Date(data.dateOfBirth);
    }
    
    // upsert profile
    const profile = await this.userProfiles.upsert({
      where: { userId },
      create: { userId, ...updateData },
      update: { ...updateData },
    });
    // keep legacy avatar on User in sync if provided
    if (data.avatarUrl) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { avatar: data.avatarUrl },
      });
    }
    return { profile };
  }

  async updateUserAddress(
    userId: string,
    data: Partial<{
      addressLine1: string;
      addressLine2: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
      lat: number;
      lng: number;
    }>,
  ) {
    const patch: AddressPatch = { ...data };
    if (
      (data.lat !== undefined && data.lng === undefined) ||
      (data.lng !== undefined && data.lat === undefined)
    ) {
      throw new BadRequestException('Provide both lat and lng together');
    }
    if (data.lat !== undefined && data.lng !== undefined) {
      if (
        data.lat < -90 ||
        data.lat > 90 ||
        data.lng < -180 ||
        data.lng > 180
      ) {
        throw new BadRequestException('Invalid lat/lng values');
      }
      patch.lat = data.lat;
      patch.lng = data.lng;
    }
    const profile = await this.userProfiles.upsert({
      where: { userId },
      create: { userId, ...patch },
      update: { ...patch },
    });
    return { profile, message: 'Address updated' };
  }

  // --- Employer ---
  async getEmployerProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        emailVerifiedAt: true,
        phoneVerifiedAt: true,
        // ID and Background verification not required for employers
        // isIdVerified: true,
        // idVerificationStatus: true,
        // isBackgroundVerified: true,
        // backgroundCheckStatus: true,
        isBusinessVerified: true,
        businessVerificationStatus: true,
      },
    });
    if (!user) throw new UnauthorizedException('User not found');
    if (user.role !== 'EMPLOYER') {
      throw new UnauthorizedException('Employer role required');
    }
    const profile = await this.employerProfiles.findUnique({
      where: { employerId: userId },
    });
    // Also fetch UserProfile as fallback for address verification
    const userProfile = await this.prisma.userProfile.findUnique({
      where: { userId: userId },
      select: {
        addressLine1: true,
        addressLine2: true,
        city: true,
        state: true,
        postalCode: true,
        country: true,
        lat: true,
        lng: true,
        links: true,
      },
    });
    
    // Check if user has temporary password
    const hasTemporaryPassword = userProfile?.links && 
      typeof userProfile.links === 'object' && 
      'hasTemporaryPassword' in userProfile.links &&
      (userProfile.links as any).hasTemporaryPassword === true;
    
    return { user, profile, userProfile, hasTemporaryPassword };
  }

  async updateEmployerProfile(
    userId: string,
    data: Partial<{
      contactName: string;
      description: string;
      logoUrl: string;
      website: string;
    }>,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (!user) throw new UnauthorizedException('User not found');
    if (user.role !== 'EMPLOYER') {
      throw new UnauthorizedException('Employer role required');
    }
    const profile = await this.employerProfiles.upsert({
      where: { employerId: userId },
      create: { employerId: userId, ...data },
      update: { ...data },
    });
    return { profile };
  }

  async updateEmployerAddress(
    userId: string,
    data: Partial<{
      addressLine1: string;
      addressLine2: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
      lat: number;
      lng: number;
    }>,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (!user) throw new UnauthorizedException('User not found');
    if (user.role !== 'EMPLOYER') {
      throw new UnauthorizedException('Employer role required');
    }
    const patch: AddressPatch = { ...data };
    if (
      (data.lat !== undefined && data.lng === undefined) ||
      (data.lng !== undefined && data.lat === undefined)
    ) {
      throw new BadRequestException('Provide both lat and lng together');
    }
    if (data.lat !== undefined && data.lng !== undefined) {
      if (
        data.lat < -90 ||
        data.lat > 90 ||
        data.lng < -180 ||
        data.lng > 180
      ) {
        throw new BadRequestException('Invalid lat/lng values');
      }
      patch.lat = data.lat;
      patch.lng = data.lng;
    }
    const profile = await this.employerProfiles.upsert({
      where: { employerId: userId },
      create: { employerId: userId, ...patch },
      update: { ...patch },
    });
    return { profile, message: 'Address updated' };
  }

  // --- Admin ---
  async getAdminProfile(adminId: string) {
    const [admin, profile] = await Promise.all([
      this.prisma.admin.findUnique({
        where: { id: adminId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          isActive: true,
        },
      }),
      this.adminProfiles.findUnique({ where: { adminId } }),
    ]);
    if (!admin) throw new UnauthorizedException('Admin not found');
    return { admin, profile };
  }

  async updateAdminProfile(
    adminId: string,
    data: Partial<{ bio: string; avatarUrl: string; contact: unknown }>,
  ) {
    const profile = await this.adminProfiles.upsert({
      where: { adminId },
      create: { adminId, ...data },
      update: { ...data },
    });
    return { profile };
  }

  async completeOnboarding(
    userId: string,
    data: {
      aboutMe: string;
      hourlyRate: number; // Keep for backward compatibility
      yearsExperience: number;
      languages: Array<{ language: string; level: string }> | string[];
      skills: Array<{ name: string; yearsExperience: number }> | string[];
      cvUrl?: string;
      rates?: Array<{
        rate: number;
        paymentType: string;
        otherSpecification?: string;
      }>;
      workExperience?: Array<{
        company: string;
        fromDate: string;
        toDate: string;
        isCurrent: boolean;
        category: string;
        years: string;
        description: string;
      }>;
      certifications?: Array<{
        title: string;
        institution: string;
        graduationDate: string;
        isStillStudying: boolean;
        certificateUri?: string | null;
        certificateName?: string | null;
      }>;
      education?: Array<{
        title: string;
        institution: string;
        graduationDate: string;
        isStillStudying: boolean;
        certificateUri?: string | null;
        certificateName?: string | null;
      }>;
      projects?: Array<{
        title: string;
        description: string;
        url?: string;
      }>;
    },
  ) {
    // Verify user exists and is a job seeker
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (!user) throw new UnauthorizedException('User not found');
    if (user.role !== 'JOB_SEEKER') {
      throw new UnauthorizedException('Job seeker role required');
    }

    // First, remove all existing user skills to replace with new ones
    await this.prisma.userSkill.deleteMany({
      where: { userId },
    });

    // Handle skills - map to existing categories or create new ones
    // Map common skills to existing categories
    const skillToCategoryMap: Record<string, string> = {
      'Plumbing': 'Plumbing',
      'Electrical': 'Electrical',
      'Cleaning': 'Cleaning',
      'Carpentry': 'Carpentry',
      'Painting': 'Painting',
      'Gardening': 'Gardening',
      'Moving': 'Moving',
      'Assembly': 'Assembly',
      'Delivery': 'Delivery',
    };

    // Normalize skills to array of objects
    let normalizedSkills: Array<{ name: string; yearsExperience: number }> = [];
    if (Array.isArray(data.skills) && data.skills.length > 0) {
      if (typeof data.skills[0] === 'string') {
        normalizedSkills = (data.skills as string[]).map((s: string) => ({ 
          name: s, 
          yearsExperience: data.yearsExperience 
        }));
      } else {
        normalizedSkills = (data.skills as any[]).map((s: any) => {
          // Handle case where skill might be an object
          if (typeof s === 'object' && s !== null) {
            // If it's already in the correct format
            if (typeof s.name === 'string' && typeof s.yearsExperience !== 'undefined') {
              return { name: String(s.name), yearsExperience: Number(s.yearsExperience) || 0 };
            }
            // If the entire object is being passed as name (edge case)
            if (s.name && typeof s.name === 'object') {
              return { name: String(s.name.name || s.name), yearsExperience: Number(s.yearsExperience || s.name.yearsExperience) || 0 };
            }
            // Fallback: try to extract name from object
            return { name: String(s.name || s), yearsExperience: Number(s.yearsExperience) || 0 };
          }
          return { name: String(s), yearsExperience: data.yearsExperience || 0 };
        });
      }
    }

    const skillPromises = normalizedSkills.map(async (skillData) => {
      // Ensure skillName is a string - handle edge cases where name might be an object
      let skillName: string;
      if (typeof skillData.name === 'string') {
        skillName = skillData.name;
      } else if (typeof skillData.name === 'object' && skillData.name !== null) {
        // If name is an object, try to extract the actual name
        skillName = String((skillData.name as any).name || skillData.name || '');
      } else {
        skillName = String(skillData.name || '');
      }
      
      skillName = skillName.trim();
      if (!skillName) {
        console.warn(`[ProfilesService] Skipping invalid skill: ${JSON.stringify(skillData)}`);
        return null;
      }
      
      // Ensure categoryName is always a string
      const mappedCategory = skillToCategoryMap[skillName];
      const categoryName: string = typeof mappedCategory === 'string' ? mappedCategory : skillName;
      
      // Try exact match first
      let category = await this.prisma.jobCategory.findFirst({
        where: { name: categoryName },
      });
      
      // If not found, try the skill name
      if (!category) {
        category = await this.prisma.jobCategory.findFirst({
          where: { name: skillName },
        });
      }

      // If no category found, create one
      if (!category) {
        category = await this.prisma.jobCategory.create({
          data: {
            name: categoryName,
            isActive: true,
            description: `Category for ${categoryName} services`,
          },
        });
      }

      // Find or create skill (exact match)
      let skill = await this.prisma.skill.findFirst({
        where: { name: skillName },
      });

      if (!skill) {
        skill = await this.prisma.skill.create({
          data: {
            name: skillName,
            categoryId: category.id,
            level: 'BEGINNER',
          },
        });
      } else if (skill.categoryId !== category.id) {
        // If skill exists but is in a different category, update it
        skill = await this.prisma.skill.update({
          where: { id: skill.id },
          data: { categoryId: category.id },
        });
      }

      // Create user skill with years of experience
      await this.prisma.userSkill.create({
        data: {
          userId,
          skillId: skill.id,
          yearsExp: skillData.yearsExperience || data.yearsExperience,
          proficiency: 'INTERMEDIATE', // Default proficiency
        },
      });

      return { category, skill };
    });

    // Filter out null results from invalid skills
    const validSkillPromises = skillPromises.filter(p => p !== null);
    await Promise.all(validSkillPromises);

    // Normalize languages to array of objects
    const normalizedLanguages = Array.isArray(data.languages) && data.languages.length > 0
      ? (typeof data.languages[0] === 'string'
          ? (data.languages as string[]).map(l => ({ language: l, level: 'INTERMEDIATE' }))
          : data.languages as Array<{ language: string; level: string }>)
      : [];

    // Update user profile with all data including languages, rates, work experience, etc.
    const linksData: any = {
      hourlyRate: data.hourlyRate, // Keep for backward compatibility
      yearsExperience: data.yearsExperience,
      languages: normalizedLanguages,
      cvUrl: data.cvUrl,
    };
    
    // Add rates array if provided
    if (data.rates && data.rates.length > 0) {
      linksData.rates = data.rates;
    }

    // Add work experience if provided
    if (data.workExperience && data.workExperience.length > 0) {
      linksData.workExperience = data.workExperience;
    }

    // Add certifications if provided
    if (data.certifications && data.certifications.length > 0) {
      linksData.certifications = data.certifications;
    }

    // Add education if provided
    if (data.education && data.education.length > 0) {
      linksData.education = data.education;
    }

    // Add projects if provided
    if (data.projects && data.projects.length > 0) {
      linksData.projects = data.projects;
    }

    // Add skills with years of experience
    if (normalizedSkills.length > 0) {
      linksData.skills = normalizedSkills;
    }
    
    await this.userProfiles.upsert({
      where: { userId },
      create: {
        userId,
        bio: data.aboutMe,
        skillsSummary: normalizedSkills.map(s => s.name),
        links: linksData as unknown,
      },
      update: {
        bio: data.aboutMe,
        skillsSummary: normalizedSkills.map(s => s.name),
        links: linksData as unknown,
      },
    });

    return {
      message: 'Onboarding completed successfully',
      profile: await this.userProfiles.findUnique({ where: { userId } }),
    };
  }
}
