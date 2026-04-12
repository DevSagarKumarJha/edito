import fs from "fs/promises";
import path from "path";

export async function generateFileTree(directory) {
  const tree = {};

  async function buildTree(currentDir, currentTree) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    await Promise.all(
      entries.map(async (entry) => {
        const filePath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          currentTree[entry.name] = {};
          await buildTree(filePath, currentTree[entry.name]);
        } else {
          currentTree[entry.name] = null;
        }
      }),
    );
  }

  await buildTree(directory, tree);
  return tree;
}
