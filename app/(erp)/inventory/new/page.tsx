import { redirect } from "next/navigation";

export default function NewProductRoute() {
  redirect("/inventory?modal=add");
}
