import { EventEmitter } from "node:events";
import * as net from "node:net";
import { createFrameReader, TYPE_REQUEST, writeFrame } from "./tcp-framing.js";

/**
 * Manages outbound TCP connections to discovered Fernlink peers.
 * Emits "proof" events with the raw payload Buffer.
 * Call sendRequest() to broadcast a request to all connected sockets.
 */
export class TcpClient extends EventEmitter {
  private sockets = new Map<string, net.Socket>();  // key: "host:port"

  connect(host: string, port: number): Promise<void> {
    const key = `${host}:${port}`;
    if (this.sockets.has(key)) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host, port }, resolve);
      socket.on("error", (err) => { this.sockets.delete(key); reject(err); });
      socket.on("close", () => this.sockets.delete(key));

      const reader = createFrameReader((typeTag, payload) => {
        if (typeTag === 0x02) this.emit("proof", payload);
      });
      socket.on("data", reader);
      this.sockets.set(key, socket);
    });
  }

  disconnect(host: string, port: number): void {
    const key = `${host}:${port}`;
    this.sockets.get(key)?.destroy();
    this.sockets.delete(key);
  }

  sendRequest(payload: Buffer): void {
    const dead: string[] = [];
    this.sockets.forEach((socket, key) => {
      try { writeFrame(socket, TYPE_REQUEST, payload); }
      catch { dead.push(key); }
    });
    dead.forEach((k) => { this.sockets.get(k)?.destroy(); this.sockets.delete(k); });
  }

  get connectedCount(): number { return this.sockets.size; }

  disconnectAll(): void {
    this.sockets.forEach((s) => s.destroy());
    this.sockets.clear();
  }
}
