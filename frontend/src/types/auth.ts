export type UserRole = "admin" | "manager" | "sales_agent";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SessionResponse {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
  user: User;
}

export interface ApiErrorBody {
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

