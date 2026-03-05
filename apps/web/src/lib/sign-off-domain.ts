export const SIGN_OFF_ROLES = [
  "releaseManager",
  "incidentCommander",
  "platformOperator",
  "governanceLead"
] as const;

export type SignOffRole = (typeof SIGN_OFF_ROLES)[number];

export const SIGN_OFF_STATUSES = ["pending", "approved", "rejected"] as const;

export type SignOffStatus = (typeof SIGN_OFF_STATUSES)[number];

export function isSignOffStatus(value: string): value is SignOffStatus {
  return SIGN_OFF_STATUSES.includes(value as SignOffStatus);
}
