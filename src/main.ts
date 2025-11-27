import config from "./config/config.ts";
import "./config/concurrency.ts";
import { server } from "./server.ts";

const port: number = Number(config.port) || 8000;
server.build().listen(port, () => console.log(`Server is running on port ${port}`));