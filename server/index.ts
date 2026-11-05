import { createApp } from "./app.ts";
import { processEmails, recoverEmailJobs } from "./providers/email.ts";

const { server, db } = createApp();

recoverEmailJobs(db);

const port = Number(process.env.PORT || 3001);
const host =
  process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1";

server.listen(port, host, () => {
  console.log(`HotelFlow API: porta ${port} · Databaza gati`);
});

const timer = setInterval(() => {
  void processEmails(db);
}, 15000);

timer.unref();

function shutdown() {
  clearInterval(timer);

  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);