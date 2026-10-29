import { useCollection } from "./captain";

/** Placeholder screen. The builder bot replaces this file. */
export default function App() {
  const notes = useCollection<{ text: string }>("notes");
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-6 sm:px-8 sm:py-10">
      <h1 className="text-2xl font-semibold">New Bambii app</h1>
      <p className="mt-2 text-sm opacity-70">{notes.records.length} notes stored on this Mac.</p>
    </main>
  );
}
