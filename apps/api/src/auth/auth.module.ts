import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AppConfig } from '../config/app-config.service';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpChallengeService } from './otp-challenge.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { TokenService } from './token.service';

/**
 * Phone OTP login, tokens, and the two global guards: `JwtAuthGuard` (every route needs a
 * token unless `@Public()`) then `RolesGuard` (`@Roles(...)`).
 */
@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        secret: config.get('JWT_ACCESS_SECRET'),
        signOptions: { algorithm: 'HS256', expiresIn: config.get('JWT_ACCESS_TTL') },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    OtpChallengeService,
    TokenService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [TokenService, OtpChallengeService],
})
export class AuthModule {}
