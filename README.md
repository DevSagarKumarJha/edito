# Collaborative Code Editor (Monorepo)

A real-time collaborative code editor built with Node.js, Express, Socket.IO, and Yjs, featuring Monaco Editor for a seamless coding experience.

## Features

- Real-time collaboration on code files using Yjs and Socket.IO.
- File tree navigation to open and edit files.
- Auto-save functionality with debounced server-side persistence.
- Manual save button for immediate saves.
- Integrated Monaco Editor for syntax highlighting and editing.

## Quick Start

### Prerequisites

- Node.js (version 14 or higher)
- npm

### Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd code-editor
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

- **Client**: Runs on Vite dev server (check `client/package.json` for details).
- **Server**: Runs on Express + Socket.IO at `http://localhost:9000` by default.

## Usage

1. Open your browser and navigate to the client URL (usually `http://localhost:3000` or as configured).
2. Click on a file in the left file tree to open it in the Monaco Editor.
3. Edit the file; changes sync in real-time with other connected users.
4. Use the **Save** button or rely on auto-save for persistence.

## Configuration

### Client

- `VITE_SERVER_URL`: URL of the server (defaults to `http://localhost:9000`). Set via environment variable.

### Server

- `PORT`: Server port (defaults to 9000).
- `CORS_ORIGIN`: Allowed CORS origins.
- `USER_DIR`: Directory for storing user files.

Configure these in `server/src/config.js`.

## Project Structure

- `client/`: Frontend code (Vite + Monaco Editor).
- `server/`: Backend code (Express + Socket.IO + Yjs).

## Contributing

1. Fork the repository.
2. Create a feature branch.
3. Make your changes and test them.
4. Submit a pull request.

## License

This project is licensed under the MIT License.