import http from "http";
import { createApp } from "./app";
import { connectDB } from "./db";
import { startServerConfigProps } from "types/src/";

async function startServer({ port, db_url }: startServerConfigProps) {
  const app = createApp();
  const server = http.createServer(app);

  await connectDB(db_url);

  server.listen(port, () => {
    console.log(`[[32mdev[39m] view the server at http://localhost:${port}`);
  });
}

export default startServer;
