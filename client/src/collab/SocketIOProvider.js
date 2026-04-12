import * as Y from "yjs";
import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";

const messageSync = 0;
const messageAwareness = 1;

function encodeSyncStep1(doc) {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageSync);
  syncProtocol.writeSyncStep1(encoder, doc);
  return encoding.toUint8Array(encoder);
}

function encodeDocUpdate(update) {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageSync);
  syncProtocol.writeUpdate(encoder, update);
  return encoding.toUint8Array(encoder);
}

function encodeAwarenessUpdate(update) {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageAwareness);
  encoding.writeVarUint8Array(encoder, update);
  return encoding.toUint8Array(encoder);
}

export class SocketIOProvider {
  constructor({ socket, room, doc, awareness }) {
    if (!(doc instanceof Y.Doc)) throw new Error("doc must be a Y.Doc");
    this.socket = socket;
    this.room = room;
    this.doc = doc;
    this.awareness = awareness;
    this.connected = false;

    this._handleMessage = this._handleMessage.bind(this);
    this._handleDocUpdate = this._handleDocUpdate.bind(this);
    this._handleAwarenessUpdate = this._handleAwarenessUpdate.bind(this);
  }

  connect() {
    if (this.connected) return;
    this.connected = true;

    this.socket.on("collab:message", this._handleMessage);
    this.doc.on("update", this._handleDocUpdate);
    this.awareness.on("update", this._handleAwarenessUpdate);

    this.socket.emit("collab:join", { room: this.room }, (ack) => {
      if (!this.connected) return;
      if (ack?.error) return;
      if (typeof ack?.room === "string") {
        this.room = ack.room;
      }
      this._send(encodeSyncStep1(this.doc));
      this._sendLocalAwareness();
    });
  }

  disconnect() {
    if (!this.connected) return;
    this.connected = false;

    this.socket.emit("collab:leave", { room: this.room });
    this.socket.off("collab:message", this._handleMessage);
    this.doc.off("update", this._handleDocUpdate);
    this.awareness.off("update", this._handleAwarenessUpdate);
  }

  destroy() {
    this.disconnect();
  }

  _send(data) {
    this.socket.emit("collab:message", { room: this.room, data });
  }

  _sendLocalAwareness() {
    const update = awarenessProtocol.encodeAwarenessUpdate(this.awareness, [
      this.awareness.clientID,
    ]);
    this._send(encodeAwarenessUpdate(update));
  }

  _handleDocUpdate(update, origin) {
    if (origin === this) return;
    this._send(encodeDocUpdate(update));
  }

  _handleAwarenessUpdate(changes, origin) {
    if (origin === this) return;
    const changed = Array.isArray(changes) ? changes[0] : changes;
    const clientIDs = (changed?.added ?? [])
      .concat(changed?.updated ?? [])
      .concat(changed?.removed ?? []);
    if (clientIDs.length === 0) return;
    const update = awarenessProtocol.encodeAwarenessUpdate(this.awareness, clientIDs);
    this._send(encodeAwarenessUpdate(update));
  }

  _handleMessage({ room, data }) {
    if (!this.connected) return;
    if (room !== this.room) return;
    if (!(data instanceof Uint8Array) && !(data instanceof ArrayBuffer)) return;

    const payload = data instanceof Uint8Array ? data : new Uint8Array(data);
    const decoder = decoding.createDecoder(payload);
    const messageType = decoding.readVarUint(decoder);

    if (messageType === messageSync) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageSync);
      syncProtocol.readSyncMessage(
        decoder,
        encoder,
        this.doc,
        this,
        (err) => console.error("Sync error:", err),
      );
      const reply = encoding.toUint8Array(encoder);
      if (reply.length > 1) this._send(reply);
      return;
    }

    if (messageType === messageAwareness) {
      const update = decoding.readVarUint8Array(decoder);
      awarenessProtocol.applyAwarenessUpdate(this.awareness, update, this);
    }
  }
}
