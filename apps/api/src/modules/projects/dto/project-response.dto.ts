export class ProjectResponseDto {
  id!: string;
  name!: string;
  description!: string | null;
  status!: string;
  createdAt!: Date;
  organizationId!: string;
}
