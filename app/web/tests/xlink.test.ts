import { describe, it, expect } from "vitest";
import { pickImport, cleanCaption, type XTweet } from "@/lib/xlink";

const ME = "111", OTHER = "222", H = "arctisans";
const t = (o: Partial<XTweet>): XTweet => ({ id: "1", text: "my new logo @arctisans post this", author_id: ME, attachments: { media_keys: ["m1"] }, ...o });
const opts = { linkedXId: ME, handle: H };

describe("X import: only your own original post", () => {
  it("imports your own post with media and the command", () => {
    const r = pickImport(t({}), null, opts);
    expect(r.ok).toBe(true);
  });
  it("needs the 'post this' command", () => {
    expect(pickImport(t({ text: "hi @arctisans" }), null, opts)).toMatchObject({ ok: false });
  });
  it("refuses when your X is not linked", () => {
    expect(pickImport(t({}), null, { linkedXId: null, handle: H })).toMatchObject({ ok: false, reason: expect.stringContaining("not linked") });
  });
  it("refuses someone else tagging us (author must be the linked account)", () => {
    expect(pickImport(t({ author_id: OTHER }), null, opts)).toMatchObject({ ok: false });
  });
  it("refuses retweets, allows your own quote posts", () => {
    expect(pickImport(t({ referenced_tweets: [{ type: "retweeted", id: "9" }] }), null, opts)).toMatchObject({ ok: false, reason: expect.stringContaining("retweet") });
    expect(pickImport(t({ referenced_tweets: [{ type: "quoted", id: "9" }] }), null, opts)).toMatchObject({ ok: true });
  });
  it("refuses a post without uploaded media", () => {
    expect(pickImport(t({ attachments: undefined }), null, opts)).toMatchObject({ ok: true });
    expect(pickImport(t({ attachments: undefined, text: "@arctisans post this" }), null, opts)).toMatchObject({ ok: false, reason: expect.stringContaining("no text") });
  });
  it("a reply to YOUR OWN post imports the parent", () => {
    const parent = t({ id: "50", text: "finished this poster", referenced_tweets: undefined });
    const cmd = t({ id: "51", text: "@arctisans post this", attachments: undefined, in_reply_to_user_id: ME, referenced_tweets: [{ type: "replied_to", id: "50" }] });
    const r = pickImport(cmd, parent, opts);
    expect(r.ok && r.source.id).toBe("50");
  });
  it("a reply under SOMEONE ELSE's post is refused", () => {
    const parent = t({ id: "60", author_id: OTHER });
    const cmd = t({ id: "61", text: "@arctisans post this", attachments: undefined, in_reply_to_user_id: OTHER, referenced_tweets: [{ type: "replied_to", id: "60" }] });
    expect(pickImport(cmd, parent, opts)).toMatchObject({ ok: false, reason: expect.stringContaining("your own") });
  });
  it("your media reply to someone else's post is refused", () => {
    const cmd = t({ in_reply_to_user_id: OTHER, referenced_tweets: [{ type: "replied_to", id: "70" }] });
    expect(pickImport(cmd, null, opts)).toMatchObject({ ok: false });
  });
  it("cleans the caption", () => {
    expect(cleanCaption("New poster for Ade's shop @arctisans post this https://t.co/abc", H)).toBe("New poster for Ade's shop");
  });
});

describe("quote post of your own, imported via a reply", () => {
  it("imports the quote post you replied to", () => {
    const parent = t({ id: "5", text: "my take on this", referenced_tweets: [{ type: "quoted", id: "9" }], attachments: { media_keys: ["k"] } });
    const reply = t({ id: "6", text: "@arctisans post this", attachments: undefined, referenced_tweets: [{ type: "replied_to", id: "5" }], in_reply_to_user_id: ME });
    expect(pickImport(reply, parent, opts)).toMatchObject({ ok: true });
  });
});
