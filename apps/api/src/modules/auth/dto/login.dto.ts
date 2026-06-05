import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail()
  declare email: string;

  @IsString()
  declare password: string;
}
