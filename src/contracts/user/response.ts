export interface UserResponse {
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string | null;
  isActive: boolean;
  branch: string | null;
}
