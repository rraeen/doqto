import { parseNear, type DoctorListItem, type DoctorProfile, type Page } from '@doqto/shared';
import { Controller, Get, HttpStatus, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators';
import { AppException } from '../common/http/app-exception';
import { DoctorSearchService } from '../search/doctor-search.service';
import { DoctorSearchQueryDto } from './dto/search.dto';

@ApiTags('doctors')
@Public()
@Controller('doctors')
export class DoctorsController {
  constructor(private readonly search: DoctorSearchService) {}

  @Get()
  @ApiOkResponse({ description: 'Page<DoctorListItem>' })
  list(@Query() q: DoctorSearchQueryDto): Promise<Page<DoctorListItem>> {
    if (!q.city && !q.near) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', 'Provide city or near', {
        issues: [{ path: 'city', message: 'Provide city or near' }],
      });
    }
    const near = q.near ? parseNear(q.near) : undefined;
    return this.search.search({
      city: q.city,
      specialty: q.specialty,
      near: near ?? undefined,
      radiusKm: q.radiusKm,
      q: q.q,
      cursor: q.cursor,
      limit: q.limit,
    });
  }

  @Get(':slug')
  @ApiOkResponse({ description: 'DoctorProfile' })
  profile(@Param('slug') slug: string): Promise<DoctorProfile> {
    if (!/^[a-z0-9-]{3,90}$/.test(slug)) throw AppException.notFound('Doctor not found');
    return this.search.profileBySlug(slug);
  }
}
