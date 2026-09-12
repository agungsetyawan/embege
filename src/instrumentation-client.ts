import { initBotId } from "botid/client/core";

// Invisible bot challenge (Vercel BotID) for public write endpoints.
// Server side verifies with checkBotId() in the route handler.
initBotId({
  protect: [
    {
      path: "/api/reports",
      method: "POST",
    },
  ],
});
