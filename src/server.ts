import { InversifyExpressServer } from "inversify-express-utils";
import cors from "cors";
import express from "express";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import container from "./config/container.ts";

export const server = new InversifyExpressServer(container);

// ============================================
// RATE LIMITING CONFIGURATION
// ============================================

/**
 * Properly handle IPv6 addresses by normalizing them
 * Prevents IPv6 users from bypassing rate limits
 */
const normalizeIp = (ip: string | undefined): string => {
    if (!ip) return "unknown";

    // Convert IPv6-mapped IPv4 addresses (::ffff:x.x.x.x) to regular IPv4
    if (ip.startsWith("::ffff:")) {
        return ip.substring(7);
    }

    // Return as-is for regular IPv4 and IPv6 addresses
    return ip;
};

/**
 * Rate limiter that tracks requests per GitHub repository
 * 
 * For OIDC authenticated requests:
 * - Use repository ID as key (prevents abuse per repo)
 * - Allow higher limits (30 requests per 15 min)
 * 
 * For unauthenticated requests:
 * - Use IP address as key
 * - Strict limit (5 requests per 15 min)
 */
const rateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes

    // Dynamic limit based on authentication
    max: (req: express.Request) => {
        // Authenticated GitHub Actions requests get higher limit
        if ((req as any).github) {
            return 30; // 30 requests per window for authenticated repos
        }
        // Unauthenticated requests get strict limit
        return 5;
    },

    // Use repository ID for authenticated requests, IP for others
    keyGenerator: (req: express.Request) => {
        if ((req as any).github?.repositoryId) {
            return `repo:${(req as any).github.repositoryId}`;
        }
        return `ip:${ipKeyGenerator(normalizeIp(req.ip))}`;
    },

    standardHeaders: true, // Return rate limit info in RateLimit-* headers
    legacyHeaders: false, // Disable X-RateLimit-* headers

    message: "Too many requests from this repository. Please try again later.",
    statusCode: 429,

    // Skip rate limiting for health checks
    skip: (req: express.Request) => {
        return req.path === "/health";
    }
});

// ============================================
// CORS CONFIGURATION
// ============================================

const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
        if (!origin) {
            // Allow requests with no origin
            // (GitHub Actions, CLI tools, curl commands)
            return callback(null, true);
        }

        const allowedOrigins = process.env.CORS_ORIGINS?.split(",") || [];

        if (
            allowedOrigins.includes(origin) ||
            process.env.NODE_ENV === "development"
        ) {
            return callback(null, true);
        }

        return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
};

// ============================================
// SERVER CONFIGURATION
// ============================================

server.setConfig((app) => {
    // IMPORTANT: Trust proxy set to 1.
    // This tells Express to use X-Forwarded-For header for accurate IP detection
    // Required for rate limiting to work correctly
    app.set("trust proxy", 1);

    // Body parsing middleware
    app.use(express.json({ limit: "150kb" }));

    // CORS middleware
    app.use(cors(corsOptions));

    // Rate limiting middleware
    app.use(rateLimiter);

    // Health check endpoint (public, no auth required)
    app.get("/health", (req: express.Request, res: express.Response) => {
        res.json({
            status: "ok",
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || "unknown"
        });
    });
});

export default server;