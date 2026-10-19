import { HttpStatus } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProviderInputError } from '../../integrations';
import { AppException } from './app-exception';

/** The parts of a multer file we use (avoids a dependency on @types/multer). */
export interface UploadedBlob {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}

/**
 * Multipart field `file`, kept in memory, capped at `maxBytes`. Type and magic-byte checks
 * happen in StorageProvider (INT-06), which rejects with ProviderInputError.
 */
export const SingleFile = (maxBytes: number) =>
  FileInterceptor('file', { limits: { fileSize: maxBytes, files: 1, fields: 0 } });

export function requireFile(file: UploadedBlob | undefined): UploadedBlob {
  if (!file?.buffer?.length) {
    throw new AppException(
      HttpStatus.BAD_REQUEST,
      'VALIDATION_FAILED',
      'Attach a file in the "file" field',
      {
        issues: [{ path: 'file', message: 'Required' }],
      },
    );
  }
  return file;
}

/** Runs a storage call, turning the provider's input errors into a 400. */
export async function storeOrReject<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    if (e instanceof ProviderInputError) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_FAILED',
        'This file type or size is not allowed',
        {
          issues: [{ path: 'file', message: e.message }],
        },
      );
    }
    throw e;
  }
}
