import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { VehiclesService } from './vehicles.service';
import { VehicleFileUploadService } from './vehicle-file-upload.service';

@ApiTags('vehicles')
@ApiBearerAuth()
@Controller('vehicles')
@UseGuards(JwtAuthGuard)
export class VehiclesController {
  constructor(
    private readonly vehiclesService: VehiclesService,
    private readonly fileUpload: VehicleFileUploadService,
  ) {}

  @Post()
  async create(
    @Req() req: Request & { user: { id: string } },
    @Body()
    body: {
      vehicleType: 'TRUCK' | 'VAN' | 'CAR' | 'MOTORCYCLE' | 'OTHER';
      otherTypeSpecification?: string;
      make: string;
      model: string;
      year: number;
      color?: string;
      licensePlate: string;
      capacity?: string;
    },
  ) {
    const user = req.user;
    return this.vehiclesService.createVehicle(user.id, body);
  }

  @Put(':id/details')
  async updateDetails(
    @Req() req: Request & { user: { id: string } },
    @Param('id') id: string,
    @Body()
    body: {
      vehicleType?: 'TRUCK' | 'VAN' | 'CAR' | 'MOTORCYCLE' | 'OTHER';
      otherTypeSpecification?: string;
      make?: string;
      model?: string;
      year?: number;
      color?: string;
      licensePlate?: string;
      capacity?: string;
    },
  ) {
    return this.vehiclesService.updateVehicleDetails(req.user.id, id, body);
  }

  @Post(':id/upload')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'photoFront', maxCount: 1 },
        { name: 'photoBack', maxCount: 1 },
        { name: 'photoLeft', maxCount: 1 },
        { name: 'photoRight', maxCount: 1 },
        { name: 'vehicleLicense', maxCount: 1 },
      ],
      { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } },
    ),
  )
  async uploadPhotos(
    @Req() req: Request & { user: { id: string } },
    @Param('id') id: string,
    @UploadedFiles()
    files: {
      photoFront?: Express.Multer.File[];
      photoBack?: Express.Multer.File[];
      photoLeft?: Express.Multer.File[];
      photoRight?: Express.Multer.File[];
      vehicleLicense?: Express.Multer.File[];
    },
  ) {
    if (!files || Object.keys(files).length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    // Verify ownership
    await this.vehiclesService.getOwnedVehicle(req.user.id, id);

    const fieldMap: Record<
      string,
      {
        kind: 'front' | 'back' | 'left' | 'right' | 'vehicle-license';
        dbField:
          | 'photoFrontUrl'
          | 'photoBackUrl'
          | 'photoLeftUrl'
          | 'photoRightUrl'
          | 'vehicleLicenseUrl';
      }
    > = {
      photoFront: { kind: 'front', dbField: 'photoFrontUrl' },
      photoBack: { kind: 'back', dbField: 'photoBackUrl' },
      photoLeft: { kind: 'left', dbField: 'photoLeftUrl' },
      photoRight: { kind: 'right', dbField: 'photoRightUrl' },
      vehicleLicense: { kind: 'vehicle-license', dbField: 'vehicleLicenseUrl' },
    };

    const results: Record<string, string> = {};
    for (const [fieldName, config] of Object.entries(fieldMap)) {
      const fileArr = files[fieldName as keyof typeof files];
      if (fileArr && fileArr.length > 0) {
        const url = await this.fileUpload.saveFile(fileArr[0], config.kind);
        await this.vehiclesService.updateVehiclePhoto(id, config.dbField, url);
        results[config.dbField] = url;
      }
    }

    return { message: 'Photos uploaded successfully', uploaded: results };
  }

  @Get('my-vehicles')
  async getMyVehicles(@Req() req: Request & { user: { id: string } }) {
    return this.vehiclesService.getMyVehicles(req.user.id);
  }

  @Delete(':id')
  async remove(
    @Req() req: Request & { user: { id: string } },
    @Param('id') id: string,
  ) {
    await this.vehiclesService.deleteVehicle(req.user.id, id);
    return { message: 'Vehicle deleted' };
  }
}
