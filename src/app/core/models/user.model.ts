export interface AppUser {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  createdAt: number;
  isAdmin?: boolean;
  isApproved?: boolean;
}
