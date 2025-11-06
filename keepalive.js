import express from "express";

let server = null;

export function startKeepAliveServer() {
    if (server) {
        return;
    }

    const app = express();
    const PORT = process.env.PORT || 3000;

    if (!PORT) {
        console.error('⚠️ PORT не установлен!');
    }

    app.get("/", (req, res) => {
        res.send("Bot is running");
    });

    app.get("/health", (req, res) => {
        res.status(200).json({ status: "ok" });
    });

    server = app.listen(PORT, "0.0.0.0", () => {
        console.log(`🌐 Keep-alive server listening on port ${PORT}`);
    });

    server.on('error', (err) => {
        console.error('Ошибка сервера:', err);
    });
}