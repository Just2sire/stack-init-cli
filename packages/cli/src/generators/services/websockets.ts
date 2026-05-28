import type { ProjectConfig } from '@stack-init/schema'
import type { GeneratedFile } from '../../utils/fs'

export function generateWebsockets(config: ProjectConfig, files: GeneratedFile[]): void {
  const stack = config.stack as string

  if (stack.includes('laravel')) {
    files.push({
      outputPath: 'config/broadcasting.php',
      content: `<?php

return [
    'default' => env('BROADCAST_DRIVER', 'reverb'),

    'connections' => [
        'reverb' => [
            'driver'  => 'reverb',
            'key'     => env('REVERB_APP_KEY'),
            'secret'  => env('REVERB_APP_SECRET'),
            'app_id'  => env('REVERB_APP_ID'),
            'options' => [
                'host'   => env('REVERB_HOST', 'localhost'),
                'port'   => env('REVERB_PORT', 8080),
                'scheme' => env('REVERB_SCHEME', 'http'),
            ],
        ],

        'pusher' => [
            'driver'  => 'pusher',
            'key'     => env('PUSHER_APP_KEY'),
            'secret'  => env('PUSHER_APP_SECRET'),
            'app_id'  => env('PUSHER_APP_ID'),
            'options' => [
                'cluster' => env('PUSHER_APP_CLUSTER', 'mt1'),
                'useTLS'  => true,
            ],
        ],

        'log'  => ['driver' => 'log'],
        'null' => ['driver' => 'null'],
    ],
];
`,
    })

    files.push({
      outputPath: 'resources/js/echo.js',
      content: `import Echo from 'laravel-echo'
import Pusher from 'pusher-js'

window.Pusher = Pusher

window.Echo = new Echo({
  broadcaster: 'reverb',
  key: import.meta.env.VITE_REVERB_APP_KEY,
  wsHost: import.meta.env.VITE_REVERB_HOST ?? window.location.hostname,
  wsPort: import.meta.env.VITE_REVERB_PORT ?? 8080,
  wssPort: import.meta.env.VITE_REVERB_PORT ?? 8080,
  forceTLS: false,
  enabledTransports: ['ws', 'wss'],
})
`,
    })

    files.push({
      outputPath: '.env.ws.example',
      content: `BROADCAST_DRIVER=reverb
REVERB_APP_ID=my-app-id
REVERB_APP_KEY=my-app-key
REVERB_APP_SECRET=my-app-secret
REVERB_HOST=localhost
REVERB_PORT=8080
REVERB_SCHEME=http
VITE_REVERB_APP_KEY="\${REVERB_APP_KEY}"
VITE_REVERB_HOST="\${REVERB_HOST}"
VITE_REVERB_PORT="\${REVERB_PORT}"
`,
    })
    return
  }

  if (stack.includes('nestjs')) {
    files.push({
      outputPath: 'src/gateway/app.gateway.ts',
      content: `import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'

@WebSocketGateway({ cors: { origin: '*' } })
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server

  handleConnection(client: Socket): void {
    console.log(\`Client connected: \${client.id}\`)
  }

  handleDisconnect(client: Socket): void {
    console.log(\`Client disconnected: \${client.id}\`)
  }

  @SubscribeMessage('message')
  handleMessage(
    @MessageBody() data: { room?: string; text: string },
    @ConnectedSocket() client: Socket,
  ): void {
    if (data.room) {
      this.server.to(data.room).emit('message', { from: client.id, text: data.text })
    } else {
      this.server.emit('message', { from: client.id, text: data.text })
    }
  }

  @SubscribeMessage('join-room')
  handleJoinRoom(@MessageBody() room: string, @ConnectedSocket() client: Socket): void {
    client.join(room)
    client.emit('joined', room)
  }
}
`,
    })

    files.push({
      outputPath: 'src/gateway/gateway.module.ts',
      content: `import { Module } from '@nestjs/common'
import { AppGateway } from './app.gateway'

@Module({ providers: [AppGateway] })
export class GatewayModule {}
`,
    })
    return
  }

  if (stack.includes('fastapi')) {
    // FastAPI has native WebSocket support — generate a manager
    files.push({
      outputPath: 'app/websocket.py',
      content: `from fastapi import WebSocket, WebSocketDisconnect
from fastapi import APIRouter
from typing import List

router = APIRouter()


class ConnectionManager:
    def __init__(self) -> None:
        self.active: List[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket) -> None:
        self.active.remove(ws)

    async def broadcast(self, message: str) -> None:
        for connection in self.active:
            await connection.send_text(message)

    async def send_personal(self, message: str, ws: WebSocket) -> None:
        await ws.send_text(message)


manager = ConnectionManager()


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    await manager.connect(ws)
    try:
        while True:
            data = await ws.receive_text()
            await manager.broadcast(f"Client says: {data}")
    except WebSocketDisconnect:
        manager.disconnect(ws)
        await manager.broadcast("A client disconnected")
`,
    })
    return
  }

  // Express (socket.io)
  files.push({
    outputPath: 'src/websocket/socket.ts',
    content: `import { Server as HttpServer } from 'http'
import { Server, Socket } from 'socket.io'

let io: Server

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: process.env.FRONTEND_URL ?? '*', methods: ['GET', 'POST'] },
  })

  io.on('connection', (socket: Socket) => {
    console.log(\`Client connected: \${socket.id}\`)

    socket.on('message', (data: { room?: string; text: string }) => {
      if (data.room) {
        io.to(data.room).emit('message', { from: socket.id, text: data.text })
      } else {
        io.emit('message', { from: socket.id, text: data.text })
      }
    })

    socket.on('join-room', (room: string) => {
      socket.join(room)
      socket.emit('joined', room)
    })

    socket.on('disconnect', () => {
      console.log(\`Client disconnected: \${socket.id}\`)
    })
  })

  return io
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.io not initialised — call initSocket first')
  return io
}
`,
  })
}
