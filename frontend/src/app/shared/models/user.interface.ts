export interface User {
    username: string;
    password:string;
   /* email: string;
    surname1: string;
    surname2: string;
    role: UserRole;
    avatar?: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;*/
  }

  
  export interface UserRole {
    id: string;
    name: string;
    description: string;
    permissions: Permission[];
  }
  
  export interface Permission {
    id: string;
    name: string;
    resource: string;
    action: string;
  }
  
  export interface AuthToken {
    accessToken: string;
    refreshToken?: string;
    expiresIn: number;
    tokenType: string;
  }