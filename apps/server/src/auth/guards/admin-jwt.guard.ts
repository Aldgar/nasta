import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

interface JwtUser {
  role: string;
  // add other properties if needed
}

@Injectable()
// Use a dedicated admin JWT strategy to validate against the Admin collection
export class AdminJwtGuard
  extends AuthGuard('admin-jwt')
  implements CanActivate
{
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // First, validate the JWT token
    const isJwtValid = await super.canActivate(context);
    if (!isJwtValid) {
      return false;
    }

    // Then check if user is admin
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as JwtUser;

    if (!user || user.role !== 'ADMIN') {
      throw new UnauthorizedException('Admin access required');
    }

    return true;
  }
}
