export class TaskResponseDto {
  id!: string;
  title!: string;
  description!: string | null;
  status!: string;
  position!: number;
  projectId!: string;
  organizationId!: string;
  assigneeId!: string | null;
  createdBy!: string | null;
  createdAt!: Date;
  updatedAt!: Date;
}
