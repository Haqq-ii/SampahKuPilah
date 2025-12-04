// Vercel Serverless Function Entry Point
// File ini adalah entry point untuk semua request di Vercel

// Import server.js yang sudah export default app
import app from '../server.js';

// Export untuk Vercel - Vercel akan menggunakan app sebagai handler
export default app;

