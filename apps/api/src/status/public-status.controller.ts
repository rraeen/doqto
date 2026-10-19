import { type DoctorStatus } from '@doqto/shared';
import { Controller, Get, Header, Param } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { isValidObjectId, Model } from 'mongoose';
import { Public } from '../common/http/public';
import { AppException } from '../common/http/app-exception';
import { istDate } from '../common/time/ist';
import { Doctor } from '../doctors/doctor.schema';
import { DoctorStatusService, toDoctorStatus } from './doctor-status.service';

/** BE-18 `GET /doctors/:id/status`: the polled, edge-cached, patient-free status (TDD 6.5). */
@ApiTags('doctors')
@Controller('doctors')
export class PublicStatusController {
  constructor(
    @InjectModel(Doctor.name) private readonly doctors: Model<Doctor>,
    private readonly status: DoctorStatusService,
  ) {}

  @Public()
  @Get(':id/status')
  @Header('Cache-Control', 'public, s-maxage=15, max-age=15')
  @ApiOkResponse({ description: 'DoctorStatus for today (IST)' })
  async get(@Param('id') id: string): Promise<DoctorStatus> {
    const d = isValidObjectId(id)
      ? await this.doctors.findOne({ _id: id, isListed: true }, { _id: 1 }).exec()
      : null;
    if (!d) throw AppException.notFound('Doctor not found');
    const date = istDate();
    return toDoctorStatus(await this.status.find(d._id, date), d._id, date);
  }
}
