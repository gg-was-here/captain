"use client";

import { MicIcon, PaperclipIcon, PlusIcon, XIcon } from "lucide-react";
import { type RefObject, useEffect, useRef, useState } from "react";
import { PromptInputButton, usePromptInputAttachments } from "@/components/ai-elements/prompt-input";
import { cn } from "@/lib/utils";

/** The composer's + button: attach files to the next message. */
export function AttachButton() {
  const attachments = usePromptInputAttachments();
  return (
    <PromptInputButton
      aria-label="Attach files"
      className="absolute bottom-1.5 left-1.5 size-8 bg-muted text-foreground/70 hover:text-foreground"
      onClick={() => attachments.openFileDialog()}
    >
      <PlusIcon className="size-4" />
    </PromptInputButton>
  );
}

/** Attached files, shown as removable chips above the text. */
export function AttachmentChips() {
  const attachments = usePromptInputAttachments();
  if (attachments.files.length === 0) return null;
  return (
    <div className="flex w-full flex-wrap gap-1.5 px-3 pt-2.5">
      {attachments.files.map((file) => (
        <span
          className="flex max-w-56 items-center gap-1.5 rounded-full bg-muted py-1 pr-1 pl-2.5 text-xs"
          key={file.id}
        >
          <PaperclipIcon className="size-3 shrink-0 text-muted-foreground" />
          <span className="truncate">{file.filename ?? "Attachment"}</span>
          <button
            aria-label={`Remove ${file.filename ?? "attachment"}`}
            className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
            onClick={() => attachments.remove(file.id)}
            type="button"
          >
            <XIcon className="size-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function recognitionConstructor(): (new () => Recognition) | undefined {
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition) as (new () => Recognition) | undefined;
}

/** Dictation into the composer through the browser's speech recognition. */
export function MicButton({ textareaRef }: { readonly textareaRef: RefObject<HTMLTextAreaElement | null> }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognition = useRef<Recognition | null>(null);

  useEffect(() => {
    setSupported(recognitionConstructor() !== undefined);
    return () => recognition.current?.stop();
  }, []);

  // Write through the native setter so React's onChange sees the dictated text.
  const insert = (text: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const current = textarea.value;
    const next = current && !current.endsWith(" ") ? `${current} ${text}` : `${current}${text}`;
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(textarea, next);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const toggle = () => {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const Ctor = recognitionConstructor();
    if (!Ctor) return;
    const r = new Ctor();
    r.continuous = true;
    r.interimResults = false;
    r.lang = navigator.language;
    r.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) insert(event.results[i][0].transcript.trim());
      }
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recognition.current = r;
    r.start();
    setListening(true);
    textareaRef.current?.focus();
  };

  if (!supported) return null;
  return (
    <PromptInputButton
      aria-label={listening ? "Stop dictation" : "Dictate"}
      aria-pressed={listening}
      className={cn(
        "absolute right-11 bottom-1.5 size-8 bg-muted text-foreground/70 hover:text-foreground",
        listening && "animate-pulse bg-teal-600/15 text-teal-700",
      )}
      onClick={toggle}
    >
      <MicIcon className="size-4" />
    </PromptInputButton>
  );
}
