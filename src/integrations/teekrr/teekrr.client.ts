import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type TeekrrRecipientValidation = {
  summary: { total: number; valid: number; invalid: number };
  valid: Array<{ row: number; value: string }>;
  invalid: Array<{ row: number; value?: string; code: string; message: string }>;
};

export type TeekrrScheduleWhatsAppResult = {
  broadcastUuid: string;
  queued: number;
  scheduledAt: string;
};

// Real contract confirmed against ~/Sites/Teekrr/teekrr-api source (routes/whatsapp.ts,
// validators/whatsapp.ts, routes/broadcasts.ts) and verified live against
// https://staging-api.teekrr.com with the provided API key — not guessed.
// There is no API-key-reachable endpoint to list or create WhatsApp templates;
// an approved template name must come from the Teekrr dashboard out of band.
@Injectable()
export class TeekrrClient {
  private readonly logger = new Logger(TeekrrClient.name);

  constructor(private readonly config: ConfigService) {}

  async validateRecipients(recipients: string[]): Promise<TeekrrRecipientValidation> {
    return this.request<TeekrrRecipientValidation>('/broadcasts/validate', {
      method: 'POST',
      body: JSON.stringify({ channel: 'whatsapp', recipients }),
    });
  }

  async scheduleWhatsAppReminder(params: {
    recipient: string;
    scheduledAt: string;
    campaignName: string;
    templateParams?: Record<string, string>;
  }): Promise<TeekrrScheduleWhatsAppResult> {
    const templateName = this.config.get<string>('teekrr.whatsappTemplateName');
    if (!templateName) {
      throw new TeekrrNotConfiguredError(
        'TEEKRR_WHATSAPP_TEMPLATE_NAME is not set — no approved WhatsApp template to send with',
      );
    }

    return this.request<TeekrrScheduleWhatsAppResult>('/whatsapp', {
      method: 'POST',
      body: JSON.stringify({
        templateName,
        campaignName: params.campaignName,
        type: 'schedule broadcast',
        scheduledAt: params.scheduledAt,
        recipients: [params.recipient],
        ...(params.templateParams ? { variables: { templateParams: params.templateParams } } : {}),
      }),
    });
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const baseUrl = this.config.getOrThrow<string>('teekrr.baseUrl');
    const apiKey = this.config.getOrThrow<string>('teekrr.apiKey');

    const res = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...init.headers,
      },
    });

    const body = (await res.json().catch(() => ({}))) as { data?: T; message?: string };
    if (!res.ok) {
      const message = body.message ?? `Teekrr request failed with status ${res.status}`;
      this.logger.error(`Teekrr ${path} failed: ${res.status} ${message}`);
      throw new Error(message);
    }
    return body.data as T;
  }
}

export class TeekrrNotConfiguredError extends Error {}
