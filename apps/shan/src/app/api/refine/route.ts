import { createMotionRouteHandlers } from "nebi-agent/motion/next";

export const dynamic = "force-dynamic";

const handlers = createMotionRouteHandlers();

export const GET = handlers.GET;
export const POST = handlers.POST;
