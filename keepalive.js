import express from "express";

export function startKeepAliveServer() {
    const app = express();
    const PORT = process.env.PORT || 3000;

    app.get("/", (req, res) => {
        res.send("Bot is running");
    });

    app.listen(PORT, () => {
        console.log(`🌐 Keep-alive server listening on port ${PORT}`);
    });
}