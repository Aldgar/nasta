import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfillTicketNumbers() {
  console.log('Starting ticket number backfill...');

  // Find ALL tickets first, then filter for those without ticket numbers
  const allTickets = await prisma.supportTicket.findMany({
    orderBy: {
      createdAt: 'asc',
    },
    select: {
      id: true,
      ticketNumber: true,
      createdAt: true,
    },
  });

  // Filter tickets that don't have a ticket number (null or empty)
  const ticketsWithoutNumbers = allTickets.filter(
    (ticket) => !ticket.ticketNumber || ticket.ticketNumber.trim() === ''
  );

  console.log(`Found ${ticketsWithoutNumbers.length} tickets without ticket numbers out of ${allTickets.length} total tickets`);

  // Group tickets by year
  const ticketsByYear = new Map<number, Array<{ id: string; createdAt: Date }>>();
  
  for (const ticket of ticketsWithoutNumbers) {
    const year = new Date(ticket.createdAt).getFullYear();
    if (!ticketsByYear.has(year)) {
      ticketsByYear.set(year, []);
    }
    ticketsByYear.get(year)!.push(ticket);
  }

  // Generate ticket numbers for each year
  for (const [year, tickets] of ticketsByYear.entries()) {
    const prefix = `TKT-${year}-`;
    
    // Find the highest existing ticket number for this year (including already numbered tickets)
    const lastTicket = await prisma.supportTicket.findFirst({
      where: {
        ticketNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        ticketNumber: 'desc',
      },
      select: {
        ticketNumber: true,
      },
    });

    let sequence = 1;
    if (lastTicket?.ticketNumber) {
      const lastSequence = parseInt(lastTicket.ticketNumber.replace(prefix, ''), 10);
      if (!isNaN(lastSequence)) {
        sequence = lastSequence + 1;
      }
    }

    // Assign ticket numbers to all tickets for this year
    for (const ticket of tickets) {
      const ticketNumber = `${prefix}${sequence.toString().padStart(6, '0')}`;
      
      try {
        await prisma.supportTicket.update({
          where: { id: ticket.id },
          data: { ticketNumber },
        });
        console.log(`Assigned ${ticketNumber} to ticket ${ticket.id}`);
        sequence++;
      } catch (error: any) {
        // If ticket number already exists (shouldn't happen), try next sequence
        if (error.code === 'P2002') {
          console.warn(`Ticket number ${ticketNumber} already exists, trying next...`);
          sequence++;
          const newTicketNumber = `${prefix}${sequence.toString().padStart(6, '0')}`;
          await prisma.supportTicket.update({
            where: { id: ticket.id },
            data: { ticketNumber: newTicketNumber },
          });
          console.log(`Assigned ${newTicketNumber} to ticket ${ticket.id}`);
          sequence++;
        } else {
          console.error(`Error updating ticket ${ticket.id}:`, error);
        }
      }
    }
  }

  console.log('Ticket number backfill completed!');
}

backfillTicketNumbers()
  .catch((error) => {
    console.error('Error during backfill:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

