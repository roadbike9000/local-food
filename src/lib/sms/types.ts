export interface SmsSendResult {
  success: boolean;
  id?: string;
  error?: string;
}

export interface SmsProvider {
  send(to: string, body: string): Promise<SmsSendResult>;
}
