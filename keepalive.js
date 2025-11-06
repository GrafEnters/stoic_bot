import express from "express";

let server = null;

export function startKeepAliveServer() {
    if (server) {
        return;
    }

    const app = express();
    const PORT = process.env.PORT || 3000;

    app.get("/", (req, res) => {
        res.send("Bot is running");
    });

    server = app.listen(PORT, () => {
        console.log(`🌐 Keep-alive server listening on port ${PORT}`);
    });
}