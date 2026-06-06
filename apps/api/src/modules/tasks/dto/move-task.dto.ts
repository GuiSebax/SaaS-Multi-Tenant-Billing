import { IsNumber, IsUUID, Min } from 'class-validator';

export class MoveTaskDto {
  @IsUUID()
  projectId!: string;

  @IsNumber()
  @Min(0)
  position!: number;
}
