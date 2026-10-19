import {
  Controller,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../auth/decorators';
import { ProviderInputError } from '../errors';
import { STORAGE_PROVIDER } from '../tokens';
import { DemoStorageProvider } from './demo-storage.provider';
import type { StorageProvider } from './storage.provider';

const joinKey = (key: string | string[]): string => (Array.isArray(key) ? key.join('/') : key);

/**
 * Serves files written by DemoStorageProvider at /api/v1/demo-storage/*.
 * Answers 404 for everything unless demo storage is the bound provider, so
 * in live mode this route does not exist in practice. Private files need an
 * unexpired HMAC-signed URL from `signedUrl()`, exactly like R2 presigning.
 */
@ApiExcludeController()
// Anonymous by design (gateway callbacks / signed URLs), so exempt from the global JwtAuthGuard.
@Public()
@Controller('demo-storage')
export class DemoStorageController {
  constructor(@Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider) {}

  @Get('public/*key')
  async getPublic(@Param('key') key: string | string[], @Res({ passthrough: true }) res: Response) {
    const file = await this.read('public', joinKey(key));
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return this.send(file, res);
  }

  @Get('private/*key')
  async getPrivate(
    @Param('key') key: string | string[],
    @Query('expires') expires: string | undefined,
    @Query('sig') sig: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const objectKey = joinKey(key);
    const demo = this.demo();
    if (!demo.verifySignedUrl(objectKey, Number(expires), String(sig ?? ''))) {
      throw new ForbiddenException('Link expired or invalid');
    }
    const file = await this.read('private', objectKey);
    res.setHeader('Cache-Control', 'private, no-store');
    // Download rather than render PDFs inline from the API origin.
    if (file.contentType === 'application/pdf') res.setHeader('Content-Disposition', 'attachment');
    return this.send(file, res);
  }

  private demo(): DemoStorageProvider {
    if (!(this.storage instanceof DemoStorageProvider)) throw new NotFoundException();
    return this.storage;
  }

  private async read(visibility: 'public' | 'private', key: string) {
    try {
      return await this.demo().read(visibility, key);
    } catch (err) {
      if (err instanceof NotFoundException || err instanceof ProviderInputError)
        throw new NotFoundException();
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') throw new NotFoundException();
      throw err;
    }
  }

  private send(file: { body: Buffer; contentType: string }, res: Response): StreamableFile {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(file.body, { type: file.contentType, length: file.body.length });
  }
}
