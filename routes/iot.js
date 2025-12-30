// routes/iot.js - IoT Routes (ESP32 Control)
import express from "express";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

const ESP32_HOST = process.env.ESP32_HOST || "http://192.168.1.20";
const ESP32_TIMEOUT = 10000;

// Test ESP32 connection status
router.get("/status", async (req, res) => {
    try {
        console.log(`🔍 Testing ESP32 connection: ${ESP32_HOST}`);
        const startTime = Date.now();

        const response = await fetch(`${ESP32_HOST}/status`, {
            method: "GET",
            signal: AbortSignal.timeout(ESP32_TIMEOUT),
        });

        const duration = Date.now() - startTime;

        if (!response.ok) {
            return res.status(response.status).json({
                connected: false,
                error: `ESP32 responded with status ${response.status}`,
                duration: `${duration}ms`
            });
        }

        const data = await response.json();
        console.log(`✅ ESP32 connection successful (${duration}ms)`);

        return res.json({
            connected: true,
            esp32: data,
            duration: `${duration}ms`,
            host: ESP32_HOST
        });
    } catch (err) {
        const errorMsg = err.name === 'AbortError'
            ? "ESP32 timeout - tidak merespons"
            : err.message || "Gagal terhubung ke ESP32";

        console.error(`❌ ESP32 connection test failed:`, errorMsg);

        return res.status(504).json({
            connected: false,
            error: errorMsg,
            host: ESP32_HOST,
            troubleshooting: [
                "1. Pastikan ESP32 sudah terhubung ke WiFi",
                "2. Pastikan ESP32 dan server dalam jaringan WiFi yang sama",
                "3. Cek IP Address ESP32 di Serial Monitor",
                "4. Update ESP32_HOST di file .env jika IP berubah",
                "5. Coba ping ESP32 dari terminal: ping [IP_ESP32]"
            ]
        });
    }
});

// 🔒 SECURED: Open bin endpoint - requires authentication
router.get("/open", requireAuth, async (req, res) => {
    const startTime = Date.now();

    try {
        const binType = req.query.type;

        if (!binType) {
            return res.status(400).json({ error: "Parameter 'type' required" });
        }

        // Validasi bin type
        const validTypes = ["hijau", "merah", "biru", "abu-abu", "kuning"];
        if (!validTypes.includes(binType.toLowerCase())) {
            return res.status(400).json({
                error: "Invalid bin type. Use: hijau, merah, biru, abu-abu, or kuning"
            });
        }

        // Log user action for security audit
        console.log(`🔐 User ${req.user.email} requesting to open bin: ${binType}`);

        // Proxy request ke ESP32
        const esp32Url = `${ESP32_HOST}/open?type=${encodeURIComponent(binType)}`;
        console.log(`📡 Proxying to ESP32: ${esp32Url}`);

        const response = await fetch(esp32Url, {
            method: "GET",
            signal: AbortSignal.timeout(ESP32_TIMEOUT),
        });

        const duration = Date.now() - startTime;

        if (!response.ok) {
            const errorText = await response.text();
            console.warn(`⚠️ ESP32 error (${response.status}, ${duration}ms):`, errorText);
            return res.status(response.status).json({
                error: "ESP32 error",
                detail: errorText,
                duration: `${duration}ms`
            });
        }

        const data = await response.json();
        console.log(`✅ ESP32 response (${duration}ms):`, data);

        return res.json({
            ...data,
            duration: `${duration}ms`,
            user: req.user.email // Include user info in response
        });
    } catch (err) {
        const duration = Date.now() - startTime;

        if (err.name === 'AbortError') {
            console.error(`⏱️ ESP32 timeout setelah ${duration}ms - IP: ${ESP32_HOST}`);
            return res.status(504).json({
                error: "ESP32 timeout",
                message: `ESP32 tidak merespons dalam ${ESP32_TIMEOUT / 1000} detik`,
                host: ESP32_HOST,
                troubleshooting: [
                    "1. Pastikan ESP32 sudah terhubung ke WiFi dan server berjalan",
                    "2. Pastikan ESP32 dan server dalam jaringan WiFi yang sama",
                    "3. Cek IP Address ESP32 di Serial Monitor - mungkin berubah",
                    "4. Update ESP32_HOST di file .env atau ubah di server.js",
                    "5. Coba akses ESP32 langsung di browser: http://[IP_ESP32]/status",
                    "6. Restart ESP32 jika perlu"
                ]
            });
        }

        console.error(`💥 IoT proxy error (${duration}ms):`, err.message);
        return res.status(500).json({
            error: "iot_connection_error",
            message: err.message || "Gagal terhubung ke ESP32",
            host: ESP32_HOST,
            type: err.name
        });
    }
});

export default router;
