import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { createJevService, ORIGIN } from "@/server/jev.mjs";
export const dynamic = "force-dynamic";
const service = createJevService();
async function handle(request: Request) {
 const user = await getChatGPTUser();
 return service(request, {user, key: env.TYPESAFE_API_KEY, origin: import.meta.env.DEV ? new URL(request.url).origin : ORIGIN});
}
export const GET = handle;
export const POST = handle;
