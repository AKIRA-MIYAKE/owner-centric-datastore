export interface AccessTokenPayload {
  iss: string;
  sub: string;
  aud: string | string[];
  iat: number;
  exp: number;
  azp: string;
  scope?: string;
}

export function isAccessTokenPayload(
  payload: any // eslint-disable-line
): payload is AccessTokenPayload {
  return (
    typeof payload['iss'] === 'string' &&
    typeof payload['sub'] === 'string' &&
    (typeof payload['aud'] === 'string' || Array.isArray(payload['aud'])) &&
    typeof payload['iat'] === 'number' &&
    typeof payload['exp'] === 'number' &&
    typeof payload['azp'] === 'string' &&
    (typeof payload['scope'] === 'undefined' ||
      typeof payload['scope'] === 'string')
  );
}

export interface Entity {
  id: string;
  updated_at: string;
  created_at: string;
}

export interface Record {
  hash_key: string;
  range_key: string;
  lsi_range_key_0?: string;
  lsi_range_key_1?: string;
  lsi_range_key_2?: string;
  lsi_range_key_3?: string;
  lsi_range_key_4?: string;
  gsi_hash_key_0?: string;
  gsi_range_key_0?: string;
  expired_at?: number;
}

// User

export interface UserEntity extends Entity {
  nickname: string;
}

export interface UserRecord extends Record {
  id: string;
  nickname: string;
  updated_at: string;
  created_at: string;
}

// Data

export type DataEntity = DateTypeDataEntity | DatetimeTypeDataEntity;

export interface DateTypeDataEntity extends Entity {
  type: string;
  value: any;  // eslint-disable-line
  date: string;
}

export interface DatetimeTypeDataEntity extends Entity {
  type: string;
  value: any;  // eslint-disable-line
  datetime: string;
}

export interface DataRecord extends Record {
  id: string;
  payload: DataPayload;
  updated_at: string;
  created_at: string;
}

export type DataPayload = DateTypeDataPayload | DatetimeTypeDataPayload;

export function isDataPayload(
  payload: any  // eslint-disable-line
): asserts payload is DataPayload {
  const errorMessages: string[] = [];

  if (typeof payload['type'] === 'undefined') {
    errorMessages.push('"type" is required');
  }

  if (typeof payload['value'] === 'undefined') {
    errorMessages.push('"value" is required');
  }

  if (
    (typeof payload['date'] === 'undefined' &&
      typeof payload['datetime'] === 'undefined') ||
    (typeof payload['date'] !== 'undefined' &&
      typeof payload['datetime'] !== 'undefined')
  ) {
    errorMessages.push('"date" or "datetime" is required');
  }

  if (errorMessages.length > 0) {
    throw new Error(errorMessages.join(' / '));
  }
}

export type GroupDataRecord = DataRecord;

export interface DateTypeDataPayload {
  type: string;
  value: any;  // eslint-disable-line
  date: string;
}

export function isDateTypeDataPayload(
  payload: DataPayload
): payload is DateTypeDataPayload {
  return typeof (payload as any)['date'] === 'string';  // eslint-disable-line
}

export interface DatetimeTypeDataPayload {
  type: string;
  value: any;  // eslint-disable-line
  datetime: string;
}

export function isDatetimeTypeDataPayload(
  payload: DataPayload
): payload is DatetimeTypeDataPayload {
  return typeof (payload as any)['datetime'] === 'string';  // eslint-disable-line
}

// Group

export interface GroupEntity extends Entity {
  name: string;
  owners: MemberEntity[];
  providers: MemberEntity[];
  consumers: MemberEntity[];
}

export interface MemberEntity extends Entity {
  id: string;
  group_id: string;
  group_name: string;
  user_id: string;
  user_nickname: string;
  role: MemberRole;
}

export type MemberRole = 'owner' | 'provider' | 'consumer';

export function isMemberRole(role: string): role is MemberRole {
  return role === 'owner' || role === 'provider' || role === 'consumer';
}

export interface GroupRecord extends Record {
  id: string;
  name: string;
  updated_at: string;
  created_at: string;
}

export interface MemberRecord extends Record {
  id: string;
  group_id: string;
  group_name: string;
  user_id: string;
  user_nickname: string;
  role: MemberRole;
  updated_at: string;
  created_at: string;
}

// Invitation

export interface InvitationEntity extends Entity {
  group_id: string;
  group_name: string;
  user_id: string;
  user_nickname: string;
  role: MemberRole;
  status: InvitationStatus;
}

export type InvitationStatus = 'pending' | 'accept' | 'decline';

export function isInvitationStatus(status: string): status is InvitationStatus {
  return status === 'pending' || status === 'accept' || status === 'decline';
}

export interface InvitationRecord extends Record {
  id: string;
  group_id: string;
  group_name: string;
  user_id: string;
  user_nickname: string;
  role: MemberRole;
  status: InvitationStatus;
  updated_at: string;
  created_at: string;
}
