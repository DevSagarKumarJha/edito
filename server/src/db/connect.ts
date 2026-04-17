import mongoose from "mongoose";

export async function connectDB(dbUrl: string) {
  try {
    await mongoose.connect(dbUrl);
    console.log("Connected to MongoDB successfully");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    throw error;
  }
}
