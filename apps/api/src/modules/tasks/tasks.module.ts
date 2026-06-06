import { Module } from '@nestjs/common';
import { DatabaseModule } from '@database/database.module';
import { ProjectTasksController, TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ProjectTasksController, TasksController],
  providers: [TasksService],
})
export class TasksModule {}
