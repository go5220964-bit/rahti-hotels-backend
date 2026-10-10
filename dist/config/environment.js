"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
// Load env variables
dotenv_1.default.config();
const getEnv = () => {
    const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL environment variable is required');
    }
    const DATABASE_URL = process.env.DATABASE_URL;
    const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'super-secret-verify-token-123';
    const WHATSAPP_API_TOKEN = process.env.WHATSAPP_API_TOKEN || 'mock-whatsapp-api-token';
    return {
        PORT,
        DATABASE_URL,
        WHATSAPP_VERIFY_TOKEN,
        WHATSAPP_API_TOKEN,
    };
};
exports.env = getEnv();
exports.default = exports.env;
