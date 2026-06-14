import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  declare currentPassword: string;

  @IsString()
  @MinLength(8)
  declare newPassword: string;
}
