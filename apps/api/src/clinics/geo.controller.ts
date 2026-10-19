import { type GeocodeResponse } from '@doqto/shared';
import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { InjectThrottlerStorage, type ThrottlerStorage } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { AppException } from '../common/http/app-exception';
import { DoctorsService } from '../doctors/doctors.service';
import { GEOCODER_PROVIDER, type GeocoderProvider } from '../integrations';
import { GeocodeQueryDto } from './dto/clinic.dto';

const GEOCODE_LIMIT = 30;
const GEOCODE_WINDOW_MS = 60_000;

/**
 * Pin suggestions for the clinic form (INT-07). An empty list means "place the pin by hand".
 * Only the clinic form's users (a doctor profile or clinic staff), 30 per minute per user, since
 * Nominatim capacity is shared by the whole API (RD BE-08 should-fix 3).
 */
@ApiTags('geo')
@ApiBearerAuth()
@Controller('geo')
export class GeoController {
  constructor(
    @Inject(GEOCODER_PROVIDER) private readonly geocoder: GeocoderProvider,
    @InjectThrottlerStorage() private readonly limiter: ThrottlerStorage,
    private readonly doctors: DoctorsService,
  ) {}

  @Get('geocode')
  @ApiOkResponse({ description: 'GeocodeResponse' })
  async geocode(
    @CurrentUser() user: AuthUser,
    @Query() q: GeocodeQueryDto,
  ): Promise<GeocodeResponse> {
    if (!user.roles.includes('clinic_staff') && !(await this.doctors.findByUserId(user.id))) {
      throw AppException.forbidden('Only doctors and clinic staff can look up clinic locations');
    }
    const rec = await this.limiter.increment(
      `geocode-user:${user.id}`,
      GEOCODE_WINDOW_MS,
      GEOCODE_LIMIT,
      GEOCODE_WINDOW_MS,
      'geocode',
    );
    if (rec.isBlocked) throw AppException.rateLimited(Math.max(1, rec.timeToBlockExpire));
    const items = await this.geocoder.geocode(q);
    return {
      items: items.map((r) => ({ lat: r.lat, lng: r.lng, label: r.label, precision: r.precision })),
    };
  }
}
