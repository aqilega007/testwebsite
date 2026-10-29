// Run:  node scripts/make-password-hash.mjs
// Prints the two secret values to paste into Netlify (never commit them).
import { createInterface } from "node:readline/promises";
import { randomBytes, scryptSync } from "node:crypto";

const rl = createInterface({ input: process.stdin, output: process.stdout });
const pw = await rl.question("Choose the admin password (12+ characters): ");
rl.close();
if (pw.length < 12) {
  console.error("Too short. Use at least 12 characters.");
  process.exit(1);
}
const salt = randomBytes(16);
const hash = scryptSync(pw, salt, 64);
console.log("\nADMIN_HASH=scrypt$" + salt.toString("hex") + "$" + hash.toString("hex"));
console.log("SESSION_SECRET=" + randomBytes(32).toString("hex"));
console.log("\nAlso set ADMIN_EMAIL to the club email address.");
