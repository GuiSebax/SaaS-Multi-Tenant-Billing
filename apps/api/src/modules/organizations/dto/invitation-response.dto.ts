export class InvitationResponseDto {
  declare id: string;
  declare email: string;
  declare role: 'admin' | 'member';
  declare expiresAt: Date;
}
