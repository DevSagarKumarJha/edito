import http from "http";
import { createApp } from "./app";
import { connectDB } from "./db";

async function startServer() {
  const app = createApp();
  const server = http.createServer(app);

  await connectDB();

  server.listen(3000, () => {
    console.log("Server is running on port 3000");
  });
}

export default startServer;
