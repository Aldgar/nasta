import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'tracking',
})
export class TrackingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger = new Logger('TrackingGateway');

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinBooking')
  handleJoinBooking(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { bookingId: string }
  ) {
    const { bookingId } = payload;
    if (!bookingId) return;
    client.join(bookingId);
    this.logger.log(`Client ${client.id} joined room ${bookingId}`);
    return { event: 'joined', message: `Joined room ${bookingId}` };
  }

  @SubscribeMessage('updateLocation')
  handleUpdateLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      bookingId: string;
      lat: number;
      lng: number;
      heading?: number;
    }
  ) {
    // Validate payload
    if (!payload.bookingId || !payload.lat || !payload.lng) return;

    // Broadcast to room (excluding sender if needed, but usually sender doesn't need it back)
    // to(room) sends to everyone in room including sender? No, socket.to(room) excludes sender.
    // this.server.to(room) includes everyone.
    client.to(payload.bookingId).emit('locationUpdate', {
      lat: payload.lat,
      lng: payload.lng,
      heading: payload.heading,
      timestamp: Date.now(),
      providerId: client.id, // or userId if auth'd
    });
    
    // Debug log (can be spammy)
    // this.logger.debug(`Loc update for ${payload.bookingId}: ${payload.lat},${payload.lng}`);
  }
}
