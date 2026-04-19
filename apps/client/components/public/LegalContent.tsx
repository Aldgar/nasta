"use client";
import { useMemo, type ReactNode } from "react";

type LegalContentProps = {
  content: string;
};

/**
 * LegalContent
 * Renders markdown-like legal text with proper formatting
 */
export default function LegalContent({ content }: LegalContentProps) {
  const parsedContent = useMemo(() => {
    const lines = content.split("\n");
    const elements: ReactNode[] = [];
    let key = 0;
    let inList = false;
    let listItems: string[] = [];

    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(
          <ul
            key={key++}
            className="ml-6 mb-4 space-y-2 list-disc text-[var(--muted-text)]"
          >
            {listItems.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        );
        listItems = [];
      }
      inList = false;
    };

    lines.forEach((line) => {
      const trimmed = line.trim();

      if (!trimmed) {
        if (inList) {
          flushList();
        } else {
          elements.push(<div key={key++} className="h-4" />);
        }
        return;
      }

      if (trimmed.startsWith("# ")) {
        flushList();
        elements.push(
          <h1 key={key++} className="text-4xl font-bold mb-6 mt-8 text-[var(--foreground)]">
            {trimmed.substring(2)}
          </h1>
        );
      } else if (trimmed.startsWith("## ")) {
        flushList();
        elements.push(
          <h2
            key={key++}
            className="text-2xl font-semibold mb-4 mt-6 text-[var(--foreground)]"
          >
            {trimmed.substring(3)}
          </h2>
        );
      } else if (trimmed.startsWith("### ")) {
        flushList();
        elements.push(
          <h3
            key={key++}
            className="text-xl font-semibold mb-3 mt-5 text-[var(--foreground)]"
          >
            {trimmed.substring(4)}
          </h3>
        );
      } else if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
        flushList();
        const boldText = trimmed.substring(2, trimmed.length - 2);
        elements.push(
          <p key={key++} className="font-bold mb-2 text-[var(--foreground)]">
            {boldText}
          </p>
        );
      } else if (trimmed.startsWith("- ")) {
        inList = true;
        const listText = trimmed.substring(2);
        listItems.push(listText);
      } else {
        flushList();
        elements.push(
          <p key={key++} className="mb-3 text-[var(--muted-text)] leading-relaxed">
            {trimmed}
          </p>
        );
      }
    });

    flushList(); // Flush any remaining list items

    return elements;
  }, [content]);

  return (
    <div className="max-w-none">
      <div className="space-y-2">{parsedContent}</div>
    </div>
  );
}
