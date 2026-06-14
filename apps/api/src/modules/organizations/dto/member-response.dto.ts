export class MemberResponseDto {
  userId!: string;
  role!: 'owner' | 'admin' | 'member';
  name!: string;
  email!: string;
  joinedAt!: Date;
}
