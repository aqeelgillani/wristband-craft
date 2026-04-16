export class RegisterDto {
  email: string;
  password: string;
  fullName?: string;
}

export class LoginDto {
  email: string;
  password: string;
}

export class ChangePasswordDto {
  newPassword: string;
}
