import { IsEmail, IsEnum } from 'class-validator';

export class InviteMemberDto {
  @IsEmail()
  declare email: string;

  @IsEnum(['admin', 'member'])
  declare role: 'admin' | 'member';
}
