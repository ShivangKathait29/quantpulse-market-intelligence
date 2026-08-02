export { middleware } from "./middlewares/index";

export const config = {
    matcher: ['/((?!api/inngest|_next/static|_next/image|favicon.ico|assets).*)'],
};
