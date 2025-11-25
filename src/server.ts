import config from "./config/config.ts";
import "./config/concurrency.ts";
import main from "./main.ts";

main.listen(config.port, () => {
    console.log(`server started on port ${config.port}`);
});