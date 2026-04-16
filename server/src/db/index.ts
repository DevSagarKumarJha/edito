import mongoose from "mongoose";

export async function connectDB() {
  try {
    const dbUrl = process.env.DB_URL;

    if (!dbUrl) {
      throw new Error("Database URL is not defined in environment variables.");
    }

    await mongoose.connect(dbUrl);
    console.log("Connected to MongoDB successfully");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    return null;
  }
}
