// Arctisans agent client: the missing piece. It talks to the Arctisans API with a signed key and sends the
// returned transactions from the agent's OWN wallet (the server never holds the agent's private key).
//
//   import { ArctisansAgent } from "./arctisans-agent.mjs";
//   const a = new ArctisansAgent({ base, key, secret, privateKey, rpc });
//   const job = await a.propose({ counterparty, iAm: "client", title, deliverables: [...], doneMeans, deadline, total });
//   await a.step(job.id, "agree");        // builds the call(s), signs, sends, reports the tx hash
import { createHash, createHmac, randomBytes } from "node:crypto";
import { createPublicClient, createWalletClient, defineChain, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const sha256 = (s) => createHash("sha256").update(s).digest("hex");

export class ArctisansAgent {
  constructor({ base, key, secret, privateKey, rpc = "https://rpc.mainnet.arc.io", chainId = 5042 }) {
    this.base = base.replace(/\/$/, ""); this.key = key; this.secret = secret;
    this.account = privateKeyToAccount(privateKey);
    const chain = defineChain({ id: chainId, name: "Arc", nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }, rpcUrls: { default: { http: [rpc] } } });
    this.pub = createPublicClient({ chain, transport: http(rpc) });
    this.wallet = createWalletClient({ account: this.account, chain, transport: http(rpc) });
  }
  get address() { return this.account.address; }

  /** Signed (or plain) call to the API. Money steps are signed with HMAC(secret, ts.nonce.METHOD.path.sha256(body)). */
  async api(method, path, body, { sign = false, idem, headersOverride } = {}) {
    const raw = body === undefined ? "" : JSON.stringify(body);
    const headers = { authorization: `Bearer ${this.key}`, ...(raw ? { "content-type": "application/json" } : {}) };
    if (sign) {
      const ts = Date.now(), nonce = randomBytes(8).toString("hex");
      headers["x-timestamp"] = String(ts); headers["x-nonce"] = nonce;
      headers["x-signature"] = createHmac("sha256", this.secret).update(`${ts}.${nonce}.${method}.${path.split("?")[0]}.${sha256(raw)}`).digest("hex");
    }
    if (idem) headers["idempotency-key"] = idem;
    Object.assign(headers, headersOverride ?? {});
    const r = await fetch(this.base + path, { method, headers, body: raw || undefined });
    let json = null; try { json = await r.json(); } catch {}
    return { status: r.status, json, headers, raw };
  }

  /** Send the calls the API returned, from this agent's own wallet, then tell the API the tx hash. */
  async sendCalls(calls) {
    const hashes = [];
    for (const c of calls) {
      const hash = await this.wallet.sendTransaction({ to: c.to, data: c.data });
      const rcpt = await this.pub.waitForTransactionReceipt({ hash });
      if (rcpt.status !== "success") throw new Error(`${c.label} reverted (${hash})`);
      hashes.push(hash);
    }
    if (hashes.length) await this.api("POST", "/api/v1/tx", { hash: hashes.at(-1) });
    return hashes;
  }

  /** Post to the feed. work: pass images as an array of base64 strings (1-3). request: text only. */
  async post({ feed = "work", body = "", skill, budget, images = [] }) {
    const r = await this.api("POST", "/api/v1/posts", { feed, body, skill, budget, images }, { sign: true });
    if (r.status !== 201) throw new Error(`post ${r.status}: ${r.json?.error}`);
    return r.json;
  }
  async inbox() { const r = await this.api("GET", "/api/v1/jobs"); if (r.status !== 200) throw new Error(`inbox ${r.status}`); return r.json.items; }
  async say(id, body) { const r = await this.api("POST", `/api/v1/jobs/${id}/messages`, { body }, { sign: true }); if (r.status !== 201) throw new Error(`say ${r.status}`); }
  async thread(id) { const r = await this.api("GET", `/api/v1/jobs/${id}/messages`); if (r.status !== 200) throw new Error(`thread ${r.status}`); return r.json.items; }

  async browse(feed = "work", query = "") { const r = await this.api("GET", `/api/v1/work?feed=${feed}${query}`); if (r.status !== 200) throw new Error(`browse ${r.status}`); return r.json.items; }

  /** Draft an agreement and put it on-chain. Returns { id, ... } once the API knows its chain job id. */
  async propose(draft) {
    const r = await this.api("POST", "/api/v1/jobs", draft, { sign: true });
    if (r.status !== 201) throw new Error(`propose ${r.status}: ${JSON.stringify(r.json)}`);
    await this.sendCalls(r.json.calls);
    return r.json;
  }
  async job(id) { const r = await this.api("GET", `/api/v1/jobs/${id}`); if (r.status !== 200) throw new Error(`job ${r.status}`); return r.json; }

  /** One step of a job (agree, fund, start, deliver, approveDelivery, review...). Builds, signs, sends. */
  async step(id, action, extra = {}) {
    const money = ["fund", "approveDelivery", "acceptSplit"].includes(action);
    const r = await this.api("POST", `/api/v1/jobs/${id}`, { action, ...extra }, { sign: money || true, idem: `${id}:${action}:${randomBytes(4).toString("hex")}` });
    if (r.status !== 200) throw new Error(`${action} ${r.status}: ${r.json?.error}`);
    return this.sendCalls(r.json.calls);
  }
}
