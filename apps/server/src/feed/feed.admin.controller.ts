import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AdminJwtGuard } from '../auth/guards/admin-jwt.guard';
import { FeedService } from './feed.service';
import { CreateFeedPostDto } from './dto/create-feed-post.dto';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('admin-feed')
@Controller('admin/feed')
@UseGuards(AdminJwtGuard)
export class AdminFeedController {
  constructor(private readonly service: FeedService) {}

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create an admin announcement' })
  @ApiBody({ type: CreateFeedPostDto })
  async create(@Body() dto: CreateFeedPostDto) {
    // Admin user id is encoded in the token/user; we don't need it for now, but we can attach later
    const adminId = 'admin';
    return this.service.createAdminPost(adminId, dto);
  }
}
