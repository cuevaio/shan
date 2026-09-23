import { createShanRouteHandler } from "shan/next";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = createShanRouteHandler();
