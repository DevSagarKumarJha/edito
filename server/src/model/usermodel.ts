import mongoose from "mongoose";

// create a user schema for collaborative code editor like repl.it
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    profilePictureUrl: { type: String },
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    configurations: {
      theme: { type: String, default: "light" },
      fontSize: { type: Number, default: 14 },
      keybindings: { type: String, default: "default" },
    },
    githubClientId: { type: String },
    githubClientSecret: { type: String },
    gitlabClientId: { type: String },
    gitlabClientSecret: { type: String },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

const User = mongoose.model("User", userSchema);

export default User;
