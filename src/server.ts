import config from "./config/config";
import main from "./main";

main.listen(config.port, () => {
    console.log(`server started on port ${config.port}`);
});