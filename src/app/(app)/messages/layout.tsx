import type { Metadata } from "next";
import { WhenReady } from "@/components/app/app-shell";
import { ChatPage } from "@/components/chat/chat-page";

export const metadata: Metadata = { title: "Messages" };

/**
 * The chat lives in the layout shared by `/messages` and `/messages/<id>`:
 * moving from one conversation to another keeps the list as it is (search,
 * scroll) instead of starting a new screen each time. The pages themselves
 * render nothing; the open conversation is read from the address.
 */
export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <WhenReady>
        <ChatPage />
      </WhenReady>
      {children}
    </>
  );
}
