import { IsEnum } from 'class-validator';

export class UpdateMemberRoleDto {
  @IsEnum(['admin', 'member'])
  role!: 'admin' | 'member';
}
