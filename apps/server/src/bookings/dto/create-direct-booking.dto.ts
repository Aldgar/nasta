export class CreateDirectBookingDto {
  jobSeekerId!: string;
  start!: string; // ISO string
  end!: string; // ISO string
  payUnit!: 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'PROJECT';
  rateAmount!: number; // minor units (e.g., cents)
  currency!: string; // e.g., 'EUR'
  title?: string;
  notes?: string;
}
