"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const app = (0, express_1.default)();
app.use((0, helmet_1.default)());
app.get("/healthz", (_req, res) => res.status(200).send("ok"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API listening on :${PORT}`));
