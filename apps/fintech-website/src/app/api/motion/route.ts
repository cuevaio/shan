import { createMotionRouteHandlers } from "shan/motion/next";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handlers = createMotionRouteHandlers();

export const GET = handlers.GET;
export const POST = handlers.POST;
