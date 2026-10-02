import { Empty } from "@/components/fun/Empty";
export default function NotFound() {
  return <div className="mx-auto max-w-[480px] pt-[18vh]"><Empty art="page" title="This page isn't here" body="It may have been removed, or the link is wrong." action={{ href: "/social", label: "Back home" }} /></div>;
}
