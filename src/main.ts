import express from "express";
import { codeReviewGraph } from "./core/langgraph/graph";

const app = express();

app.use(express.json());
app.post("/review", async (req, res) => {
    const { code } = req.body;
    const graphResult = await codeReviewGraph.invoke({
        rawInput: code
    });
    res.send({ message: graphResult.reviews });
});
export default app;