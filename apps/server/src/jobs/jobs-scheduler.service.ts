import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';

@Injectable()
export class JobsSchedulerService {
  private readonly logger = new Logger(JobsSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
  ) {}

  /**
   * Auto-complete jobs that are 4 days past their start date
   * Runs daily at 2 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async autoCompleteJobs() {
    this.logger.log('Starting auto-completion check for jobs...');

    try {
      const fourDaysAgo = new Date();
      fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);

      // Find jobs that:
      // 1. Have status ASSIGNED (accepted application but not completed)
      // 2. Have a startDate that is 4 or more days ago
      // 3. Have an accepted application that is not already completed
      const jobsToComplete = await this.prisma.job.findMany({
        where: {
          status: 'ASSIGNED',
          startDate: {
            lte: fourDaysAgo, // Start date is 4 or more days ago
            not: null, // Must have a start date
          },
        },
        select: {
          id: true,
          employerId: true,
          applications: {
            where: {
              status: 'ACCEPTED',
              completedAt: null, // Not already completed
            },
            select: {
              id: true,
              payment: {
                select: {
                  id: true,
                  status: true,
                  stripePaymentIntentId: true,
                  amount: true,
                },
              },
            },
            take: 1, // Only need the first accepted application
          },
        },
      });

      this.logger.log(`Found ${jobsToComplete.length} jobs to auto-complete`);

      for (const job of jobsToComplete) {
        if (job.applications.length === 0) {
          continue; // Skip if no accepted application
        }

        const application = job.applications[0];
        if (!application.payment) {
          this.logger.warn(
            `Skipping job ${job.id} - application ${application.id} has no payment`,
          );
          continue;
        }

        try {
          // Check if all payments are complete
          const paymentVerification =
            await this.payments.verifyAllPaymentsComplete(application.id);

          if (!paymentVerification.allPaid) {
            // There are unpaid amounts - capture paid amount as platform revenue (non-refundable)
            this.logger.log(
              `Job ${job.id} has unpaid amounts (${paymentVerification.unpaidAmount.toFixed(2)}). Capturing paid amount as platform revenue (non-refundable).`,
            );

            const paidAmount = application.payment.amount || 0;
            if (paidAmount > 0) {
              try {
                await this.payments.capturePaidAmountAsPlatformRevenue(
                  application.id,
                  application.payment.id,
                  paidAmount,
                  'Auto-completion after 4 days with unpaid amounts - non-refundable per policy',
                );

                // Mark application as completed but don't transfer to service provider
                await this.prisma.application.update({
                  where: { id: application.id },
                  data: {
                    completedAt: new Date(),
                  },
                });

                // Update job status to COMPLETED
                await this.prisma.job.update({
                  where: { id: job.id },
                  data: { status: 'COMPLETED' },
                });

                // Send employer receipt email for the amount that was paid
                try {
                  await this.payments.sendEmployerReceiptEmailAfterAutoCompletion(
                    application.id,
                  );
                } catch (emailError) {
                  this.logger.warn(
                    `Failed to send employer receipt email for auto-completed job ${job.id} (application ${application.id}): ${emailError}`,
                  );
                }

                this.logger.log(
                  `Captured paid amount ${paidAmount} as platform revenue for job ${job.id} (application ${application.id}) due to unpaid amounts.`,
                );
              } catch (captureError) {
                this.logger.error(
                  `Failed to capture paid amount as platform revenue for job ${job.id}: ${captureError}`,
                );
              }
            }
          } else {
            // All payments are complete - normal flow (90% to service provider, 10% platform fee)
            this.logger.log(
              `Auto-completing job ${job.id} (application ${application.id}) - all payments complete`,
            );

            // Use the payments service to complete the application payment
            // This will transfer 90% to service provider and keep 10% as platform fee
            await this.payments.completeApplicationPayment(
              job.employerId,
              application.id,
            );

            this.logger.log(
              `Successfully auto-completed job ${job.id} (application ${application.id}) with normal payment distribution`,
            );
          }
        } catch (error) {
          this.logger.error(`Failed to auto-complete job ${job.id}: ${error}`);
          // Continue with other jobs even if one fails
        }
      }

      this.logger.log('Auto-completion check completed');
    } catch (error) {
      this.logger.error(`Error in auto-completion check: ${error}`);
    }
  }

  /**
   * Sync bookings for all completed applications
   * Runs daily at 3 AM to ensure bookings are up-to-date
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async syncCompletedApplicationsBookings() {
    this.logger.log('Starting sync of completed applications with bookings...');

    try {
      const result = await this.payments.syncAllCompletedApplicationsBookings();
      this.logger.log(
        `Sync completed: ${result.synced} synced, ${result.errors} errors out of ${result.total} total`,
      );
    } catch (error) {
      this.logger.error(`Error syncing completed applications: ${error}`);
    }
  }
}
