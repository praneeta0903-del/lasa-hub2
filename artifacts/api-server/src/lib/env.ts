import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

// Load workspace-root .env (lib/db reads DATABASE_URL from process.env at import time,
// so this must run before any other module imports @workspace/db).
config({ path: path.resolve(here, "../../../../.env") });
config({ path: path.resolve(here, "../../.env"), override: false });
