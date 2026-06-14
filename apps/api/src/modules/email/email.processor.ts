import { Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Resend } from 'resend';
import { RESEND_CLIENT } from './resend.provider';

interface SendInvitationPayload {
  to: string;
  organizationName: string;
  inviterName: string;
  token: string;
  role: string;
}

@Processor('email')
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    @Inject(RESEND_CLIENT) private readonly resend: Resend,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === 'send-invitation') {
      await this.sendInvitation(job.data as SendInvitationPayload);
    }
  }

  private async sendInvitation(payload: SendInvitationPayload): Promise<void> {
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const acceptUrl = `${frontendUrl}/invitations/${payload.token}/accept`;

    const html = buildInvitationEmail({
      inviterName: payload.inviterName,
      organizationName: payload.organizationName,
      role: payload.role,
      acceptUrl,
    });

    try {
      const { error } = await this.resend.emails.send({
        from: 'onboarding@resend.dev',
        to: payload.to,
        subject: `${payload.inviterName} invited you to join ${payload.organizationName}`,
        html,
      });

      if (error) {
        this.logger.error(
          `Failed to send invitation email to ${payload.to}: ${error.message}`,
        );
      } else {
        this.logger.log(
          `Invitation email sent → to=${payload.to} org="${payload.organizationName}" role=${payload.role}`,
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Resend threw while sending to ${payload.to}: ${message}`);
    }
  }
}

function buildInvitationEmail(opts: {
  inviterName: string;
  organizationName: string;
  role: string;
  acceptUrl: string;
}): string {
  const { inviterName, organizationName, role, acceptUrl } = opts;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You've been invited</title>
</head>
<body style="margin:0;padding:0;background:#0A0A0B;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0B;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#111113;border:1px solid rgba(255,255,255,0.06);border-radius:12px;overflow:hidden;">

          <!-- Header bar -->
          <tr>
            <td style="background:#6366F1;padding:4px 0;"></td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <!-- Logo / brand -->
              <p style="margin:0 0 32px;font-size:13px;font-weight:600;color:#6366F1;letter-spacing:0.08em;text-transform:uppercase;">SaaS Platform</p>

              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;">
                You&rsquo;ve been invited
              </h1>
              <p style="margin:0 0 28px;font-size:15px;color:#a1a1aa;line-height:1.6;">
                <strong style="color:#ffffff;">${inviterName}</strong> invited you to join
                <strong style="color:#ffffff;">${organizationName}</strong> as
                <span style="display:inline-block;padding:1px 8px;background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.3);border-radius:4px;font-size:12px;font-weight:500;color:#818cf8;">${role}</span>.
              </p>

              <!-- CTA button -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td style="border-radius:8px;background:#6366F1;">
                    <a href="${acceptUrl}"
                       style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Fallback link -->
              <p style="margin:0 0 0;font-size:12px;color:#52525b;">
                Or copy this link into your browser:<br />
                <a href="${acceptUrl}" style="color:#818cf8;word-break:break-all;">${acceptUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;font-size:12px;color:#3f3f46;">
                This invitation expires in 7 days. If you didn&rsquo;t expect this email, you can safely ignore it.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
