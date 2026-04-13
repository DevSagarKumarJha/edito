import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import {
  getOrCreateRoom,
  getRoom,
  releaseRoom,
  retainRoom,
} from "../collab/rooms.ts";

const messageSync = 0;
const messageAwareness = 1;

function encodeAwarenessMessage(update) {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageAwareness);
  encoding.writeVarUint8Array(encoder, update);
  return encoding.toUint8Array(encoder);
}

function encodeDocUpdateMessage(update) {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageSync);
  syncProtocol.writeUpdate(encoder, update);
  return encoding.toUint8Array(encoder);
}

function parseAwarenessClientIDs(update) {
  const decoder = decoding.createDecoder(update);
  const len = decoding.readVarUint(decoder);
  const clientIDs = [];
  for (let i = 0; i < len; i++) {
    clientIDs.push(decoding.readVarUint(decoder));
    decoding.readVarUint(decoder); // clock
    decoding.readVarString(decoder); // json state
  }
  return clientIDs;
}

export function registerCollabSocket({ io, userDir }) {
  io.on("connection", (socket) => {
    socket.data.collabRoomsByKey = socket.data.collabRoomsByKey ?? new Map(); // key -> { rootDir, room }
    socket.data.collabClientIDsByKey = socket.data.collabClientIDsByKey ?? new Map(); // key -> Set<clientID>

    const getRootDirForSocket = () => socket.data.workspaceRoot || userDir;

    const leaveRoom = ({ rootDir, room, key }) => {
      if (!socket.data.collabRoomsByKey.has(key)) return;
      socket.data.collabRoomsByKey.delete(key);

      const clientIDs = socket.data.collabClientIDsByKey.get(key);
      socket.data.collabClientIDsByKey.delete(key);

      // Remove awareness states controlled by this socket (if any)
      if (clientIDs && clientIDs.size > 0) {
        const roomState = getRoom({ rootDir, room });
        if (roomState) {
          awarenessProtocol.removeAwarenessStates(
            roomState.awareness,
            Array.from(clientIDs),
            socket,
          );
        }
      }

      const roomState = getRoom({ rootDir, room });
      if (roomState) socket.leave(roomState.socketRoom);
      releaseRoom({ rootDir, room });
    };

    socket.on("collab:join", async ({ room }, ack) => {
      try {
        if (!socket.data.user) {
          if (typeof ack === "function") ack({ error: "unauthorized" });
          return;
        }
        if (typeof room !== "string" || room.length === 0) return;

        const rootDir = getRootDirForSocket();
        const roomState = await getOrCreateRoom({ rootDir, room });
        retainRoom({ rootDir, room: roomState.room });

        socket.join(roomState.socketRoom);
        socket.data.collabRoomsByKey.set(roomState.key, { rootDir, room: roomState.room });
        if (!socket.data.collabClientIDsByKey.has(roomState.key)) {
          socket.data.collabClientIDsByKey.set(roomState.key, new Set());
        }

      // Bind broadcast listeners once per room.
      if (!roomState.bound) {
        roomState.bound = true;
        roomState.doc.on("update", (update, origin) => {
          const message = encodeDocUpdateMessage(update);
          if (origin && typeof origin.to === "function") {
            origin.to(roomState.socketRoom).emit("collab:message", {
              room: roomState.room,
              data: message,
            });
            return;
          }
          io.to(roomState.socketRoom).emit("collab:message", {
            room: roomState.room,
            data: message,
          });
        });

        roomState.awareness.on("update", (changes, origin) => {
          // y-protocols Awareness emits: (changes, origin)
          // where `changes` is { added: number[], updated: number[], removed: number[] }.
          // Be defensive in case a different shape is emitted.
          const changed = Array.isArray(changes) ? changes[0] : changes;
          const changedClients = (changed?.added ?? [])
            .concat(changed?.updated ?? [])
            .concat(changed?.removed ?? []);
          if (changedClients.length === 0) return;

          const update = awarenessProtocol.encodeAwarenessUpdate(
            roomState.awareness,
            changedClients,
          );
          const message = encodeAwarenessMessage(update);

          if (origin && typeof origin.to === "function") {
            origin.to(roomState.socketRoom).emit("collab:message", {
              room: roomState.room,
              data: message,
            });
            return;
          }

          io.to(roomState.socketRoom).emit("collab:message", {
            room: roomState.room,
            data: message,
          });
        });
      }

        // Send current awareness states to the joiner.
        const states = Array.from(roomState.awareness.getStates().keys());
        if (states.length > 0) {
          const update = awarenessProtocol.encodeAwarenessUpdate(
            roomState.awareness,
            states,
          );
          socket.emit("collab:message", {
            room: roomState.room,
            data: encodeAwarenessMessage(update),
          });
        }

        if (typeof ack === "function") {
          ack({ room: roomState.room });
        }
      } catch (err) {
        console.error("collab:join error", err);
        if (typeof ack === "function") {
          ack({ error: "join_failed" });
        }
      }
    });

    socket.on("collab:leave", ({ room }) => {
      if (typeof room !== "string" || room.length === 0) return;
      const normalizedRoom = room.startsWith("/") ? room : `/${room}`;
      for (const [key, entry] of socket.data.collabRoomsByKey.entries()) {
        if (entry.room === normalizedRoom) {
          leaveRoom({ ...entry, key });
        }
      }
    });

    socket.on("collab:message", async ({ room, data }) => {
      if (!socket.data.user) return;
      if (typeof room !== "string" || room.length === 0) return;
      const rootDir = getRootDirForSocket();
      const roomState =
        getRoom({ rootDir, room }) ?? (await getOrCreateRoom({ rootDir, room }));

      if (!socket.data.collabRoomsByKey.has(roomState.key)) return;
      if (!(data instanceof Uint8Array) && !(data instanceof ArrayBuffer))
        return;

      const payload = data instanceof Uint8Array ? data : new Uint8Array(data);
      const decoder = decoding.createDecoder(payload);
      const messageType = decoding.readVarUint(decoder);

      if (messageType === messageSync) {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageSync);
        syncProtocol.readSyncMessage(
          decoder,
          encoder,
          roomState.doc,
          socket,
          (err) => console.error("Sync error:", err),
        );
        const reply = encoding.toUint8Array(encoder);
        if (reply.length > 1) {
          socket.emit("collab:message", { room: roomState.room, data: reply });
        }
        return;
      }

      if (messageType === messageAwareness) {
        const update = decoding.readVarUint8Array(decoder);

        const clientIDs = parseAwarenessClientIDs(update);
        const set = socket.data.collabClientIDsByKey.get(roomState.key) ?? new Set();
        clientIDs.forEach((id) => set.add(id));
        socket.data.collabClientIDsByKey.set(roomState.key, set);

        awarenessProtocol.applyAwarenessUpdate(
          roomState.awareness,
          update,
          socket,
        );
      }
    });

    socket.on("disconnect", () => {
      for (const [key, entry] of socket.data.collabRoomsByKey.entries()) {
        leaveRoom({ ...entry, key });
      }
    });
  });
}
