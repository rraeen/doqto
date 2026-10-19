import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { type ClientSession, Model, Types } from 'mongoose';
import { AuditLog } from './audit-log.schema';

export interface AuditEntry {
  actorUserId: string;
  action: string;
  entity: string;
  entityId: Types.ObjectId | string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

/** Writes `auditLogs`. Never logs phones, codes or tokens in before/after. */
@Injectable()
export class AuditService {
  constructor(@InjectModel(AuditLog.name) private readonly logs: Model<AuditLog>) {}

  async record(entry: AuditEntry, session?: ClientSession): Promise<void> {
    await this.logs.create(
      [
        {
          actorUserId: new Types.ObjectId(entry.actorUserId),
          action: entry.action,
          entity: entry.entity,
          entityId: new Types.ObjectId(entry.entityId),
          before: entry.before,
          after: entry.after,
          at: new Date(),
        },
      ],
      { session },
    );
  }
}
