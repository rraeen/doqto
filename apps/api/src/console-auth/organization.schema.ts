import {
  MEMBER_ROLES,
  UNIT_STATUSES,
  WORKSPACE_TYPES,
  type MemberRole,
  type UnitStatus,
  type WorkspaceType,
} from '@doqto/shared';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/** The business: "Rao Hospital". Created at sign-up; the account that creates it owns it. */
@Schema({ collection: 'organizations', timestamps: true, strict: true })
export class Organization {
  @Prop({ required: true }) name: string;
  @Prop({ type: Types.ObjectId, ref: 'Account', required: true }) ownerAccountId: Types.ObjectId;
}
export type OrganizationDocument = HydratedDocument<Organization>;
export const OrganizationSchema = SchemaFactory.createForClass(Organization);
OrganizationSchema.index({ ownerAccountId: 1 });

/**
 * One service of an organization: its clinic, its lab or its pharmacy. Each has its own profile
 * form and its own approval, so a clinic can be listed while its lab is still being reviewed.
 * Units of one organization are the internal link between a clinic and its own lab or pharmacy.
 */
/** The doctor's edit of an approved profile: the form answers and, if changed, the new photo. */
export interface PendingChange {
  profile: Record<string, unknown>;
  photoKey?: string;
  photoUrl?: string;
  submittedAt: Date;
  status: 'pending' | 'rejected';
  reviewNote?: string;
  reviewedAt?: Date;
  reviewedBy?: Types.ObjectId;
}

@Schema({ collection: 'units', timestamps: true, strict: true })
export class Unit {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  organizationId: Types.ObjectId;
  @Prop({ type: String, enum: WORKSPACE_TYPES, required: true }) kind: WorkspaceType;
  @Prop({ required: true }) name: string;
  @Prop({ type: String, enum: UNIT_STATUSES, default: 'draft' }) status: UnitStatus;
  /** The profile form answers. The fields per kind arrive with each profile form. */
  @Prop({ type: Object, default: {} }) profile: Record<string, unknown>;
  @Prop() submittedAt?: Date;
  @Prop() reviewedAt?: Date;
  /** What the reviewer told the applicant when sending the application back or rejecting it. */
  @Prop() reviewNote?: string;
  @Prop({ type: Types.ObjectId }) reviewedBy?: Types.ObjectId;
  /** A change the doctor made to the approved profile, waiting for the Doqto team. */
  @Prop({ type: Object }) pendingChange?: PendingChange;
}
export type UnitDocument = HydratedDocument<Unit>;
export const UnitSchema = SchemaFactory.createForClass(Unit);
// One unit of each kind per organization for now.
UnitSchema.index({ organizationId: 1, kind: 1 }, { unique: true });
UnitSchema.index({ kind: 1, status: 1 });

/** Lets an account open a unit. Staff access later reuses this with `staff` and a permission list. */
@Schema({ collection: 'memberships', timestamps: true, strict: true })
export class Membership {
  @Prop({ type: Types.ObjectId, ref: 'Account', required: true }) accountId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  organizationId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Unit', required: true }) unitId: Types.ObjectId;
  @Prop({ type: String, enum: MEMBER_ROLES, required: true }) role: MemberRole;
  /** Empty for an owner, who may do everything. */
  @Prop({ type: [String], default: [] }) permissions: string[];
}
export type MembershipDocument = HydratedDocument<Membership>;
export const MembershipSchema = SchemaFactory.createForClass(Membership);
MembershipSchema.index({ accountId: 1, unitId: 1 }, { unique: true });
MembershipSchema.index({ unitId: 1 });
