export interface InviteCode {
  code: string;
  label: string;
  createdAt: number;
  usedAt?: number;
  usedByUid?: string;
  usedByName?: string;
}
