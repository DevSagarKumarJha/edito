import { io } from "socket.io-client";
import { SERVER_URL } from "./config";
import { getAuthToken } from "./auth/session";

const socket = io(SERVER_URL, {
  autoConnect: true,
  auth: {
    token: getAuthToken(),
  },
});

export function setSocketAuthToken(token) {
  socket.auth = { token };
  if (socket.connected) {
    socket.disconnect();
    socket.connect();
  }
}

export default socket;
