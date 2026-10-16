import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@libsql/client";
import { setDb, migrate, db } from "@/db";
import { listFeed } from "@/lib/queries";

const W1 = "0xAbCdEf0000000000000000000000000000000001"; // checksum-style capitals, as some sessions store them
const W2 = "0xAbCdEf0000000000000000000000000000000002";

describe("following feed", () => {
  beforeAll(async () => {
    setDb(createClient({ url: ":memory:" })); await migrate();
    for (const [i, w] of [[1, W1], [2, W2]] as const)
      await db().execute({ sql: "INSERT INTO users(id,wallet,handle,display_name,created_at) VALUES(?,?,?,?,?)", args: [`u${i}`, w, `h${i}`, `H${i}`, 1] });
    await db().execute({ sql: "INSERT INTO posts(id,author_wallet,feed,body,images,created_at) VALUES(?,?,?,?,?,?)", args: ["p1", W2, "work", "new post", "[]", Date.now()] });
  });
  it("shows a followed person's post whatever the capitalisation of the stored wallets", async () => {
    await db().execute({ sql: "INSERT INTO follows(follower,followee,created_at) VALUES(?,?,?)", args: [W1, W2.toLowerCase(), 1] });
    const items = await listFeed({ feed: "work", following: W1.toLowerCase() });
    expect(items.map((i) => i.id)).toEqual(["p1"]);
  });
  it("shows nothing from people you do not follow", async () => {
    const items = await listFeed({ feed: "work", following: W2.toLowerCase() });
    expect(items).toEqual([]);
  });
});
