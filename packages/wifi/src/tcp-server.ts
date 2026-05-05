import { EventEmitter } from "node:events";
import * as net from "node:net";
import { createFrameReader, TYPE_PROOF, TYPE_REQUEST, writeFrame } from "./tcp-framing.js";

/**
 * Listens for incoming TCP connections from Fernlink peers.
 *
 * NOTE (HIGH-4 — known limitation): all TCP connections are plaintext (no TLS).
 * Ed25519 signatures protect proof integrity end-to-end, but a MITM on a hostile
 * LAN can drop real proofs and substitute crafted ones (which fail verification
 * but prevent the real ones from arriving). Upgrade path: mutual TLS using each
 * node's identity keypair, or Noise Protocol XX handshake.
 * Emits "request" and "proof" events with the raw payload Buffer.
 * Call sendProof() to push a proof to all connected sockets.
 */
export class TcpServer extends EventEmitter {
  private server: net.Server;
  private sockets = new Set<net.Socket>();
  public port = 0;

  constructor() {
    super();
    this.server = net.createServer((socket) => this.handleSocket(socket));
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(0, () => {
        this.port = (this.server.address() as net.AddressInfo).port;
        resolve();
      });
    });
  }

  stop(): void {
    this.sockets.forEach((s) => s.destroy());
    this.sockets.clear();
    this.server.close();
  }

  sendProof(payload: Buffer): void {
    const dead: net.Socket[] = [];
    this.sockets.forEach((socket) => {
      try { writeFrame(socket, TYPE_PROOF, payload); }
      catch { dead.push(socket); }
    });
    dead.forEach((s) => { this.sockets.delete(s); s.destroy(); });
  }

  sendRequest(payload: Buffer): void {
    const dead: net.Socket[] = [];
    this.sockets.forEach((socket) => {
      try { writeFrame(socket, TYPE_REQUEST, payload); }
      catch { dead.push(socket); }
    });
    dead.forEach((s) => { this.sockets.delete(s); s.destroy(); });
  }

  get connectedCount(): number { return this.sockets.size; }

  private handleSocket(socket: net.Socket): void {
    this.sockets.add(socket);
    const reader = createFrameReader((typeTag, payload) => {
      if (typeTag === TYPE_REQUEST) this.emit("request", payload);
      if (typeTag === TYPE_PROOF)   this.emit("proof",   payload);
    });
    socket.on("data", reader);
    socket.on("close", () => this.sockets.delete(socket));
    socket.on("error", () => { this.sockets.delete(socket); socket.destroy(); });
  }
}
