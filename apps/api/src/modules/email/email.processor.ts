import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

interface SendInvitationPayload {
  to: string;
  organizationName: string;
  inviterName: string;
  token: string;
  role: string;
}

@Processor('email')
export class EmailProcessor extends WorkerHost {
  async process(job: Job): Promise<void> {
    if (job.name === 'send-invitation') {
      const data = job.data as SendInvitationPayload;
      console.log(
        `[email] send-invitation → to=${data.to} org="${data.organizationName}" role=${data.role} token=${data.token}`,
      );
    }
  }
}
