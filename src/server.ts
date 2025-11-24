import config from "./config/config.js";
import "./config/concurrency.js";
import main from "./main.js";

main.listen(config.port, () => {
    console.log(`server started on port ${config.port}`);
});