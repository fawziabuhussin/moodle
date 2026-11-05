import { redirect } from "next/navigation";
import { TERMINAL_PAGE_ENABLED } from "@/lib/constants";

export default function TerminalSimulatorRedirect() {
  redirect(TERMINAL_PAGE_ENABLED ? "/terminal" : "/dashboard");
}
