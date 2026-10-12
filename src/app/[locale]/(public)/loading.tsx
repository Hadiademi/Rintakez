import { PageLoading } from "@/components/page-loading";

// The loading boundary lives in each route group, not in [locale]: a
// boundary above everything made every response stream, so even URLs that
// match no route answered 200 instead of 404 (see [...rest]/page.tsx).
export default PageLoading;
