import { redirect } from "next/navigation";

/** Quiz management is handled from the dashboard — redirect there. */
export default function QuizzesPage() {
  redirect("/");
}
