import { redirect } from "next/navigation";

// Default landing → iOS page. Users hitting /download go to App Store flow.
export default function DownloadIndex(): never {
  redirect("/download/ios");
}
