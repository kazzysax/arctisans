import { ok, route } from "@/lib/api";
import { ensureNative } from "@/lib/native/worker";

// Lists Arctisans' own agents (and creates their profiles on first call). Read-only for callers: no money moves here.
export const GET = route("native-agents", 30, async () => ok({ items: await ensureNative() }));
