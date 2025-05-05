import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { CounterService } from 'src/counter/counter.service';

interface ClientVisitorData {
  visitorId: string;
}

@WebSocketGateway({ cors: true })
export class OnlineCounterGateway {
  logger: Logger;
  constructor(
    private readonly config: ConfigService,
    private readonly counterService: CounterService,
  ) {
    this.logger = new Logger(OnlineCounterGateway.name);
  }

  @WebSocketServer() server: Server;
  handleConnection(client: Socket) {
    // Increment counter on client connection
    let count = this.config.getOrThrow<number>('ONLINE_COUNT');
    count++;
    this.config.set('ONLINE_COUNT', count);
    this.logger.log(`Client connected: ${client.id}. Online count: ${count}`);

    // Broadcast updated count to all clients
    this.broadcastCount(count);
  }

  handleDisconnect(client: Socket) {
    // Decrement counter on client disconnection
    let count = this.config.getOrThrow<number>('ONLINE_COUNT');
    count--;

    // Ensure count doesn't go below 0
    count = Math.max(0, count);
    this.config.set('ONLINE_COUNT', count);

    this.logger.log(
      `Client disconnected: ${client.id}. Online count: ${count}`,
    );

    // Broadcast updated count to all clients
    this.broadcastCount(count);
  }

  @SubscribeMessage('registerVisitor')
  async handleVisitorRegistration(client: Socket, data: ClientVisitorData) {
    const { visitorId } = data;

    try {
      // Log this distinct visitor
      await this.counterService.logLogin(visitorId);
    } catch (error) {
      this.logger.error(
        `Failed to register visitor: ${(error as Error).message}`,
      );
      client.emit('visitorRegistered', {
        success: false,
        error: 'Failed to register visitor',
      });
    }
  }

  private broadcastCount(count: number) {
    this.server.emit('onlineCount', { count });
  }
}
