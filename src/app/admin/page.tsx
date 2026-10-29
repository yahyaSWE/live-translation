import AdminConsole from "@/components/AdminConsole";
import { isAdmin } from "@/lib/http";

export default async function AdminPage() { return <AdminConsole authenticated={await isAdmin()} />; }
