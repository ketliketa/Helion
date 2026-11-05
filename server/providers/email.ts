import type { Database } from "../db/database.ts";
export function queueEmail(
  db: Database,
  organization: string,
  to: string,
  subject: string,
  body: string,
  key: string = crypto.randomUUID(),
) {
  const now = new Date().toISOString();
  db.run(
    "INSERT OR IGNORE INTO email_jobs (id,organization_id,recipient,subject,body,status,next_attempt,created) VALUES (?,?,?,?,?,'queued',?,?)",
    key,
    organization,
    to,
    subject,
    body,
    now,
    now,
  );
  return key;
}
let processing = false;
export async function processEmails(
  db: Database,
  fetcher: typeof fetch = fetch,
) {
  if (processing || !process.env.RESEND_API_KEY || !process.env.MAIL_FROM)
    return;
  processing = true;
  try {
    const jobs = db.all(
      "SELECT * FROM email_jobs WHERE status IN ('queued','retrying') AND attempts<8 AND next_attempt<=? ORDER BY created LIMIT 10",
      new Date().toISOString(),
    );
    for (const job of jobs) {
      db.run(
        "UPDATE email_jobs SET status='sending',attempts=attempts+1 WHERE id=?",
        job.id,
      );
      try {
        const response = await fetcher("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
            "Idempotency-Key": job.id,
          },
          body: JSON.stringify({
            from: process.env.MAIL_FROM,
            to: [job.recipient],
            subject: job.subject,
            text: job.body,
          }),
          signal: AbortSignal.timeout(15000),
        });
        const result = (await response.json()) as any;
        if (!response.ok)
          throw new Error(result.message || "Ofruesi refuzoi dërgimin");
        db.run(
          "UPDATE email_jobs SET status='accepted',provider_id=?,error=NULL WHERE id=?",
          result.id,
          job.id,
        );
      } catch (error) {
        const attempts = job.attempts + 1;
        db.run(
          "UPDATE email_jobs SET status=?,error=?,next_attempt=? WHERE id=?",
          attempts >= 8 ? "failed" : "retrying",
          String(
            error instanceof Error ? error.message : "Gabim dërgimi",
          ).slice(0, 250),
          new Date(
            Date.now() + Math.min(3600000, 1000 * 2 ** attempts),
          ).toISOString(),
          job.id,
        );
      }
    }
  } finally {
    processing = false;
  }
}
export function recoverEmailJobs(db: Database) {
  db.run("UPDATE email_jobs SET status='retrying' WHERE status='sending'");
}
