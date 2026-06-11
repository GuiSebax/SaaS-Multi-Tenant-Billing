export class CommentResponseDto {
  id!: string;
  content!: string;
  taskId!: string;
  organizationId!: string;
  userId!: string;
  authorName!: string | null;
  createdAt!: Date;
}
