import express from "express";
import helmet from "helmet";
const app = express();
app.use(helmet());
app.get("/healthz", (_req, res) => res.status(200).send("ok"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API listening on :${PORT}`));
