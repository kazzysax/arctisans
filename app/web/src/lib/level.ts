import { client } from "./indexer";
import { arctisanEscrowAbi } from "./abi";
import { env } from "./env";
import { levelOf, LEVELS, type Level, type OnchainRecord } from "./terms";

const NEW = { record: { completed: 0, uniqueClients: 0, abandoned: 0, verified: false }, level: LEVELS[1], capBps: 0 };

/** Reads the artisan's record and upfront cap straight from the escrow (the contract decides, we only display).
 *  Fails safe: no escrow configured or RPC down means level New (0% upfront), never more. */
export async function artisanLevel(wallet: `0x${string}`): Promise<{ record: OnchainRecord; level: Level; capBps: number }> {
  const address = env.escrow();
  if (!address) return NEW;
  try {
    const c = client();
    const [completed, uniqueClients, abandoned, verified] = await c.readContract({ address, abi: arctisanEscrowAbi, functionName: "records", args: [wallet] });
    const capBps = Number(await c.readContract({ address, abi: arctisanEscrowAbi, functionName: "upfrontCapBps", args: [wallet] }));
    const record = { completed: Number(completed), uniqueClients: Number(uniqueClients), abandoned: Number(abandoned), verified };
    return { record, level: levelOf(record), capBps };
  } catch {
    return NEW;
  }
}
