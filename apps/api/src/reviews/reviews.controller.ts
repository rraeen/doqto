import {
  type DoctorReviewsPage,
  type MyReviewResponse,
  type ReviewEligibilityResponse,
} from '@doqto/shared';
import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser, Public } from '../auth/decorators';
import {
  CreateReviewDto,
  DoctorReviewsQueryDto,
  ReportReviewDto,
  UpdateReviewDto,
} from './dto/reviews.dto';
import { ReviewsService } from './reviews.service';

const WRITE_LIMIT = { default: { limit: 20, ttl: 60_000 } };

@ApiTags('reviews')
@ApiBearerAuth()
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  /** The patient's finished visits and whether each can be reviewed now. */
  @Get('eligibility')
  @ApiOkResponse({ description: 'ReviewEligibilityResponse' })
  eligibility(@CurrentUser() user: AuthUser): Promise<ReviewEligibilityResponse> {
    return this.reviews.eligibility(user.id);
  }

  @Post()
  @Throttle(WRITE_LIMIT)
  @ApiCreatedResponse({ description: 'MyReviewResponse' })
  @ApiConflictResponse({ description: 'Already reviewed' })
  create(@CurrentUser() user: AuthUser, @Body() body: CreateReviewDto): Promise<MyReviewResponse> {
    return this.reviews.create(user.id, body);
  }

  /** The patient's own review of a visit, in any state. 404 when there is none. */
  @Get('mine/:appointmentId')
  @ApiOkResponse({ description: 'MyReviewResponse' })
  mine(
    @CurrentUser() user: AuthUser,
    @Param('appointmentId') appointmentId: string,
  ): Promise<MyReviewResponse> {
    return this.reviews.mine(user.id, appointmentId);
  }

  /** One edit, within 7 days of submitting. */
  @Patch(':id')
  @Throttle(WRITE_LIMIT)
  @ApiOkResponse({ description: 'MyReviewResponse' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: UpdateReviewDto,
  ): Promise<MyReviewResponse> {
    return this.reviews.update(user.id, id, body);
  }

  @Post(':id/report')
  @HttpCode(204)
  @Throttle(WRITE_LIMIT)
  @ApiNoContentResponse()
  async report(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: ReportReviewDto,
  ): Promise<void> {
    await this.reviews.report(user.id, id, body);
  }
}

@ApiTags('doctors')
@Controller('doctors')
export class DoctorReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  /** Published reviews of a doctor, newest first: first name and last initial only. */
  @Public()
  @Get(':id/reviews')
  @ApiOkResponse({ description: 'DoctorReviewsPage' })
  list(@Param('id') id: string, @Query() q: DoctorReviewsQueryDto): Promise<DoctorReviewsPage> {
    return this.reviews.publicList(id, q);
  }
}
