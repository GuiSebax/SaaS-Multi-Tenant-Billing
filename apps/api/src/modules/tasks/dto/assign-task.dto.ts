import { IsUUID, ValidateIf } from 'class-validator';

export class AssignTaskDto {
  // null unassigns the task; a UUID string assigns it. Both are valid.
  @ValidateIf((o: AssignTaskDto) => o.assigneeId !== null)
  @IsUUID()
  assigneeId!: string | null;
}
