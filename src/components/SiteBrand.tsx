import Link from "next/link";
import { APP_NAME } from "@/lib/brand";

export default function SiteBrand({ href = "/" }: { href?: string }) {
  return <Link href={href} className="wordmark" aria-label={`${APP_NAME} – ${href === "/admin" ? "till admin" : "till lyssnarsidan"}`}>
    Khutbah <span>Live</span>
  </Link>;
}
