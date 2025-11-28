import { InversifyExpressServer } from "inversify-express-utils";
import cors from "cors";
import express from "express";
import { rateLimit } from "express-rate-limit";
import container from "./config/container.ts";

export const server = new InversifyExpressServer(container);

const rateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 min
    max: 10, // Limit each IP to 10 requests per windowMs
    standardHeaders: false, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: 'Too many requests. Stop it!',
    statusCode: 429 // HttpStatusCode.TOO_MANY_REQUESTS
});

const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
        if (!origin) {
            // Allow requests with no origin (GitHub Actions, CLI tools)
            return callback(null, true);
        }

        const allowedOrigins = process.env.CORS_ORIGINS?.split(",") || [];

        if (allowedOrigins.includes(origin) || process.env.NODE_ENV === "development") {
            return callback(null, true);
        }

        return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
};

server.setConfig((app) => {
    app.use(express.json());
    app.use(express.urlencoded({
        extended: true,
        parameterLimit: 10,
        limit: '150kb'
    }));
    app.use(cors(corsOptions));
    app.use(rateLimiter);
});