import { User } from "../../../shared/models/user.interface";

export interface AuthResponse {
    user: User;
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }