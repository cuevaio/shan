import { createNebiRouteHandler } from "nebi-agent/next";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = createNebiRouteHandler();
