import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

// Resolve from this file so CLI commands also work from the repository root.
dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)), quiet: true });
