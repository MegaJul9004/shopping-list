import "dotenv/config";
import bcrypt from "bcryptjs";
import cors from "cors";
import express from "express";
import http from "node:http";
import jwt from "jsonwebtoken";
import { customAlphabet, nanoid } from "nanoid";
import { Server } from "socket.io";
import {
  addItem,
  addMiniList,
  addRecurringItem,
  addToOfferWatchlist,
  createFamily,
  createUser,
  deleteFamilyBranchLocation,
  deleteItem,
  deleteMiniList,
  deleteRecurringItem,
  getFamilyBranchLocations,
  getFamilyById,
  getFamilyLocations,
  getFamilySettings,
  getMiniLists,
  getOfferWatchlist,
  getUserByFamilyAndUsername,
  getUserById,
  getItemsByFamily,
  getRecurringItemsByFamily,
  removeFromOfferWatchlist,
  saveFamilyBranchLocation,
  setFamilySettings,
  smartAddItem,
  updateItem
} from "./db.js";
import { buildExportByMarket, compareMarkets } from "./offers.js";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
